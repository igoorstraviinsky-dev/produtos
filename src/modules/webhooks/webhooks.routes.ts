import { FastifyPluginAsync, preHandlerHookHandler } from "fastify";

import { WebhooksService } from "./webhooks.service";
import { supabaseSyncWebhookSchema } from "./webhooks.schemas";

type WebhooksRoutesOptions = {
  webhookGuard: preHandlerHookHandler;
  webhooksService: WebhooksService;
};

export const webhooksRoutes: FastifyPluginAsync<WebhooksRoutesOptions> = async (
  app,
  options
) => {
  app.post(
    "/webhooks/supabase-sync",
    {
      preHandler: options.webhookGuard
    },
    async (request, reply) => {
      supabaseSyncWebhookSchema.parse(request.body ?? {});
      const response = await options.webhooksService.syncMasterCatalog();
      return reply.status(200).send(response);
    }
  );
};
