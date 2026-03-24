import { FastifyPluginAsync, preHandlerHookHandler } from "fastify";

import { ProductsService } from "./products.service";

type ProductsRoutesOptions = {
  authMiddleware: preHandlerHookHandler;
  rateLimitMiddleware: preHandlerHookHandler;
  productsService: ProductsService;
};

export const productsRoutes: FastifyPluginAsync<ProductsRoutesOptions> = async (
  app,
  options
) => {
  app.get(
    "/products",
    {
      preHandler: [options.authMiddleware, options.rateLimitMiddleware]
    },
    async (_request, reply) => {
      const response = await options.productsService.listProducts();
      return reply.status(200).send(response);
    }
  );
};
