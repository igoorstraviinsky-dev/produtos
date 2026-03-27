import { FastifyPluginAsync, preHandlerHookHandler } from "fastify";

import { ProductsAdminService } from "./products.admin.service";
import { updateInventoryProductSchema } from "./products.admin.schemas";

type ProductsAdminRoutesOptions = {
  adminGuard: preHandlerHookHandler;
  productsAdminService: ProductsAdminService;
};

export const productsAdminRoutes: FastifyPluginAsync<ProductsAdminRoutesOptions> = async (
  app,
  options
) => {
  app.post(
    "/products/sync",
    {
      preHandler: options.adminGuard
    },
    async (_request, reply) => {
      const syncResult = await options.productsAdminService.syncMasterCatalog();
      return reply.send(syncResult);
    }
  );

  app.get(
    "/products",
    {
      preHandler: options.adminGuard
    },
    async (request, reply) => {
      const query = request.query as { companyId?: string };
      const products = await options.productsAdminService.listProducts(query.companyId);
      return reply.send({ data: products });
    }
  );

  app.patch(
    "/products/:productId",
    {
      preHandler: options.adminGuard
    },
    async (request, reply) => {
      const params = request.params as { productId: string };
      const query = request.query as { companyId?: string };
      const payload = updateInventoryProductSchema.parse(request.body);
      const product = await options.productsAdminService.updateProduct({
        id: params.productId,
        sku: payload.sku,
        name: payload.name,
        availableQuantity: payload.availableQuantity
      }, query.companyId);
      return reply.send({ data: product });
    }
  );
};
