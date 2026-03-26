import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { Readable } from "node:stream";

import { SupabaseClient } from "@supabase/supabase-js";

import { AppEnv } from "../../config/env";
import { AppError } from "../../middleware/error-handler";

const LONG_LIVED_CACHE_CONTROL = "public, max-age=31536000, immutable";
const MEDIA_ROUTE_PREFIX = "/api/v1/media/object";

const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

type StorageIntegrationRow = {
  provider?: string | null;
  aws_default_region?: string | null;
  s3_bronze_bucket?: string | null;
  s3_gold_bucket?: string | null;
  cloudfront_domain?: string | null;
  is_active?: boolean | null;
};

export type ProductMediaAssetRecord = {
  id: string;
  role: string;
  storage_key: string;
  storageKey: string;
  sort_order: number;
  sortOrder: number;
  url: string | null;
  created_at: string | null;
  createdAt: string | null;
};

export type ProductMediaObject = {
  body: NodeJS.ReadableStream;
  cacheControl: string;
  contentLength: string | null;
  contentType: string;
  etag: string | null;
  lastModified: string | null;
};

export interface ProductMediaService {
  getObjectByStorageKey(storageKey: string): Promise<ProductMediaObject>;
}

function joinUrlSegments(baseUrl: string, relativePath: string) {
  return new URL(relativePath.replace(/^\/+/, ""), `${baseUrl.replace(/\/+$/, "")}/`).toString();
}

function sanitizeCloudfrontDomain(domain: string) {
  return domain.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

function normalizeStorageKey(storageKey: string) {
  return storageKey.replace(/^\/+/, "");
}

export function inferMediaContentType(storageKey: string) {
  return MIME_TYPES_BY_EXTENSION[extname(storageKey).toLowerCase()] ?? "application/octet-stream";
}

export function buildStableProductMediaPath(storageKey: string) {
  return `${MEDIA_ROUTE_PREFIX}/${encodeURIComponent(storageKey)}`;
}

export function buildStableProductMediaUrl(storageKey: string, env: Pick<AppEnv, "PUBLIC_BASE_URL">) {
  const routePath = buildStableProductMediaPath(storageKey);

  if (!env.PUBLIC_BASE_URL) {
    return routePath;
  }

  return joinUrlSegments(env.PUBLIC_BASE_URL, routePath);
}

export class SupabaseProductMediaService implements ProductMediaService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly env: Pick<AppEnv, "LOCAL_MEDIA_ROOT">
  ) {}

  async getObjectByStorageKey(storageKey: string): Promise<ProductMediaObject> {
    if (storageKey.startsWith("local:")) {
      return this.getLocalObject(storageKey);
    }

    return this.getRemoteObject(storageKey);
  }

  private async getRemoteObject(storageKey: string): Promise<ProductMediaObject> {
    const remoteUrl = await this.resolveRemoteObjectUrl(storageKey);
    const response = await fetch(remoteUrl);

    if (response.status === 404) {
      throw new AppError(404, "MEDIA_NOT_FOUND", "Media object not found");
    }

    if (!response.ok) {
      throw new AppError(
        502,
        "MEDIA_UPSTREAM_UNAVAILABLE",
        "Could not fetch the media object from the storage origin",
        {
          status: response.status,
          storageKey
        }
      );
    }

    return {
      body: response.body
        ? Readable.fromWeb(response.body as globalThis.ReadableStream)
        : Readable.from(Buffer.alloc(0)),
      cacheControl: LONG_LIVED_CACHE_CONTROL,
      contentLength: response.headers.get("content-length"),
      contentType: response.headers.get("content-type") ?? inferMediaContentType(storageKey),
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified")
    };
  }

  private async resolveRemoteObjectUrl(storageKey: string) {
    const { data, error } = await this.supabase
      .from("storage_integration_configs")
      .select(
        "provider, aws_default_region, s3_bronze_bucket, s3_gold_bucket, cloudfront_domain, is_active"
      )
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new AppError(
        503,
        "MEDIA_CONFIGURATION_UNAVAILABLE",
        "Storage integration configuration is unavailable",
        {
          cause: error.message
        }
      );
    }

    const config = data as StorageIntegrationRow | null;
    const normalizedStorageKey = normalizeStorageKey(storageKey);

    if (config?.cloudfront_domain) {
      return `https://${sanitizeCloudfrontDomain(config.cloudfront_domain)}/${normalizedStorageKey}`;
    }

    const bucketName = config?.s3_bronze_bucket ?? config?.s3_gold_bucket ?? null;
    if (config?.provider === "s3" && bucketName) {
      const region = config.aws_default_region?.trim() || "us-east-2";
      return `https://${bucketName}.s3.${region}.amazonaws.com/${normalizedStorageKey}`;
    }

    throw new AppError(
      503,
      "MEDIA_CONFIGURATION_UNAVAILABLE",
      "No stable public media origin is configured for the storage backend",
      {
        storageKey
      }
    );
  }

  private async getLocalObject(storageKey: string): Promise<ProductMediaObject> {
    const localRoot = resolve(this.env.LOCAL_MEDIA_ROOT ?? process.cwd());
    const relativePath = storageKey.slice("local:".length).replace(/^[/\\]+/, "");
    const filePath = resolve(localRoot, relativePath);
    const isInsideRoot = filePath === localRoot || filePath.startsWith(`${localRoot}\\`) || filePath.startsWith(`${localRoot}/`);

    if (!isInsideRoot) {
      throw new AppError(400, "INVALID_MEDIA_KEY", "Invalid local media key");
    }

    try {
      await access(filePath);
    } catch {
      throw new AppError(404, "MEDIA_NOT_FOUND", "Local media object not found");
    }

    return {
      body: createReadStream(filePath),
      cacheControl: LONG_LIVED_CACHE_CONTROL,
      contentLength: null,
      contentType: inferMediaContentType(filePath),
      etag: null,
      lastModified: null
    };
  }
}
