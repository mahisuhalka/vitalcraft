alter table public.event_registration_settings
  add column results_published_at timestamptz;

create table public.submission_reviews (
  submission_id uuid primary key references public.idea_submissions(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  decision text not null default 'pending' check (decision in ('pending', 'shortlisted', 'not_selected')),
  internal_notes text not null default '' check (char_length(internal_notes) <= 3000),
  updated_at timestamptz not null default now()
);

create table public.submission_results (
  submission_id uuid primary key,
  team_id uuid not null,
  decision text not null check (decision in ('shortlisted', 'not_selected')),
  published_at timestamptz not null default now(),
  attendance_response text not null default 'not_applicable' check (attendance_response in ('pending', 'confirmed', 'declined', 'not_applicable')),
  attendance_responded_at timestamptz,
  foreign key (submission_id, team_id) references public.idea_submissions(id, team_id) on delete cascade,
  check (
    (decision = 'shortlisted' and attendance_response in ('pending', 'confirmed', 'declined'))
    or (decision = 'not_selected' and attendance_response = 'not_applicable')
  )
);

create index submission_reviews_decision_idx on public.submission_reviews(decision, updated_at desc);
create index submission_results_team_idx on public.submission_results(team_id);

alter table public.submission_reviews enable row level security;
alter table public.submission_results enable row level security;

revoke all on public.submission_reviews, public.submission_results from public, anon, authenticated;
grant all on public.submission_reviews, public.submission_results to service_role;

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
    where om.user_id = (select auth.uid())
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

create or replace function public.save_organizer_submission_review(
  p_submission_id uuid,
  p_decision text,
  p_internal_notes text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'Sign in is required.';
  end if;
  if not exists (
    select 1 from public.organizer_members om
    where om.user_id = v_user and om.role in ('reviewer', 'admin')
  ) then
    raise exception 'Organizer access is required.';
  end if;
  if exists (
    select 1 from public.event_registration_settings e
    where e.id = true and e.results_published_at is not null
  ) then
    raise exception 'Unpublish results before changing decisions.';
  end if;
  if coalesce(p_decision, '') not in ('pending', 'shortlisted', 'not_selected') then
    raise exception 'Choose a valid review decision.';
  end if;
  if char_length(coalesce(p_internal_notes, '')) > 3000 then
    raise exception 'Review notes must be 3000 characters or fewer.';
  end if;
  if not exists (
    select 1 from public.idea_submissions s
    where s.id = p_submission_id and s.status in ('submitted', 'under_review')
  ) then
    raise exception 'This submitted idea is unavailable.';
  end if;

  insert into public.submission_reviews (submission_id, reviewer_id, decision, internal_notes, updated_at)
  values (p_submission_id, v_user, p_decision, coalesce(p_internal_notes, ''), now())
  on conflict (submission_id) do update
    set reviewer_id = excluded.reviewer_id,
        decision = excluded.decision,
        internal_notes = excluded.internal_notes,
        updated_at = now();

  update public.idea_submissions
  set status = 'under_review', updated_at = now()
  where id = p_submission_id and status = 'submitted';
end;
$$;

create or replace function public.publish_submission_results()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_published_at timestamptz := now();
begin
  if v_user is null then
    raise exception 'Sign in is required.';
  end if;
  if not exists (
    select 1 from public.organizer_members om
    where om.user_id = v_user and om.role = 'admin'
  ) then
    raise exception 'Administrator access is required to publish results.';
  end if;
  if exists (
    select 1 from public.event_registration_settings e
    where e.id = true and e.results_published_at is not null
  ) then
    raise exception 'Results are already published.';
  end if;
  if not exists (
    select 1 from public.idea_submissions s
    where s.status in ('submitted', 'under_review')
  ) then
    raise exception 'There are no submitted ideas to publish.';
  end if;
  if exists (
    select 1
    from public.idea_submissions s
    left join public.submission_reviews r on r.submission_id = s.id
    where s.status in ('submitted', 'under_review')
      and (r.submission_id is null or r.decision = 'pending')
  ) then
    raise exception 'Review every submitted idea before publishing results.';
  end if;

  insert into public.submission_results (
    submission_id, team_id, decision, published_at, attendance_response, attendance_responded_at
  )
  select
    s.id,
    s.team_id,
    r.decision,
    v_published_at,
    case when r.decision = 'shortlisted' then 'pending' else 'not_applicable' end,
    null
  from public.idea_submissions s
  join public.submission_reviews r on r.submission_id = s.id
  where s.status in ('submitted', 'under_review')
  on conflict (submission_id) do update
    set team_id = excluded.team_id,
        decision = excluded.decision,
        published_at = excluded.published_at,
        attendance_response = case
          when public.submission_results.decision = 'shortlisted' and excluded.decision = 'shortlisted'
            then public.submission_results.attendance_response
          when excluded.decision = 'shortlisted' then 'pending'
          else 'not_applicable'
        end,
        attendance_responded_at = case
          when public.submission_results.decision = 'shortlisted' and excluded.decision = 'shortlisted'
            then public.submission_results.attendance_responded_at
          else null
        end;

  update public.event_registration_settings
  set results_published_at = v_published_at, updated_at = v_published_at
  where id = true;
  if not found then
    raise exception 'Event settings are unavailable.';
  end if;
  return v_published_at;
end;
$$;

create or replace function public.unpublish_submission_results()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'Sign in is required.';
  end if;
  if not exists (
    select 1 from public.organizer_members om
    where om.user_id = v_user and om.role = 'admin'
  ) then
    raise exception 'Administrator access is required to unpublish results.';
  end if;
  update public.event_registration_settings
  set results_published_at = null, updated_at = now()
  where id = true;
  if not found then
    raise exception 'Event settings are unavailable.';
  end if;
end;
$$;

create or replace function public.get_my_submission_result()
returns table (
  decision text,
  published_at timestamptz,
  attendance_response text,
  attendance_responded_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'Sign in is required.';
  end if;
  return query
  select r.decision, e.results_published_at, r.attendance_response, r.attendance_responded_at
  from public.submission_results r
  join public.teams t on t.id = r.team_id and t.captain_id = v_user
  join public.event_registration_settings e on e.id = true and e.results_published_at is not null
  limit 1;
end;
$$;

create or replace function public.respond_to_submission_result(p_response text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_team_id uuid;
begin
  if v_user is null then
    raise exception 'Sign in is required.';
  end if;
  if coalesce(p_response, '') not in ('confirmed', 'declined') then
    raise exception 'Choose a valid attendance response.';
  end if;
  select t.id into v_team_id
  from public.teams t
  join public.submission_results r on r.team_id = t.id
  join public.event_registration_settings e on e.id = true and e.results_published_at is not null
  where t.captain_id = v_user and r.decision = 'shortlisted'
  limit 1;
  if v_team_id is null then
    raise exception 'A published shortlist result is required to respond.';
  end if;
  update public.submission_results
  set attendance_response = p_response, attendance_responded_at = now()
  where team_id = v_team_id and decision = 'shortlisted';
end;
$$;

revoke all on function public.get_organizer_submission_queue() from public, anon;
revoke all on function public.save_organizer_submission_review(uuid, text, text) from public, anon;
revoke all on function public.publish_submission_results() from public, anon;
revoke all on function public.unpublish_submission_results() from public, anon;
revoke all on function public.get_my_submission_result() from public, anon;
revoke all on function public.respond_to_submission_result(text) from public, anon;
grant execute on function public.get_organizer_submission_queue() to authenticated;
grant execute on function public.save_organizer_submission_review(uuid, text, text) to authenticated;
grant execute on function public.publish_submission_results() to authenticated;
grant execute on function public.unpublish_submission_results() to authenticated;
grant execute on function public.get_my_submission_result() to authenticated;
grant execute on function public.respond_to_submission_result(text) to authenticated;

revoke all on function public.get_organizer_submission_queue() from public, anon;
revoke all on function public.save_organizer_submission_review(uuid, text, text) from public, anon;
revoke all on function public.publish_submission_results() from public, anon;
revoke all on function public.unpublish_submission_results() from public, anon;
revoke all on function public.get_my_submission_result() from public, anon;
revoke all on function public.respond_to_submission_result(text) from public, anon;
