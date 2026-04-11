BEGIN;

DROP POLICY IF EXISTS "Public can view published papers" ON public.research_papers;
DROP POLICY IF EXISTS "Users can view own papers" ON public.research_papers;
DROP POLICY IF EXISTS "Faculty can view assigned papers" ON public.research_papers;
DROP POLICY IF EXISTS "Staff and Admin can view all research" ON public.research_papers;

DROP POLICY IF EXISTS "Users can update own pending research" ON public.research_papers;
DROP POLICY IF EXISTS "Faculty can update assigned papers" ON public.research_papers;
DROP POLICY IF EXISTS "Staff and Admin can update research" ON public.research_papers;

CREATE POLICY "Combined research read access"
  ON public.research_papers
  FOR SELECT
  TO public
  USING (
    (status)::text = 'approved'::text
    OR (select auth.uid()) = author_id
    OR (select auth.uid()) = faculty_id
    OR EXISTS (
      SELECT 1
      FROM public.users
      WHERE users.id = (select auth.uid())
        AND (users.role)::text = ANY ((ARRAY['staff'::varchar, 'admin'::varchar])::text[])
    )
  );

CREATE POLICY "Combined research update access"
  ON public.research_papers
  FOR UPDATE
  TO public
  USING (
    (
      (select auth.uid()) = author_id
      AND (status)::text = ANY ((ARRAY['pending'::varchar, 'revision_required'::varchar])::text[])
    )
    OR (
      (select auth.uid()) = faculty_id
      AND (status)::text = 'pending_faculty'::text
    )
    OR EXISTS (
      SELECT 1
      FROM public.users
      WHERE users.id = (select auth.uid())
        AND (users.role)::text = ANY ((ARRAY['staff'::varchar, 'admin'::varchar])::text[])
    )
  )
  WITH CHECK (
    (
      (select auth.uid()) = author_id
      AND (status)::text = ANY ((ARRAY['pending'::varchar, 'revision_required'::varchar])::text[])
    )
    OR (
      (select auth.uid()) = faculty_id
      AND (status)::text = 'pending_faculty'::text
    )
    OR EXISTS (
      SELECT 1
      FROM public.users
      WHERE users.id = (select auth.uid())
        AND (users.role)::text = ANY ((ARRAY['staff'::varchar, 'admin'::varchar])::text[])
    )
  );

COMMIT;
