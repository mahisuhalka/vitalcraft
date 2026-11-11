alter table public.event_registration_settings
  add column submission_opens_at timestamptz,
  add column submission_closes_at timestamptz,
  add constraint event_registration_submission_window_check
    check (submission_opens_at is null or submission_closes_at is null or submission_closes_at > submission_opens_at);

create table public.organizer_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('reviewer', 'admin')),
  added_at timestamptz not null default now()
);

create table public.idea_submissions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null unique references public.teams(id) on delete cascade,
  challenge_id text not null default '' check (challenge_id in ('', 'inclusive-wayfinding', 'everyday-sensing', 'accessible-routines', 'open-innovation')),
  idea_title text not null default '' check (char_length(idea_title) <= 120),
  problem_statement text not null default '' check (char_length(problem_statement) <= 2000),
  intended_users text not null default '' check (char_length(intended_users) <= 1000),
  proposed_solution text not null default '' check (char_length(proposed_solution) <= 2000),
  technical_approach text not null default '' check (char_length(technical_approach) <= 2000),
  resources_and_stack text not null default '' check (char_length(resources_and_stack) <= 1000),
  planned_mvp text not null default '' check (char_length(planned_mvp) <= 2000),
  demo_plan text not null default '' check (char_length(demo_plan) <= 1500),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'under_review')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, team_id),
  check ((status = 'draft' and submitted_at is null) or (status in ('submitted', 'under_review') and submitted_at is not null))
);

create table public.submission_decks (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique,
  team_id uuid not null,
  storage_path text not null unique,
  original_filename text not null check (char_length(original_filename) between 1 and 180),
  content_type text not null check (content_type in ('application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation')),
  file_size_bytes bigint not null check (file_size_bytes between 1 and 10485760),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  uploaded_at timestamptz not null default now(),
  foreign key (submission_id, team_id) references public.idea_submissions(id, team_id) on delete cascade
);

create table public.submission_upload_intents (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique,
  team_id uuid not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null check (char_length(original_filename) between 1 and 180),
  content_type text not null check (content_type in ('application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation')),
  expected_size_bytes bigint not null check (expected_size_bytes between 1 and 10485760),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (submission_id, team_id) references public.idea_submissions(id, team_id) on delete cascade
);

create index idea_submissions_status_idx on public.idea_submissions(status, updated_at desc);
create index submission_decks_team_id_idx on public.submission_decks(team_id);
create index submission_upload_intents_expires_at_idx on public.submission_upload_intents(expires_at);

alter table public.organizer_members enable row level security;
alter table public.idea_submissions enable row level security;
alter table public.submission_decks enable row level security;
alter table public.submission_upload_intents enable row level security;

create or replace function public.can_access_vitalcraft_team(p_team_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.teams t where t.id = p_team_id and (
      t.captain_id = (select auth.uid())
      or exists (select 1 from public.organizer_members om where om.user_id = (select auth.uid()))
    )
  );
$$;

create or replace function public.can_upload_vitalcraft_deck(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.submission_upload_intents i
    join public.idea_submissions s on s.id = i.submission_id and s.team_id = i.team_id
    join public.teams t on t.id = i.team_id
    where i.storage_path = p_path and i.created_by = (select auth.uid())
      and t.captain_id = (select auth.uid()) and i.expires_at > now() and s.status = 'draft'
      and not exists (select 1 from public.event_registration_settings e where e.id = true and e.submission_closes_at is not null and now() > e.submission_closes_at)
  );
$$;

create or replace function public.can_read_vitalcraft_deck(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.submission_decks d
    where d.storage_path = p_path and public.can_access_vitalcraft_team(d.team_id)
  );
$$;

create policy organizer_members_select_self on public.organizer_members
  for select to authenticated using (user_id = (select auth.uid()));
create policy idea_submissions_select_team_and_organizers on public.idea_submissions
  for select to authenticated using (public.can_access_vitalcraft_team(team_id));
create policy submission_decks_select_team_and_organizers on public.submission_decks
  for select to authenticated using (public.can_access_vitalcraft_team(team_id));
create policy submission_upload_intents_select_owner on public.submission_upload_intents
  for select to authenticated using (created_by = (select auth.uid()));

create or replace function public.save_idea_submission(
  p_submission_id uuid, p_challenge_id text, p_idea_title text,
  p_problem_statement text, p_intended_users text, p_proposed_solution text,
  p_technical_approach text, p_resources_and_stack text, p_planned_mvp text,
  p_demo_plan text, p_final boolean
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid()); v_team uuid; v_track text; v_id uuid;
  v_status text; v_open timestamptz; v_close timestamptz; v_challenge text := coalesce(trim(p_challenge_id), '');
