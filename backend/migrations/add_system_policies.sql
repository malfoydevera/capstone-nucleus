-- Historical reconciliation migration.
-- Captures the legacy system_policies table that still exists in production.

CREATE TABLE IF NOT EXISTS public.system_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key varchar NOT NULL UNIQUE,
  policy_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_by uuid REFERENCES public.users(id),
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS system_policies_policy_key_key
  ON public.system_policies(policy_key);
