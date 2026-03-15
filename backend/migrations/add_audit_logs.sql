-- Migration: Add Audit Logs and Dean Bypass support
-- Date: 2026-03-16
-- Description: Creates audit_logs table for comprehensive action tracking.
--              Adds bypass_reason and bypassed_by columns to research_papers.

-- ============================================
-- 1. Create audit_logs table
-- ============================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    user_role VARCHAR(50) NOT NULL,
    user_name VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),        -- 'research_paper', 'user', 'system'
    target_id UUID,
    details JSONB DEFAULT '{}',
    reason TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON public.audit_logs(target_type, target_id);

-- ============================================
-- 2. Add bypass columns to research_papers
-- ============================================

ALTER TABLE public.research_papers
  ADD COLUMN IF NOT EXISTS bypass_reason TEXT;

ALTER TABLE public.research_papers
  ADD COLUMN IF NOT EXISTS bypassed_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.research_papers
  ADD COLUMN IF NOT EXISTS bypassed_at TIMESTAMP WITH TIME ZONE;

-- ============================================
-- 3. Verification queries
-- ============================================
/*
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'audit_logs'
ORDER BY ordinal_position;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'research_papers'
  AND column_name IN ('bypass_reason', 'bypassed_by', 'bypassed_at');
*/