begin
  if v_user is null then raise exception 'Sign in is required.'; end if;
  select id, track into v_team, v_track from public.teams where captain_id = v_user;
  if not found then raise exception 'A registered team is required.'; end if;
  if v_challenge <> '' and not (
    (v_track = 'hardware' and v_challenge = 'everyday-sensing')
    or (v_track = 'software' and v_challenge in ('inclusive-wayfinding', 'accessible-routines'))
    or (v_track = 'open' and v_challenge = 'open-innovation')
  ) then raise exception 'Choose a challenge for your registered track.'; end if;
  if char_length(v_challenge) > 64 or char_length(coalesce(trim(p_idea_title), '')) > 120
    or char_length(coalesce(trim(p_problem_statement), '')) > 2000
    or char_length(coalesce(trim(p_intended_users), '')) > 1000
    or char_length(coalesce(trim(p_proposed_solution), '')) > 2000
    or char_length(coalesce(trim(p_technical_approach), '')) > 2000
    or char_length(coalesce(trim(p_resources_and_stack), '')) > 1000
    or char_length(coalesce(trim(p_planned_mvp), '')) > 2000
    or char_length(coalesce(trim(p_demo_plan), '')) > 1500 then raise exception 'One or more fields exceed the allowed length.'; end if;
  select submission_opens_at, submission_closes_at into v_open, v_close
    from public.event_registration_settings where id = true;
  if not found then raise exception 'Submission settings are unavailable.'; end if;
  if v_close is not null and now() > v_close then raise exception 'The submission window is closed.'; end if;

  if p_final then
    select s.id, s.status into v_id, v_status from public.idea_submissions s
      where s.id = p_submission_id and s.team_id = v_team for update;
    if not found or v_status <> 'draft' then raise exception 'This submission is unavailable or locked.'; end if;
    if v_open is null or v_close is null or now() < v_open or now() > v_close then
      raise exception 'The final submission window is not open.';
    end if;
    if char_length(v_challenge) = 0 or char_length(coalesce(trim(p_idea_title), '')) not between 2 and 120
      or char_length(coalesce(trim(p_problem_statement), '')) not between 20 and 2000
      or char_length(coalesce(trim(p_intended_users), '')) not between 5 and 1000
      or char_length(coalesce(trim(p_proposed_solution), '')) not between 20 and 2000
      or char_length(coalesce(trim(p_technical_approach), '')) not between 20 and 2000
      or char_length(coalesce(trim(p_resources_and_stack), '')) not between 5 and 1000
      or char_length(coalesce(trim(p_planned_mvp), '')) not between 20 and 2000
      or char_length(coalesce(trim(p_demo_plan), '')) not between 10 and 1500 then
      raise exception 'Complete every required idea field before final submission.';
    end if;
    if not exists (select 1 from public.submission_decks d where d.submission_id = v_id and d.team_id = v_team) then
      raise exception 'Upload a valid pitch deck before final submission.';
    end if;
    update public.idea_submissions set challenge_id = v_challenge, idea_title = trim(p_idea_title),
      problem_statement = trim(p_problem_statement), intended_users = trim(p_intended_users),
      proposed_solution = trim(p_proposed_solution), technical_approach = trim(p_technical_approach),
      resources_and_stack = trim(p_resources_and_stack), planned_mvp = trim(p_planned_mvp),
      demo_plan = trim(p_demo_plan), status = 'submitted', submitted_at = now(), updated_at = now()
      where id = v_id returning id into v_id;
    return v_id;
  end if;

  insert into public.idea_submissions (team_id, challenge_id, idea_title, problem_statement, intended_users,
    proposed_solution, technical_approach, resources_and_stack, planned_mvp, demo_plan)
  values (v_team, v_challenge, coalesce(trim(p_idea_title), ''), coalesce(trim(p_problem_statement), ''),
    coalesce(trim(p_intended_users), ''), coalesce(trim(p_proposed_solution), ''),
    coalesce(trim(p_technical_approach), ''), coalesce(trim(p_resources_and_stack), ''),
    coalesce(trim(p_planned_mvp), ''), coalesce(trim(p_demo_plan), ''))
  on conflict (team_id) do update set challenge_id = excluded.challenge_id, idea_title = excluded.idea_title,
    problem_statement = excluded.problem_statement, intended_users = excluded.intended_users,
    proposed_solution = excluded.proposed_solution, technical_approach = excluded.technical_approach,
    resources_and_stack = excluded.resources_and_stack, planned_mvp = excluded.planned_mvp,
    demo_plan = excluded.demo_plan, updated_at = now()
  where public.idea_submissions.status = 'draft' returning id into v_id;
  if v_id is null then raise exception 'This submission is locked and can no longer be edited.'; end if;
  return v_id;
