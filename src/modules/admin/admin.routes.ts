import { FastifyPluginAsync, preHandlerHookHandler } from "fastify";

import {
  createCompanySchema,
  issueApiKeySchema,
  updateAdminInventorySchema,
  updateCostSettingsSchema,
  updateCompanySchema,
  updateCompanyStatusSchema
} from "./admin.schemas";
import { AdminService } from "./admin.service";

type AdminRoutesOptions = {
  adminGuard: preHandlerHookHandler;
  adminService: AdminService;
};

export const adminRoutes: FastifyPluginAsync<AdminRoutesOptions> = async (app, options) => {
  app.get(
    "/cost-settings",
    {
      preHandler: options.adminGuard
    },
    async (_request, reply) => {
      const settings = await options.adminService.getCostSettings();
      return reply.send(settings);
    }
  );

  app.patch(
    "/cost-settings",
    {
      preHandler: options.adminGuard
    },
    async (request, reply) => {
      const payload = updateCostSettingsSchema.parse(request.body);
      const settings = await options.adminService.updateCostSettings(payload);
      return reply.send(settings);
    }
  );

  app.get(
    "/cost-settings/history",
    {
      preHandler: options.adminGuard
    },
    async (_request, reply) => {
      const history = await options.adminService.listCostSettingsHistory();
      return reply.send(history);
    }
  );

  app.get(
    "/companies",
    {
      preHandler: options.adminGuard
    },
    async (_request, reply) => {
      const companies = await options.adminService.listCompanies();
      return reply.send({ data: companies });
    }
  );

  app.post(
    "/companies",
    {
      preHandler: options.adminGuard
    },
    async (request, reply) => {
      const payload = createCompanySchema.parse(request.body);
      const company = await options.adminService.createCompany(payload);
      return reply.status(201).send({ data: company });
    }
  );

  app.patch(
    "/companies/:companyId",
    {
      preHandler: options.adminGuard
    },
    async (request, reply) => {
      const params = request.params as { companyId: string };
      const payload = updateCompanySchema.parse(request.body);
      const company = await options.adminService.updateCompany(params.companyId, payload);
      return reply.send({ data: company });
    }
  );

  app.get(
    "/companies/:companyId/api-keys",
    {
      preHandler: options.adminGuard
    },
    async (request, reply) => {
      const params = request.params as { companyId: string };
      const apiKeys = await options.adminService.listCompanyApiKeys(params.companyId);
      return reply.send({ data: apiKeys });
    }
  );

  app.patch(
    "/companies/:companyId/status",
    {
      preHandler: options.adminGuard
    },
    async (request, reply) => {
      const params = request.params as { companyId: string };
      const payload = updateCompanyStatusSchema.parse(request.body);
      const company = await options.adminService.updateCompanyStatus(
        params.companyId,
        payload.isActive
      );
      return reply.send({ data: company });
    }
  );

  app.get(
    "/companies/:companyId/inventory",
    {
      preHandler: options.adminGuard
    },
    async (request, reply) => {
      const params = request.params as { companyId: string };
      const inventory = await options.adminService.listCompanyInventory(params.companyId);
      return reply.send(inventory);
    }
  );

  app.put(
    "/companies/:companyId/inventory/:productId",
    {
      preHandler: options.adminGuard
    },
    async (request, reply) => {
      const params = request.params as { companyId: string; productId: string };
      const payload = updateAdminInventorySchema.parse(request.body);
      const inventory = await options.adminService.updateCompanyInventory(
        params.companyId,
        params.productId,
        payload.customStockQuantity
      );
      return reply.send(inventory);
    }
  );

  app.post(
    "/api-keys",
    {
      preHandler: options.adminGuard
    },
    async (request, reply) => {
      const payload = issueApiKeySchema.parse(request.body);
      const apiKey = await options.adminService.issueApiKey(
        payload.companyId,
        payload.rateLimitPerMinute
      );
      return reply.status(201).send({ data: apiKey });
    }
  );

  app.patch(
    "/api-keys/:apiKeyId/revoke",
    {
      preHandler: options.adminGuard
    },
    async (request, reply) => {
      const params = request.params as { apiKeyId: string };
      const apiKey = await options.adminService.revokeApiKey(params.apiKeyId);
      return reply.send({ data: apiKey });
    }
  );
};
