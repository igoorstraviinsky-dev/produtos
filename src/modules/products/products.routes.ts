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
  const readFilters = (query: Record<string, unknown>) => ({
    laborRateTableId:
      typeof query.laborRateTableId === "string" && query.laborRateTableId.trim().length > 0
        ? query.laborRateTableId.trim()
        : undefined,
    laborRateId:
      typeof query.laborRateId === "string" && query.laborRateId.trim().length > 0
        ? query.laborRateId.trim()
        : undefined
  });

  app.get(
    "/products",
    {
      preHandler: [options.authMiddleware, options.rateLimitMiddleware]
    },
    async (request, reply) => {
      const response = await options.productsService.listProducts(
        readFilters(request.query as Record<string, unknown>)
      );
      return reply.status(200).send(response);
    }
  );

  app.get(
    "/companyid",
    {
      preHandler: [options.authMiddleware, options.rateLimitMiddleware]
    },
    async (request, reply) => {
      const response = await options.productsService.listCompanyCatalog(
        request.auth,
        readFilters(request.query as Record<string, unknown>)
      );
      return reply.status(200).send(response);
    }
  );
};
