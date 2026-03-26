import { FastifyPluginAsync } from "fastify";

import { AppError } from "../../middleware/error-handler";
import { ProductMediaService } from "./media.service";

type MediaRoutesOptions = {
  mediaService: ProductMediaService;
};

type MediaRouteParams = {
  "*": string;
};

export const mediaRoutes: FastifyPluginAsync<MediaRoutesOptions> = async (app, options) => {
  app.get<{
    Params: MediaRouteParams;
  }>("/media/object/*", async (request, reply) => {
    const rawStorageKey = request.params["*"];

    if (!rawStorageKey) {
      throw new AppError(400, "INVALID_MEDIA_KEY", "Storage key is required");
    }

    let storageKey: string;
    try {
      storageKey = decodeURIComponent(rawStorageKey);
    } catch {
      throw new AppError(400, "INVALID_MEDIA_KEY", "Storage key encoding is invalid");
    }

    if (!storageKey.trim()) {
      throw new AppError(400, "INVALID_MEDIA_KEY", "Storage key is required");
    }

    const object = await options.mediaService.getObjectByStorageKey(storageKey);

    reply.header("Cache-Control", object.cacheControl);
    reply.header("Content-Type", object.contentType);

    if (object.contentLength) {
      reply.header("Content-Length", object.contentLength);
    }

    if (object.etag) {
      reply.header("ETag", object.etag);
    }

    if (object.lastModified) {
      reply.header("Last-Modified", object.lastModified);
    }

    return reply.send(object.body);
  });
};
