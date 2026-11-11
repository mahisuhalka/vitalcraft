alter table public.submission_reviews
  drop constraint if exists submission_reviews_decision_check,
  add constraint submission_reviews_decision_check
    check (decision in ('pending', 'shortlisted', 'waitlisted', 'not_selected'));

alter table public.submission_results
  drop constraint if exists submission_results_decision_check,
  drop constraint if exists submission_results_check,
  add constraint submission_results_decision_check
    check (decision in ('shortlisted', 'waitlisted', 'not_selected')),
  add constraint submission_results_attendance_decision_check
    check (
      (decision = 'shortlisted' and attendance_response in ('pending', 'confirmed', 'declined'))
      or (decision in ('waitlisted', 'not_selected') and attendance_response = 'not_applicable')
    );

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
  if coalesce(p_decision, '') not in ('pending', 'shortlisted', 'waitlisted', 'not_selected') then
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
