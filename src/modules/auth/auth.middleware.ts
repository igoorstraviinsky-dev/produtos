import { preHandlerHookHandler } from "fastify";

import { AppError } from "../../middleware/error-handler";
import { ApiKeyService } from "./api-key.service";

export function createAuthMiddleware(apiKeyService: ApiKeyService): preHandlerHookHandler {
  return async (request) => {
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      request.log.warn("missing bearer token on protected route");
      throw new AppError(401, "MISSING_CREDENTIAL", "Bearer token is required");
    }

    const apiKey = authorization.slice("Bearer ".length).trim();
    if (!apiKey) {
      request.log.warn("empty bearer token on protected route");
      throw new AppError(401, "MISSING_CREDENTIAL", "Bearer token is required");
    }

    try {
      request.auth = await apiKeyService.authenticatePresentedKey(apiKey);
    } catch (error) {
      if (error instanceof AppError) {
        request.log.warn(
          {
            code: error.code
          },
          "authentication denied"
        );
      }
      throw error;
    }
  };
}
