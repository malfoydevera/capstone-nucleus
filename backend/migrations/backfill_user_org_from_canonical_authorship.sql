-- Backfill user organization scope from canonical authorship when the mapping is deterministic.
-- Safe scope:
-- - student users only
-- - currently missing both department_id and program_id
-- - all canonical authorship rows point to exactly one department and one program

with deterministic_authorship_scope as (
  select
    ra.user_id,
    min(rp.department_id::text)::uuid as department_id,
    min(rp.program_id::text)::uuid as program_id
  from public.research_authors ra
  join public.research_papers rp on rp.id = ra.research_id
  where rp.department_id is not null
    and rp.program_id is not null
  group by ra.user_id
  having count(distinct rp.department_id) = 1
     and count(distinct rp.program_id) = 1
)
update public.users u
set
  department_id = scope.department_id,
  program_id = scope.program_id,
  department = d.name,
  program = p.name,
  updated_at = now()
from deterministic_authorship_scope scope
join public.departments d on d.id = scope.department_id
join public.programs p on p.id = scope.program_id
where u.id = scope.user_id
  and u.role = 'student'
  and u.department_id is null
  and u.program_id is null;
