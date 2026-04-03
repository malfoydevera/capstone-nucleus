-- System-wide policy settings for upload constraints and file type rules
CREATE TABLE IF NOT EXISTS system_policy_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
  max_file_size_mb INTEGER NOT NULL DEFAULT 10 CHECK (max_file_size_mb > 0 AND max_file_size_mb <= 100),
  allowed_file_types TEXT[] NOT NULL DEFAULT ARRAY['pdf']::TEXT[],
  updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO system_policy_settings (id, max_file_size_mb, allowed_file_types)
VALUES (TRUE, 10, ARRAY['pdf']::TEXT[])
ON CONFLICT (id) DO NOTHING;
