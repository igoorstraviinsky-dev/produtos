import { createHmac, randomBytes } from "node:crypto";

const API_KEY_PREFIX = "b2b_";

export function generateApiKey() {
  return `${API_KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
}

export function deriveApiKeyPrefix(apiKey: string) {
  return apiKey.slice(0, 12);
}

export function hashApiKey(apiKey: string, pepper: string) {
  return createHmac("sha256", pepper).update(apiKey).digest("hex");
}
