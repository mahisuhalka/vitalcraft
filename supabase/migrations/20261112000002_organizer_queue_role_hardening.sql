create or replace function public.get_organizer_submission_queue()
returns table (
  submission_id uuid,
  team_id uuid,
  team_name text,
  team_college text,
  team_track text,
  team_size smallint,
  members jsonb,
  challenge_id text,
  idea_title text,
  problem_statement text,
  intended_users text,
  proposed_solution text,
  technical_approach text,
  resources_and_stack text,
  planned_mvp text,
  demo_plan text,
  submission_status text,
  submitted_at timestamptz,
  deck_filename text,
  deck_path text,
  review_decision text,
  internal_notes text,
  reviewed_at timestamptz
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
    s.id,
    t.id,
    t.team_name,
    t.college,
    t.track,
    t.team_size,
    coalesce(member_data.members, '[]'::jsonb),
    s.challenge_id,
    s.idea_title,
    s.problem_statement,
    s.intended_users,
    s.proposed_solution,
    s.technical_approach,
    s.resources_and_stack,
    s.planned_mvp,
    s.demo_plan,
    s.status,
    s.submitted_at,
    d.original_filename,
    d.storage_path,
    coalesce(r.decision, 'pending'),
    coalesce(r.internal_notes, ''),
    r.updated_at
  from public.idea_submissions s
  join public.teams t on t.id = s.team_id
  left join public.submission_decks d on d.submission_id = s.id
  left join public.submission_reviews r on r.submission_id = s.id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object('name', tm.member_name, 'is_captain', tm.is_captain)
      order by tm.is_captain desc, tm.member_name
    ) as members
    from public.team_members tm
    where tm.team_id = t.id
  ) member_data on true
  where s.status in ('submitted', 'under_review')
  order by s.submitted_at asc nulls last, t.team_name asc;
end;
$$;
