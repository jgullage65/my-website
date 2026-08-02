CREATE TABLE IF NOT EXISTS public_api_rate_limit_leases (
  scope text NOT NULL,
  subject_hash text NOT NULL,
  lease_id uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT NOW(),
  released_at timestamptz,
  PRIMARY KEY (scope, subject_hash, lease_id)
);

CREATE INDEX IF NOT EXISTS public_api_rate_limit_leases_usage_idx
  ON public_api_rate_limit_leases (scope, subject_hash, requested_at DESC);
