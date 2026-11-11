create or replace function public.get_organizer_registration_overview()
returns table (
  team_id uuid,
  registration_reference text,
  team_name text,
  team_college text,
  team_track text,
  team_size smallint,
  registered_at timestamptz,
  submission_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in is required.';
  end if;
  if not exists (
    select 1 from public.organizer_members om
    where om.user_id = (select auth.uid()) and om.role in ('reviewer', 'admin')
  ) then
    raise exception 'Organizer access is required.';
  end if;

  return query
  select
    t.id,
    t.registration_reference,
    t.team_name,
    t.college,
    t.track,
    t.team_size,
    t.registered_at,
    s.status
  from public.teams t
  left join public.idea_submissions s on s.team_id = t.id
  order by t.registered_at desc, t.team_name asc;
end;
$$;

revoke all on function public.get_organizer_registration_overview() from public, anon;
grant execute on function public.get_organizer_registration_overview() to authenticated;
