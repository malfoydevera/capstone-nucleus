-- =============================================================================
-- MIGRATION: Merge legacy system_policies into system_policy_settings
-- =============================================================================
-- Description:
--   Preserves the unused legacy system_policies key/value rows inside the
--   canonical settings table before retiring the redundant table.
-- =============================================================================

BEGIN;

ALTER TABLE public.system_policy_settings
ADD COLUMN IF NOT EXISTS legacy_policy_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO public.system_policy_settings (
  id,
  max_file_size_mb,
  allowed_file_types,
  legacy_policy_overrides,
  updated_at
)
SELECT
  true,
  10,
  ARRAY['pdf']::text[],
  '{}'::jsonb,
  now()
WHERE NOT EXISTS (
  SELECT 1
  FROM public.system_policy_settings
  WHERE id = true
);

UPDATE public.system_policy_settings
SET legacy_policy_overrides = COALESCE((
  SELECT jsonb_object_agg(
    policy_key,
    jsonb_build_object(
      'value', policy_value,
      'description', description
    )
  )
  FROM public.system_policies
), '{}'::jsonb),
updated_at = now()
WHERE id = true;

DROP TABLE IF EXISTS public.system_policies;

COMMIT;
