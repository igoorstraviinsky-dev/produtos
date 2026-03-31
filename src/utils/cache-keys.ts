export function buildProductsCacheKey() {
  return "products:list:v1";
}

export function buildProductsMetaCacheKey() {
  return "products:meta:v1";
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
