create or replace function public.create_submission_upload_intent(
  p_submission_id uuid,
  p_original_filename text,
  p_size_bytes bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_team uuid;
  v_filename text := trim(coalesce(p_original_filename, ''));
  v_extension text;
  v_mime text;
  v_path text;
  v_close timestamptz;
begin
  if v_user is null then
    raise exception 'Sign in is required.';
  end if;

  select s.team_id into v_team
  from public.idea_submissions s
  join public.teams t on t.id = s.team_id
  where s.id = p_submission_id
    and s.status = 'draft'
    and t.captain_id = v_user
  for update of s;

  if not found then
    raise exception 'Save a draft before uploading a deck.';
  end if;

  select submission_closes_at into v_close
  from public.event_registration_settings
  where id = true;

  if not found then
    raise exception 'Submission settings are unavailable.';
  end if;

  if v_close is not null and now() > v_close then
    raise exception 'The submission window is closed.';
  end if;

  if char_length(v_filename) not between 1 and 180
    or position('/' in v_filename) > 0
    or position(chr(92) in v_filename) > 0 then
    raise exception 'Choose a valid PDF or PowerPoint file.';
  end if;

  if lower(v_filename) like '%.pdf' then
    v_extension := 'pdf';
    v_mime := 'application/pdf';
  elsif lower(v_filename) like '%.pptx' then
    v_extension := 'pptx';
    v_mime := 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  else
    raise exception 'Only PDF and PPTX files are accepted.';
  end if;

  if p_size_bytes is null or p_size_bytes < 1 or p_size_bytes > 10485760 then
    raise exception 'The pitch deck must be 10 MB or smaller.';
  end if;

  delete from storage.objects o
  using public.submission_upload_intents i
  where i.submission_id = p_submission_id
    and i.expires_at <= now()
    and o.bucket_id = 'vitalcraft-pitch-decks'
    and o.name = i.storage_path;

  delete from public.submission_upload_intents
  where submission_id = p_submission_id and expires_at <= now();

  if exists (
    select 1 from public.submission_upload_intents
    where submission_id = p_submission_id
  ) then
    raise exception 'A deck upload is already in progress. Try again shortly.';
  end if;

  v_path := v_team::text || '/' || gen_random_uuid()::text || '.' || v_extension;

  insert into public.submission_upload_intents (
    submission_id, team_id, created_by, storage_path, original_filename,
    content_type, expected_size_bytes, expires_at
  ) values (
    p_submission_id, v_team, v_user, v_path, v_filename,
    v_mime, p_size_bytes, now() + interval '10 minutes'
  );

  return jsonb_build_object('storage_path', v_path, 'content_type', v_mime);
end;
$$;

create or replace function public.cancel_submission_upload_intent(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_intent_id uuid;
  v_path text;
begin
  if v_user is null then
    raise exception 'Sign in is required.';
  end if;

  select i.id, i.storage_path into v_intent_id, v_path
  from public.submission_upload_intents i
  join public.idea_submissions s on s.id = i.submission_id and s.team_id = i.team_id
  join public.teams t on t.id = i.team_id
  where i.submission_id = p_submission_id
    and i.created_by = v_user
    and t.captain_id = v_user
    and s.status = 'draft'
  for update of i;

  if not found then
    return;
  end if;

  delete from storage.objects
  where bucket_id = 'vitalcraft-pitch-decks' and name = v_path;

  delete from public.submission_upload_intents where id = v_intent_id;
end;
$$;

create or replace function public.finalize_submission_deck_upload(
  p_submission_id uuid,
  p_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_intent record;
  v_uploaded_mime text;
  v_uploaded_size bigint;
  v_previous_path text;
begin
  if v_user is null then
    raise exception 'Sign in is required.';
  end if;

  if p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'The deck fingerprint is invalid.';
  end if;

  select i.id, i.team_id, i.storage_path, i.original_filename,
    i.content_type, i.expected_size_bytes
  into v_intent
  from public.submission_upload_intents i
  join public.idea_submissions s on s.id = i.submission_id and s.team_id = i.team_id
  join public.teams t on t.id = i.team_id
  where i.submission_id = p_submission_id
    and i.created_by = v_user
    and t.captain_id = v_user
    and i.expires_at > now()
    and s.status = 'draft'
  for update of i, s;

  if not found then
    raise exception 'The upload expired or this submission is unavailable.';
  end if;

  select o.metadata ->> 'mimetype', nullif(o.metadata ->> 'size', '')::bigint
  into v_uploaded_mime, v_uploaded_size
  from storage.objects o
  where o.bucket_id = 'vitalcraft-pitch-decks'
    and o.name = v_intent.storage_path;

  if not found
    or v_uploaded_mime is distinct from v_intent.content_type
    or v_uploaded_size is distinct from v_intent.expected_size_bytes then
    raise exception 'The uploaded file did not match the approved file details.';
  end if;

  select storage_path into v_previous_path
  from public.submission_decks
  where submission_id = p_submission_id
  for update;

  if v_previous_path is not null and v_previous_path <> v_intent.storage_path then
    delete from storage.objects
    where bucket_id = 'vitalcraft-pitch-decks' and name = v_previous_path;
  end if;

  insert into public.submission_decks (
    submission_id, team_id, storage_path, original_filename,
    content_type, file_size_bytes, sha256, uploaded_by
  ) values (
    p_submission_id, v_intent.team_id, v_intent.storage_path,
    v_intent.original_filename, v_intent.content_type,
    v_intent.expected_size_bytes, p_sha256, v_user
  )
  on conflict (submission_id) do update set
    team_id = excluded.team_id,
    storage_path = excluded.storage_path,
    original_filename = excluded.original_filename,
    content_type = excluded.content_type,
    file_size_bytes = excluded.file_size_bytes,
    sha256 = excluded.sha256,
    uploaded_by = excluded.uploaded_by,
    uploaded_at = now();

  delete from public.submission_upload_intents where id = v_intent.id;

  return jsonb_build_object(
    'original_filename', v_intent.original_filename,
    'file_size_bytes', v_intent.expected_size_bytes
  );
end;
$$;

revoke all on function public.cancel_submission_upload_intent(uuid) from public, anon;
revoke all on function public.finalize_submission_deck_upload(uuid, text) from public, anon;
grant execute on function public.cancel_submission_upload_intent(uuid) to authenticated;
grant execute on function public.finalize_submission_deck_upload(uuid, text) to authenticated;
