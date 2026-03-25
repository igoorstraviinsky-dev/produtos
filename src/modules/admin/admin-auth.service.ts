import { createHmac, timingSafeEqual } from "node:crypto";

import "fastify";

import { AppEnv } from "../../config/env";
import { AppError } from "../../middleware/error-handler";

export type AdminLoginMode = "credentials" | "token" | "open";

export type AdminSessionIdentity = {
  username: string;
  displayName: string;
  loginMode: AdminLoginMode;
};

export type AdminSessionView = {
  token: string | null;
  expiresAt: string | null;
  admin: AdminSessionIdentity;
};

type AdminSessionTokenPayload = {
  sub: "admin";
  username: string;
  displayName: string;
  loginMode: Exclude<AdminLoginMode, "open">;
  iat: number;
  exp: number;
};

declare module "fastify" {
  interface FastifyRequest {
    adminSession?: AdminSessionIdentity;
  }
}

const SESSION_TOKEN_PREFIX = "adm1";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function secureEqual(left: string | undefined, right: string | undefined) {
  if (!left || !right) {
    return false;
  }

  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export class AdminAuthService {
  private readonly sessionSecret: string;

  constructor(private readonly env: AppEnv) {
    this.sessionSecret = env.ADMIN_SESSION_SECRET ?? env.ADMIN_TOKEN ?? env.API_KEY_PEPPER;
  }

  getLoginMode(): AdminLoginMode {
    if (this.env.ADMIN_USERNAME && this.env.ADMIN_PASSWORD) {
      return "credentials";
    }

    if (this.env.ADMIN_TOKEN) {
      return "token";
    }

    return "open";
  }

  getSessionConfig() {
    const loginMode = this.getLoginMode();

    return {
      requiresAuth: loginMode !== "open",
      loginMode,
      usernameHint: loginMode === "credentials" ? this.env.ADMIN_USERNAME ?? "admin" : null,
      sessionTtlSeconds: SESSION_TTL_SECONDS
    };
  }

  getOpenSession(): AdminSessionView {
    return {
      token: null,
      expiresAt: null,
      admin: {
        username: this.env.ADMIN_USERNAME ?? "admin-local",
        displayName: "Admin local",
        loginMode: "open"
      }
    };
  }

  login(input: { username?: string; password: string }): AdminSessionView {
    const loginMode = this.getLoginMode();

    if (loginMode === "open") {
      return this.getOpenSession();
    }

    if (loginMode === "credentials") {
      const expectedUsername = this.env.ADMIN_USERNAME;
      const expectedPassword = this.env.ADMIN_PASSWORD;
      const username = input.username?.trim();

      if (!secureEqual(username, expectedUsername) || !secureEqual(input.password, expectedPassword)) {
        throw new AppError(401, "INVALID_ADMIN_CREDENTIALS", "Credenciais administrativas invalidas");
      }

      return this.issueSession({
        username: expectedUsername ?? "admin",
        displayName: expectedUsername ?? "Admin",
        loginMode
      });
    }

    if (!secureEqual(input.password, this.env.ADMIN_TOKEN)) {
      throw new AppError(401, "INVALID_ADMIN_CREDENTIALS", "Credenciais administrativas invalidas");
    }

    return this.issueSession({
      username: input.username?.trim() || "admin",
      displayName: "Administrador",
      loginMode
    });
  }

  getSessionFromToken(token: string): AdminSessionView {
    const payload = this.verifySessionToken(token);

    return {
      token,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
      admin: {
        username: payload.username,
        displayName: payload.displayName,
        loginMode: payload.loginMode
      }
    };
  }

  readSessionFromRequest(headers: Record<string, unknown>): AdminSessionView {
    const loginMode = this.getLoginMode();

    if (loginMode === "open") {
      return this.getOpenSession();
    }

    const authorization = headers.authorization;
    if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
      return this.getSessionFromToken(authorization.slice("Bearer ".length).trim());
    }

    if (this.env.ADMIN_TOKEN && secureEqual(String(headers["x-admin-token"] ?? ""), this.env.ADMIN_TOKEN)) {
      return {
        token: null,
        expiresAt: null,
        admin: {
          username: this.env.ADMIN_USERNAME ?? "admin-token",
          displayName: "Administrador",
          loginMode: "token"
        }
      };
    }

    throw new AppError(401, "INVALID_ADMIN_SESSION", "Sessao administrativa invalida");
  }

  private issueSession(identity: {
    username: string;
    displayName: string;
    loginMode: Exclude<AdminLoginMode, "open">;
  }): AdminSessionView {
    const now = Math.floor(Date.now() / 1000);
    const payload: AdminSessionTokenPayload = {
      sub: "admin",
      username: identity.username,
      displayName: identity.displayName,
      loginMode: identity.loginMode,
      iat: now,
      exp: now + SESSION_TTL_SECONDS
    };

    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = createHmac("sha256", this.sessionSecret)
      .update(encodedPayload)
      .digest("base64url");
    const token = `${SESSION_TOKEN_PREFIX}.${encodedPayload}.${signature}`;

    return {
      token,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
      admin: {
        username: payload.username,
        displayName: payload.displayName,
        loginMode: payload.loginMode
      }
    };
  }

  private verifySessionToken(token: string): AdminSessionTokenPayload {
    const [prefix, encodedPayload, receivedSignature] = token.split(".");

    if (!prefix || !encodedPayload || !receivedSignature || prefix !== SESSION_TOKEN_PREFIX) {
      throw new AppError(401, "INVALID_ADMIN_SESSION", "Sessao administrativa invalida");
    }

    const expectedSignature = createHmac("sha256", this.sessionSecret)
      .update(encodedPayload)
      .digest("base64url");

    if (!secureEqual(receivedSignature, expectedSignature)) {
      throw new AppError(401, "INVALID_ADMIN_SESSION", "Sessao administrativa invalida");
    }

    let payload: AdminSessionTokenPayload;

    try {
      payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf-8"));
    } catch {
      throw new AppError(401, "INVALID_ADMIN_SESSION", "Sessao administrativa invalida");
    }

    if (payload.sub !== "admin" || payload.exp <= Math.floor(Date.now() / 1000)) {
      throw new AppError(401, "INVALID_ADMIN_SESSION", "Sessao administrativa expirada");
    }

    return payload;
  }
}
