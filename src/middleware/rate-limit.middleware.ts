import { preHandlerHookHandler } from "fastify";

import { RateLimitCounterStore } from "../lib/redis";
import { AppError } from "./error-handler";
import { buildRateLimitKey, secondsUntilNextMinute } from "../utils/cache-keys";

export function createRateLimitMiddleware(
  counterStore: RateLimitCounterStore
): preHandlerHookHandler {
  return async (request, reply) => {
    if (!request.auth) {
      throw new AppError(500, "AUTH_CONTEXT_MISSING", "Authentication context is missing");
    }

    const now = new Date();
    const ttlSeconds = secondsUntilNextMinute(now);
    const counterKey = buildRateLimitKey(request.auth.companyId, request.auth.apiKeyId, now);
    const currentCount = await counterStore.increment(counterKey, ttlSeconds);

    reply.header("x-rate-limit-limit", request.auth.rateLimitPerMinute);
    reply.header(
      "x-rate-limit-remaining",
      Math.max(0, request.auth.rateLimitPerMinute - currentCount)
    );
    reply.header("x-rate-limit-reset", ttlSeconds);

    if (currentCount > request.auth.rateLimitPerMinute) {
      request.log.warn(
        {
          companyId: request.auth.companyId,
          apiKeyId: request.auth.apiKeyId,
          currentCount,
          limit: request.auth.rateLimitPerMinute
        },
        "rate limit exceeded"
      );
      throw new AppError(429, "RATE_LIMIT_EXCEEDED", "Request rate limit exceeded", {
        companyId: request.auth.companyId,
        apiKeyId: request.auth.apiKeyId,
        limit: request.auth.rateLimitPerMinute
      });
    }
  };
}
