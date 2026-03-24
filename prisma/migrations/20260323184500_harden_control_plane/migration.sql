ALTER TABLE "companies"
  ADD CONSTRAINT "companies_external_code_not_blank"
  CHECK (length(btrim("external_code")) > 0);

ALTER TABLE "api_keys"
  ADD CONSTRAINT "api_keys_key_prefix_not_blank"
  CHECK (length(btrim("key_prefix")) > 0),
  ADD CONSTRAINT "api_keys_rate_limit_positive"
  CHECK ("rate_limit_per_minute" > 0);
