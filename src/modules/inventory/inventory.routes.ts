import { FastifyPluginAsync, preHandlerHookHandler } from "fastify";

import { InventoryService } from "./inventory.service";
import { syncMyInventorySchema, updateMyInventorySchema } from "./inventory.schemas";

type InventoryRoutesOptions = {
  authMiddleware: preHandlerHookHandler;
  rateLimitMiddleware: preHandlerHookHandler;
  inventoryService: InventoryService;
};

export const inventoryRoutes: FastifyPluginAsync<InventoryRoutesOptions> = async (
  app,
  options
) => {
  app.get(
    "/my-inventory",
    {
      preHandler: [options.authMiddleware, options.rateLimitMiddleware]
    },
    async (request, reply) => {
      const response = await options.inventoryService.listMyInventory(request.auth.companyId);
      return reply.status(200).send(response);
    }
  );

  app.post(
    "/my-inventory",
    {
      preHandler: [options.authMiddleware, options.rateLimitMiddleware]
    },
    async (request, reply) => {
      const payload = syncMyInventorySchema.parse(request.body);
      const response = await options.inventoryService.syncMyInventory(
        request.auth.companyId,
        payload.items
      );

      return reply.status(200).send(response);
    }
  );

  app.patch(
    "/my-inventory/:productId",
    {
      preHandler: [options.authMiddleware, options.rateLimitMiddleware]
    },
    async (request, reply) => {
      const params = request.params as { productId: string };
      const payload = updateMyInventorySchema.parse(request.body);
      const response = await options.inventoryService.updateMyInventory(
        request.auth.companyId,
        params.productId,
        payload.custom_stock_quantity
      );

      return reply.status(200).send(response);
    }
  );
};
