import { FastifyBaseLogger } from "fastify";

import { ControlPlaneRepository, CostSettingsRecord } from "./postgres";

type CostSettingsCacheEntry = {
  cachedAt: string;
  data: CostSettingsRecord;
};

function buildCacheKey(companyId?: string) {
  return companyId ? `company:${companyId}` : "default";
}

export class CostSettingsCache {
  private readonly cache = new Map<string, CostSettingsCacheEntry>();
  private readonly inFlight = new Map<string, Promise<CostSettingsRecord>>();

  constructor(
    private readonly controlPlane: ControlPlaneRepository,
    private readonly ttlSeconds: number,
    private readonly staleSeconds: number,
    private readonly logger?: FastifyBaseLogger
  ) {}

  async resolve(companyId?: string): Promise<CostSettingsRecord> {
    const cacheKey = buildCacheKey(companyId);
    const now = Date.now();
    const cachedEntry = this.cache.get(cacheKey);

    if (cachedEntry && this.isFresh(cachedEntry, now)) {
      return cachedEntry.data;
    }

    const inFlight = this.inFlight.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const refresh = (async () => {
      try {
        const settings = await this.controlPlane.getCostSettings(companyId);
        this.cache.set(cacheKey, {
          cachedAt: new Date(now).toISOString(),
          data: settings
        });
        return settings;
      } catch (error) {
        if (cachedEntry && this.isServeableStale(cachedEntry, now)) {
          this.logger?.warn(
            {
              companyId: companyId ?? null,
              cause: error instanceof Error ? error.message : "unknown"
            },
            "serving stale cost settings cache after upstream failure"
          );
          return cachedEntry.data;
        }

        throw error;
      } finally {
        this.inFlight.delete(cacheKey);
      }
    })();

    this.inFlight.set(cacheKey, refresh);
    return refresh;
  }

  invalidate(companyId?: string) {
    this.cache.delete(buildCacheKey(companyId));
  }

  private isFresh(entry: CostSettingsCacheEntry, now: number) {
    return now - Date.parse(entry.cachedAt) <= this.ttlSeconds * 1000;
  }

  private isServeableStale(entry: CostSettingsCacheEntry, now: number) {
    return now - Date.parse(entry.cachedAt) <= (this.ttlSeconds + this.staleSeconds) * 1000;
  }
}
