BEGIN;

-- ---------------------------------------------------------------------------
-- research_papers: collapse duplicate permissive policies and avoid per-row
-- auth function re-evaluation where possible.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Faculty can view assigned papers" ON public.research_papers;
DROP POLICY IF EXISTS "Public can view published papers" ON public.research_papers;
DROP POLICY IF EXISTS "Staff and Admin can read all research" ON public.research_papers;
DROP POLICY IF EXISTS "Staff and Admin can view all" ON public.research_papers;
DROP POLICY IF EXISTS "Students can read own submissions" ON public.research_papers;
DROP POLICY IF EXISTS "Users can view own papers" ON public.research_papers;

DROP POLICY IF EXISTS "Faculty can update assigned papers" ON public.research_papers;
DROP POLICY IF EXISTS "Staff and Admin can update papers" ON public.research_papers;
DROP POLICY IF EXISTS "Staff and Admin can update research" ON public.research_papers;
DROP POLICY IF EXISTS "Students can update own pending research" ON public.research_papers;
DROP POLICY IF EXISTS "Users can update own papers" ON public.research_papers;

DROP POLICY IF EXISTS "Students can insert research" ON public.research_papers;
DROP POLICY IF EXISTS "Users can insert own papers" ON public.research_papers;

CREATE POLICY "Public can view published papers"
  ON public.research_papers
  FOR SELECT
  TO public
  USING ((status)::text = 'approved'::text);

CREATE POLICY "Users can view own papers"
  ON public.research_papers
  FOR SELECT
  TO public
  USING ((select auth.uid()) = author_id);

CREATE POLICY "Faculty can view assigned papers"
  ON public.research_papers
  FOR SELECT
  TO public
  USING ((select auth.uid()) = faculty_id);

CREATE POLICY "Staff and Admin can view all research"
  ON public.research_papers
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE users.id = (select auth.uid())
        AND (users.role)::text = ANY ((ARRAY['staff'::varchar, 'admin'::varchar])::text[])
    )
  );

CREATE POLICY "Users can insert own papers"
  ON public.research_papers
  FOR INSERT
  TO public
  WITH CHECK ((select auth.uid()) = author_id);

CREATE POLICY "Users can update own pending research"
  ON public.research_papers
  FOR UPDATE
  TO public
  USING (
    (select auth.uid()) = author_id
    AND (status)::text = ANY ((ARRAY['pending'::varchar, 'revision_required'::varchar])::text[])
  )
  WITH CHECK ((select auth.uid()) = author_id);

CREATE POLICY "Faculty can update assigned papers"
  ON public.research_papers
  FOR UPDATE
  TO public
  USING (
    (select auth.uid()) = faculty_id
    AND (status)::text = 'pending_faculty'::text
  )
  WITH CHECK ((select auth.uid()) = faculty_id);

CREATE POLICY "Staff and Admin can update research"
  ON public.research_papers
  FOR UPDATE
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE users.id = (select auth.uid())
        AND (users.role)::text = ANY ((ARRAY['staff'::varchar, 'admin'::varchar])::text[])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE users.id = (select auth.uid())
        AND (users.role)::text = ANY ((ARRAY['staff'::varchar, 'admin'::varchar])::text[])
    )
  );

-- ---------------------------------------------------------------------------
-- notifications: keep semantics, use select auth.uid() pattern.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;

CREATE POLICY "Users can read own notifications"
  ON public.notifications
  FOR SELECT
  TO public
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can update own notifications"
  ON public.notifications
  FOR UPDATE
  TO public
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- research_comments: keep semantics, use select auth.uid() pattern.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can insert comments" ON public.research_comments;
DROP POLICY IF EXISTS "Users can read comments" ON public.research_comments;

CREATE POLICY "Users can read comments"
  ON public.research_comments
  FOR SELECT
  TO public
  USING (
    (NOT is_internal) OR (
      EXISTS (
        SELECT 1
        FROM public.users
        WHERE users.id = (select auth.uid())
          AND (users.role)::text = ANY ((ARRAY['staff'::varchar, 'admin'::varchar])::text[])
      )
    )
  );

CREATE POLICY "Users can insert comments"
  ON public.research_comments
  FOR INSERT
  TO public
  WITH CHECK (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- approval_workflow: keep semantics, use select auth.uid() pattern.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Staff and Admin can insert approvals" ON public.approval_workflow;

CREATE POLICY "Staff and Admin can insert approvals"
  ON public.approval_workflow
  FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE users.id = (select auth.uid())
        AND (users.role)::text = ANY ((ARRAY['staff'::varchar, 'admin'::varchar])::text[])
    )
  );

COMMIT;