end;
$$;

create or replace function public.create_submission_upload_intent(p_submission_id uuid, p_original_filename text, p_size_bytes bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid()); v_team uuid; v_filename text := trim(coalesce(p_original_filename, ''));
  v_extension text; v_mime text; v_path text; v_close timestamptz;
begin
  if v_user is null then raise exception 'Sign in is required.'; end if;
  select s.team_id into v_team from public.idea_submissions s join public.teams t on t.id = s.team_id
    where s.id = p_submission_id and s.status = 'draft' and t.captain_id = v_user for update of s;
  if not found then raise exception 'Save a draft before uploading a deck.'; end if;
  select submission_closes_at into v_close from public.event_registration_settings where id = true;
  if not found then raise exception 'Submission settings are unavailable.'; end if;
  if v_close is not null and now() > v_close then raise exception 'The submission window is closed.'; end if;
  if char_length(v_filename) not between 1 and 180 or position('/' in v_filename) > 0 or position(chr(92) in v_filename) > 0 then
    raise exception 'Choose a valid PDF or PowerPoint file.';
  end if;
  if lower(v_filename) like '%.pdf' then v_extension := 'pdf'; v_mime := 'application/pdf';
  elsif lower(v_filename) like '%.pptx' then v_extension := 'pptx'; v_mime := 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  else raise exception 'Only PDF and PPTX files are accepted.'; end if;
  if p_size_bytes is null or p_size_bytes < 1 or p_size_bytes > 10485760 then raise exception 'The pitch deck must be 10 MB or smaller.'; end if;
  if exists (select 1 from public.submission_upload_intents where submission_id = p_submission_id) then
    raise exception 'A deck upload is already in progress. Try again shortly.';
  end if;
  v_path := v_team::text || '/' || gen_random_uuid()::text || '.' || v_extension;
  insert into public.submission_upload_intents (submission_id, team_id, created_by, storage_path, original_filename, content_type, expected_size_bytes, expires_at)
    values (p_submission_id, v_team, v_user, v_path, v_filename, v_mime, p_size_bytes, now() + interval '10 minutes');
  return jsonb_build_object('storage_path', v_path, 'content_type', v_mime);
end;
$$;

create or replace function public.guard_submission_deck_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.idea_submissions s join public.teams t on t.id = s.team_id
    where s.id = new.submission_id and s.team_id = new.team_id
      and s.status = 'draft' and t.captain_id = new.uploaded_by
  ) then raise exception 'This submission is locked or the deck owner is invalid.'; end if;
  return new;
end;
$$;
create trigger submission_decks_require_draft_owner
  before insert or update on public.submission_decks
  for each row execute function public.guard_submission_deck_write();
revoke all on function public.guard_submission_deck_write() from public, anon, authenticated;

create policy vitalcraft_pitch_decks_upload_intent on storage.objects
  for insert to authenticated with check (bucket_id = 'vitalcraft-pitch-decks' and public.can_upload_vitalcraft_deck(name));
create policy vitalcraft_pitch_decks_verified_read on storage.objects
  for select to authenticated using (bucket_id = 'vitalcraft-pitch-decks' and public.can_read_vitalcraft_deck(name));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vitalcraft-pitch-decks', 'vitalcraft-pitch-decks', false, 10485760,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']::text[]);

revoke all on public.organizer_members, public.idea_submissions, public.submission_decks, public.submission_upload_intents from anon, authenticated;
grant select on public.organizer_members, public.idea_submissions, public.submission_decks, public.submission_upload_intents to authenticated;
grant all on public.organizer_members, public.idea_submissions, public.submission_decks, public.submission_upload_intents to service_role;
revoke all on public.organizer_members, public.idea_submissions, public.submission_decks, public.submission_upload_intents from anon;

revoke all on function public.can_access_vitalcraft_team(uuid) from public, anon;
revoke all on function public.can_upload_vitalcraft_deck(text) from public, anon;
revoke all on function public.can_read_vitalcraft_deck(text) from public, anon;
revoke all on function public.save_idea_submission(uuid, text, text, text, text, text, text, text, text, text, boolean) from public, anon;
revoke all on function public.create_submission_upload_intent(uuid, text, bigint) from public, anon;
grant execute on function public.can_access_vitalcraft_team(uuid) to authenticated;
grant execute on function public.can_upload_vitalcraft_deck(text) to authenticated;
grant execute on function public.can_read_vitalcraft_deck(text) to authenticated;
grant execute on function public.save_idea_submission(uuid, text, text, text, text, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.create_submission_upload_intent(uuid, text, bigint) to authenticated;
