import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { AppEnv, loadEnv } from "./config/env";
import { createLoggerOptions } from "./config/logger";
import {
  ControlPlaneRepository,
  PrismaControlPlaneRepository,
  createPrismaClient
} from "./lib/postgres";
import {
  ProductCacheStore,
  RateLimitCounterStore,
  RedisProductCacheStore,
  RedisRateLimitCounterStore,
  createRedisClient
} from "./lib/redis";
import {
  ProductGateway,
  SupabaseProductGateway,
  createSupabaseGatewayClient
} from "./lib/supabase";
import { AppError, registerErrorHandler } from "./middleware/error-handler";
import { createRateLimitMiddleware } from "./middleware/rate-limit.middleware";
import { AdminService } from "./modules/admin/admin.service";
import { AdminAuthService } from "./modules/admin/admin-auth.service";
import { adminRoutes } from "./modules/admin/admin.routes";
import { ApiKeyService } from "./modules/auth/api-key.service";
import { createAuthMiddleware } from "./modules/auth/auth.middleware";
import { InventoryService } from "./modules/inventory/inventory.service";
import { inventoryRoutes } from "./modules/inventory/inventory.routes";
import { ProductMediaService, SupabaseProductMediaService } from "./modules/media/media.service";
import { mediaRoutes } from "./modules/media/media.routes";
import { ProductsAdminService } from "./modules/products/products.admin.service";
import { productsAdminRoutes } from "./modules/products/products.admin.routes";
import { ProductsService } from "./modules/products/products.service";
import { productsRoutes } from "./modules/products/products.routes";
import { RealtimeHub } from "./modules/realtime/realtime-hub";
import { WebhooksService } from "./modules/webhooks/webhooks.service";
import { webhooksRoutes } from "./modules/webhooks/webhooks.routes";

declare module "fastify" {
  interface FastifyInstance {
    gatewayEnv: AppEnv;
  }
}

type AppDependencies = {
  env: AppEnv;
  controlPlane: ControlPlaneRepository;
  productCache: ProductCacheStore;
  rateLimitCounter: RateLimitCounterStore;
  productGateway: ProductGateway;
  productMediaService: ProductMediaService;
};

function createAdminGuard(adminAuthService: AdminAuthService) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const session = adminAuthService.readSessionFromRequest(request.headers);
    request.adminSession = session.admin;
  };
}

function createWebhookGuard(env: AppEnv) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const webhookSecret = request.headers["x-webhook-secret"];
    if (webhookSecret !== env.INTERNAL_WEBHOOK_SECRET) {
      throw new AppError(401, "INVALID_WEBHOOK_SECRET", "Invalid webhook secret");
    }
  };
}

async function createDefaultDependencies(env: AppEnv): Promise<AppDependencies> {
  const prismaClient = createPrismaClient(env.DATABASE_URL);
  const redisClient = createRedisClient(env.REDIS_URL);
  const supabaseClient = createSupabaseGatewayClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );

  return {
    env,
    controlPlane: new PrismaControlPlaneRepository(prismaClient),
    productCache: new RedisProductCacheStore(redisClient),
    rateLimitCounter: new RedisRateLimitCounterStore(redisClient),
    productGateway: new SupabaseProductGateway(supabaseClient, env.SUPABASE_PRODUCTS_TABLE),
    productMediaService: new SupabaseProductMediaService(supabaseClient, env)
  };
}

export async function buildApp(overrides?: Partial<AppDependencies>): Promise<FastifyInstance> {
  const env = overrides?.env ?? loadEnv();
  const shouldLoadDefaults =
    !overrides?.controlPlane ||
    !overrides?.productCache ||
    !overrides?.rateLimitCounter ||
    !overrides?.productGateway ||
    !overrides?.productMediaService;
  const defaultDependencies = shouldLoadDefaults ? await createDefaultDependencies(env) : null;
  const dependencies = {
    ...(defaultDependencies ?? {}),
    ...(overrides ?? {}),
    env
  } as AppDependencies;

  const app = Fastify({
    logger: createLoggerOptions(env)
  });

  app.decorate("gatewayEnv", env);
  registerErrorHandler(app);

  const apiKeyService = new ApiKeyService(dependencies.controlPlane, env.API_KEY_PEPPER);
  const authMiddleware = createAuthMiddleware(apiKeyService);
  const rateLimitMiddleware = createRateLimitMiddleware(dependencies.rateLimitCounter);
  const adminAuthService = new AdminAuthService(env);
  const adminGuard = createAdminGuard(adminAuthService);
  const webhookGuard = createWebhookGuard(env);
  const realtimeHub = new RealtimeHub({
    server: app.server,
    logger: app.log,
    apiKeyService,
    authTimeoutMs: env.WEBSOCKET_AUTH_TIMEOUT_MS
  });

  const productsService = new ProductsService({
    cacheStore: dependencies.productCache,
    controlPlane: dependencies.controlPlane,
    env,
    productGateway: dependencies.productGateway,
    logger: app.log
  });
  const productsAdminService = new ProductsAdminService(
    env,
    dependencies.productGateway,
    dependencies.productCache,
    dependencies.controlPlane
  );
  const adminService = new AdminService(dependencies.controlPlane, env.API_KEY_PEPPER);
  const inventoryService = new InventoryService(dependencies.controlPlane);
  const webhooksService = new WebhooksService(
    dependencies.controlPlane,
    dependencies.productGateway,
    dependencies.productCache,
    realtimeHub
  );

  app.get("/health", async () => ({
    status: "ok"
  }));

  await app.register(productsRoutes, {
    prefix: "/api/v1",
    authMiddleware,
    rateLimitMiddleware,
    productsService
  });

  await app.register(mediaRoutes, {
    prefix: "/api/v1",
    mediaService: dependencies.productMediaService
  });

  await app.register(inventoryRoutes, {
    prefix: "/api/v1",
    authMiddleware,
    rateLimitMiddleware,
    inventoryService
  });

  await app.register(adminRoutes, {
    prefix: "/admin",
    adminGuard,
    adminService,
    adminAuthService
  });

  await app.register(adminRoutes, {
    prefix: "/api/internal/admin",
    adminGuard,
    adminService,
    adminAuthService
  });

  await app.register(productsAdminRoutes, {
    prefix: "/admin",
    adminGuard,
    productsAdminService
  });

  await app.register(productsAdminRoutes, {
    prefix: "/api/internal/admin",
    adminGuard,
    productsAdminService
  });

  await app.register(webhooksRoutes, {
    prefix: "/api/internal",
    webhookGuard,
    webhooksService
  });

  app.addHook("onClose", async () => {
    await realtimeHub.close();
  });

  return app;
}
