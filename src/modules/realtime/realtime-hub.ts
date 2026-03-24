import { IncomingMessage, Server as HttpServer } from "node:http";
import { Duplex } from "node:stream";

import { FastifyBaseLogger } from "fastify";
import WebSocket, { RawData, WebSocketServer } from "ws";

import { AppError } from "../../middleware/error-handler";
import { ApiKeyService } from "../auth/api-key.service";
import { AuthContext } from "../auth/auth.types";

type RealtimeHubOptions = {
  server: HttpServer;
  logger: FastifyBaseLogger;
  apiKeyService: ApiKeyService;
  path?: string;
  authTimeoutMs?: number;
};

type SocketAuthMessage = {
  type: "authenticate";
  apiKey: string;
};

type ProductUpdatedEvent = {
  productCount: number;
  updatedAt: string;
};

type RealtimeSession = {
  context: AuthContext;
  socket: WebSocket;
};

export class RealtimeHub {
  private readonly path: string;
  private readonly authTimeoutMs: number;
  private readonly wsServer: WebSocketServer;
  private readonly sessionsByCompanyId = new Map<string, Set<RealtimeSession>>();

  constructor(private readonly options: RealtimeHubOptions) {
    this.path = options.path ?? "/ws/partner-inventory";
    this.authTimeoutMs = options.authTimeoutMs ?? 5000;
    this.wsServer = new WebSocketServer({ noServer: true });

    options.server.on("upgrade", (request, socket, head) => {
      this.handleUpgrade(request, socket, head);
    });
  }

  private handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer) {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== this.path) {
      socket.destroy();
      return;
    }

    this.wsServer.handleUpgrade(request, socket, head, (websocket) => {
      this.handleConnection(websocket, request);
    });
  }

  private handleConnection(socket: WebSocket, request: IncomingMessage) {
    let session: RealtimeSession | null = null;

    const authTimeout = setTimeout(() => {
      this.send(socket, {
        type: "error",
        code: "SOCKET_AUTH_REQUIRED",
        message: "Socket authentication is required"
      });
      socket.close(4401, "Authentication required");
    }, this.authTimeoutMs);

    socket.on("message", async (rawData) => {
      if (session) {
        this.handleAuthenticatedMessage(socket, rawData);
        return;
      }

      try {
        const payload = this.parseMessage(rawData) as Partial<SocketAuthMessage>;
        if (payload.type !== "authenticate" || typeof payload.apiKey !== "string") {
          this.send(socket, {
            type: "error",
            code: "INVALID_SOCKET_AUTH",
            message: "Authentication payload is invalid"
          });
          socket.close(4401, "Authentication required");
          return;
        }

        const authContext = await this.options.apiKeyService.authenticatePresentedKey(
          payload.apiKey.trim()
        );

        clearTimeout(authTimeout);
        session = {
          context: authContext,
          socket
        };
        this.registerSession(session);

        this.options.logger.info(
          {
            companyId: authContext.companyId,
            keyPrefix: authContext.keyPrefix
          },
          "partner realtime session authenticated"
        );

        this.send(socket, {
          type: "ready",
          companyId: authContext.companyId,
          companyName: authContext.companyName
        });
      } catch (error) {
        const code = error instanceof AppError ? error.code : "SOCKET_AUTH_FAILED";
        const message =
          error instanceof Error ? error.message : "Socket authentication failed";

        this.send(socket, {
          type: "error",
          code,
          message
        });
        socket.close(4403, "Forbidden");
      }
    });

    socket.on("close", () => {
      clearTimeout(authTimeout);
      if (session) {
        this.unregisterSession(session);
      }
    });

    socket.on("error", (error) => {
      this.options.logger.warn({ err: error }, "partner realtime socket error");
    });

    request.socket.on("error", () => undefined);
  }

  private handleAuthenticatedMessage(socket: WebSocket, rawData: RawData) {
    const payload = this.parseMessage(rawData) as { type?: string } | null;
    if (!payload || payload.type !== "ping") {
      return;
    }

    this.send(socket, {
      type: "pong",
      timestamp: new Date().toISOString()
    });
  }

  private registerSession(session: RealtimeSession) {
    const companySessions = this.sessionsByCompanyId.get(session.context.companyId) ?? new Set();
    companySessions.add(session);
    this.sessionsByCompanyId.set(session.context.companyId, companySessions);
  }

  private unregisterSession(session: RealtimeSession) {
    const companySessions = this.sessionsByCompanyId.get(session.context.companyId);
    if (!companySessions) {
      return;
    }

    companySessions.delete(session);
    if (companySessions.size === 0) {
      this.sessionsByCompanyId.delete(session.context.companyId);
    }
  }

  broadcastProductUpdated(event: ProductUpdatedEvent) {
    const payload = {
      type: "product_updated",
      message: "O catalogo principal foi atualizado!",
      updatedAt: event.updatedAt,
      productCount: event.productCount
    };

    for (const sessions of this.sessionsByCompanyId.values()) {
      for (const session of sessions) {
        this.send(session.socket, payload);
      }
    }

    this.options.logger.info(
      {
        companyCount: this.sessionsByCompanyId.size,
        productCount: event.productCount
      },
      "broadcasted product_updated event to partner dashboards"
    );
  }

  async close() {
    for (const sessions of this.sessionsByCompanyId.values()) {
      for (const session of sessions) {
        session.socket.close();
      }
    }

    this.sessionsByCompanyId.clear();

    await new Promise<void>((resolve) => {
      this.wsServer.close(() => resolve());
    });
  }

  private parseMessage(rawData: RawData) {
    return JSON.parse(rawData.toString());
  }

  private send(socket: WebSocket, payload: Record<string, unknown>) {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(JSON.stringify(payload));
  }
}
