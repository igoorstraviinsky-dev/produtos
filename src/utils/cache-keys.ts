export function buildProductsCacheKey() {
  return "products:list:v1";
}

export function buildProductsMetaCacheKey() {
  return "products:meta:v1";
}

export function buildProductsResponseCachePrefix() {
  return "products:response:v1";
}

export function buildProductsResponseCacheKey(filters: {
  laborRateTableId?: string;
  laborRateId?: string;
}) {
  const laborRateTableId = filters.laborRateTableId ?? "all";
  const laborRateId = filters.laborRateId ?? "all";
  return `${buildProductsResponseCachePrefix()}:lrt=${laborRateTableId}:lr=${laborRateId}`;
}

export function buildCompanyCatalogCachePrefix(companyId?: string) {
  return companyId ? `company-catalog:v1:${companyId}` : "company-catalog:v1";
}

export function buildCompanyCatalogCacheKey(
  companyId: string,
  filters: {
    laborRateTableId?: string;
    laborRateId?: string;
  }
) {
  const laborRateTableId = filters.laborRateTableId ?? "all";
  const laborRateId = filters.laborRateId ?? "all";
  return `${buildCompanyCatalogCachePrefix(companyId)}:lrt=${laborRateTableId}:lr=${laborRateId}`;
}

export function buildRateLimitKey(companyId: string, apiKeyId: string, now = new Date()) {
  const year = now.getUTCFullYear();
  const month = `${now.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${now.getUTCDate()}`.padStart(2, "0");
  const hour = `${now.getUTCHours()}`.padStart(2, "0");
  const minute = `${now.getUTCMinutes()}`.padStart(2, "0");
  return `rl:${companyId}:${apiKeyId}:${year}${month}${day}${hour}${minute}`;
}

export function secondsUntilNextMinute(now = new Date()) {
  return 60 - now.getUTCSeconds();
}
