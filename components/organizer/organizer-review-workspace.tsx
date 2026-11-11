"use client"

import { useState, useTransition } from "react"
import { useActionState } from "react"
import { ArrowDownToLine, Check, LockKeyhole, Search, ShieldCheck, UserRound, Users } from "lucide-react"
import type { Database, Json } from "@/types/database.types"
import { eventConfig } from "@/lib/event-config"
import { RegisteredTeamsPanel, type RegisteredTeam } from "@/components/organizer/registered-teams-panel"
import {
  getOrganizerDeckDownloadAction,
  publishSubmissionResultsAction,
  saveOrganizerSubmissionReviewAction,
  unpublishSubmissionResultsAction,
  type DeckLinkState,
  type OrganizerActionState,
} from "@/app/organizer/actions"

export type OrganizerQueueItem = Database["public"]["Functions"]["get_organizer_submission_queue"]["Returns"][number]
type DecisionFilter = "all" | "pending" | "shortlisted" | "waitlisted" | "not_selected"
type SubmissionStatusFilter = "all" | "submitted" | "under_review"
type OrganizerRole = "reviewer" | "admin"

const idle: OrganizerActionState = { status: "idle", message: "" }

const decisionLabels: Record<DecisionFilter, string> = {
  all: "All submissions",
  pending: "Pending review",
  shortlisted: "Shortlisted",
  waitlisted: "Waitlisted",
  not_selected: "Not shortlisted",
}

function getMembers(value: Json) {
  if (!Array.isArray(value)) return []
  return value.flatMap((member) => {
    if (!member || typeof member !== "object" || Array.isArray(member)) return []
    const name = member.name
    return typeof name === "string" ? [{ name, isCaptain: member.is_captain === true }] : []
  })
}

function decisionLabel(value: string) {
  if (value === "shortlisted") return "Shortlisted"
  if (value === "waitlisted") return "Waitlisted"
  if (value === "not_selected") return "Not shortlisted"
  return "Pending"
}

function formatUtc(value: string | null) {
  if (!value) return "Not recorded"
  return `${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value))} UTC`
}

function attendanceLabel(value: string | null) {
  if (value === "confirmed") return "Confirmed"
  if (value === "declined") return "Declined"
  if (value === "pending") return "Awaiting response"
  if (value === "not_applicable") return "Not applicable"
  return "Not published"
}

function challengeLabel(challengeId: string) {
  return challengeId === "open-innovation"
    ? "Open Innovation"
    : eventConfig.challenges.find((challenge) => challenge.id === challengeId)?.title ?? challengeId
}

function DeckDownloadControl({ submissionId, filename }: { submissionId: string; filename: string | null }) {
  const [isPending, startTransition] = useTransition()
  const [state, setState] = useState<DeckLinkState>(idle)

  function requestLink() {
    startTransition(async () => {
      const result = await getOrganizerDeckDownloadAction(submissionId)
      setState(result)
    })
  }

  if (!filename) return <p className="organizer-deck-missing">No pitch deck attached.</p>

  return (
    <div className="organizer-deck-control">
      <p className="organizer-deck-name"><ArrowDownToLine size={15} aria-hidden="true" /> {filename}</p>
      <button className="account-button account-button-secondary" type="button" onClick={requestLink} disabled={isPending}>
        {isPending ? "Creating secure link…" : "Create 60-second deck link"}
      </button>
      {state.message && <p className={`organizer-inline-message ${state.status === "error" ? "organizer-inline-error" : ""}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
      {state.url && <a className="account-inline-link" href={state.url} target="_blank" rel="noopener noreferrer">Open private pitch deck</a>}
    </div>
  )
}

function ReviewCard({ item, locked }: { item: OrganizerQueueItem; locked: boolean }) {
  const [state, formAction, pending] = useActionState(saveOrganizerSubmissionReviewAction, idle)
  const members = getMembers(item.members)

  return (
    <article className="organizer-review-card">
      <div className="organizer-review-card-head">
        <div>
          <p className="account-eyebrow">{item.team_track.toUpperCase()} · {item.team_size} MEMBERS</p>
          <h3>{item.idea_title || "Untitled submission"}</h3>
          <p className="organizer-team-meta">{item.team_name} <span>·</span> {item.team_college}</p>
          <p className="organizer-reference">REF {item.registration_reference}</p>
        </div>
        <span className={`organizer-decision organizer-decision-${item.review_decision}`}>
          {decisionLabel(item.review_decision)}
        </span>
      </div>

      <dl className="organizer-submission-meta">
        <div><dt>Submitted</dt><dd>{formatUtc(item.submitted_at)}</dd></div>
        <div><dt>Challenge</dt><dd>{challengeLabel(item.challenge_id)}</dd></div>
        <div><dt>Last reviewed</dt><dd>{formatUtc(item.reviewed_at)}</dd></div>
        <div><dt>Finale attendance</dt><dd>{attendanceLabel(item.attendance_response)}</dd></div>
      </dl>

      <details className="organizer-submission-details">
        <summary>Review submission details</summary>
        <div className="organizer-detail-grid">
          <section><h4>Problem and users</h4><p>{item.problem_statement || "No problem statement provided."}</p><p><strong>Intended users:</strong> {item.intended_users || "Not provided."}</p></section>
          <section><h4>Proposed solution</h4><p>{item.proposed_solution || "No proposed solution provided."}</p></section>
          <section><h4>Technical approach</h4><p>{item.technical_approach || "Not provided."}</p><p><strong>Resources and stack:</strong> {item.resources_and_stack || "Not provided."}</p></section>
          <section><h4>24-hour MVP and demo</h4><p><strong>Planned MVP:</strong> {item.planned_mvp || "Not provided."}</p><p><strong>Demo plan:</strong> {item.demo_plan || "Not provided."}</p></section>
          <section className="organizer-detail-full"><h4>Team members</h4><ul className="organizer-member-list">{members.map((member, index) => <li key={`${member.name}-${index}`}><UserRound size={14} aria-hidden="true" /> {member.name}{member.isCaptain && <span>TEAM LEAD</span>}</li>)}</ul></section>
          <section className="organizer-detail-full"><h4>Pitch deck</h4><DeckDownloadControl submissionId={item.submission_id} filename={item.deck_filename} /></section>
        </div>
      </details>

      <form className="organizer-review-form" action={formAction}>
        <input type="hidden" name="submission_id" value={item.submission_id} />
        <label className="account-field">
          <span>Decision</span>
          <select name="decision" defaultValue={item.review_decision} disabled={locked || pending}>
            <option value="pending">Pending</option>
            <option value="shortlisted">Shortlisted</option>
            <option value="waitlisted">Waitlisted</option>
            <option value="not_selected">Not shortlisted</option>
          </select>
        </label>
        <label className="account-field">
          <span>Internal reviewer notes <small>(private to organizers)</small></span>
          <textarea name="internal_notes" defaultValue={item.internal_notes} maxLength={3000} rows={4} disabled={locked || pending} />
        </label>
        {state.message && <p className={`account-message ${state.status === "error" ? "account-message-error" : "account-message-success"}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
        <div className="organizer-review-form-footer">
          {locked ? <span className="organizer-lock-note"><LockKeyhole size={14} aria-hidden="true" /> Unpublish results to edit reviews.</span> : <span className="organizer-lock-note"><ShieldCheck size={14} aria-hidden="true" /> Notes stay private to organizers.</span>}
          <button className="account-button account-button-primary" type="submit" disabled={locked || pending}>
            {pending ? "Saving…" : <><Check size={14} aria-hidden="true" /> Save review</>}
          </button>
        </div>
      </form>
    </article>
  )
}

function PublicationControls({ role, publishedAt, total, unresolved, attendance }: { role: OrganizerRole; publishedAt: string | null; total: number; unresolved: number; attendance: { finalists: number; confirmed: number; declined: number; awaiting: number } }) {
  const [publishState, publishFormAction, publishing] = useActionState(publishSubmissionResultsAction, idle)
  const [unpublishState, unpublishFormAction, unpublishing] = useActionState(unpublishSubmissionResultsAction, idle)
  const isAdmin = role === "admin"
  const message = publishState.message || unpublishState.message
  const messageStatus = publishState.message ? publishState.status : unpublishState.status

  return (
    <section className="account-panel organizer-publication-panel" aria-labelledby="publication-title">
      <div className="organizer-publication-copy">
        <p className="account-eyebrow">RESULTS CONTROL</p>
        <h2 id="publication-title">Publish participant decisions</h2>
        <p>Publishing makes each team&apos;s decision visible in its private dashboard. Internal notes remain organizer-only.</p>
        {publishedAt && <div className="organizer-attendance-summary" aria-label="Finalist attendance responses"><div><span>Finalists</span><strong>{attendance.finalists}</strong></div><div><span>Confirmed</span><strong>{attendance.confirmed}</strong></div><div><span>Declined</span><strong>{attendance.declined}</strong></div><div><span>Awaiting</span><strong>{attendance.awaiting}</strong></div></div>}
      </div>
      <div className="organizer-publication-action">
        {publishedAt ? (
          <>
            <span className="organizer-published-status"><Check size={15} aria-hidden="true" /> Published {formatUtc(publishedAt)}</span>
            {isAdmin && <form action={unpublishFormAction}><button className="account-button account-button-secondary" type="submit" disabled={unpublishing}>{unpublishing ? "Unpublishing…" : "Unpublish results"}</button></form>}
          </>
        ) : (
          <>
            <p className="organizer-publish-readiness">{total === 0 ? "No submissions are ready to publish." : unresolved > 0 ? `${unresolved} submission${unresolved === 1 ? " needs" : "s need"} a final decision.` : "Every submission has a final decision."}</p>
            {isAdmin ? (
              <form action={publishFormAction}><button className="account-button account-button-primary" type="submit" disabled={publishing || total === 0 || unresolved > 0}>{publishing ? "Publishing…" : "Publish results"}</button></form>
            ) : <span className="organizer-lock-note"><LockKeyhole size={14} aria-hidden="true" /> Admin access required to publish.</span>}
          </>
        )}
      </div>
      {message && <p className={`organizer-publication-message ${messageStatus === "error" ? "organizer-inline-error" : ""}`} role={messageStatus === "error" ? "alert" : "status"}>{message}</p>}
    </section>
  )
}

export function OrganizerReviewWorkspace({ items, registrations, role, publishedAt, loadError, registrationLoadError }: {
  items: OrganizerQueueItem[]
  registrations: RegisteredTeam[]
  role: OrganizerRole
  publishedAt: string | null
  loadError: boolean
  registrationLoadError: boolean
}) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<DecisionFilter>("all")
  const [trackFilter, setTrackFilter] = useState("all")
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState<SubmissionStatusFilter>("all")
  const trackOptions = Array.from(new Set(items.map((item) => item.team_track))).sort()
  const unresolved = items.filter((item) => item.review_decision === "pending").length
  const finalists = items.filter((item) => item.review_decision === "shortlisted")
  const attendance = {
    finalists: finalists.length,
    confirmed: finalists.filter((item) => item.attendance_response === "confirmed").length,
    declined: finalists.filter((item) => item.attendance_response === "declined").length,
    awaiting: finalists.filter((item) => item.attendance_response === "pending" || item.attendance_response === null).length,
  }
  const counts: Record<DecisionFilter, number> = {
    all: items.length,
    pending: unresolved,
    shortlisted: items.filter((item) => item.review_decision === "shortlisted").length,
    waitlisted: items.filter((item) => item.review_decision === "waitlisted").length,
    not_selected: items.filter((item) => item.review_decision === "not_selected").length,
  }
  const normalizedSearch = search.trim().toLowerCase()
  const filteredItems = items.filter((item) => {
    if (filter !== "all" && item.review_decision !== filter) return false
    if (trackFilter !== "all" && item.team_track !== trackFilter) return false
    if (submissionStatusFilter !== "all" && item.submission_status !== submissionStatusFilter) return false
    if (!normalizedSearch) return true
    return [item.registration_reference, item.idea_title, item.team_name, item.team_college, item.team_track, item.challenge_id]
      .some((value) => value.toLowerCase().includes(normalizedSearch))
  })

  return (
    <>
      <RegisteredTeamsPanel teams={registrations} loadError={registrationLoadError} />
      <PublicationControls role={role} publishedAt={publishedAt} total={items.length} unresolved={unresolved} attendance={attendance} />
      <section className="organizer-queue" aria-labelledby="queue-title">
        <div className="organizer-queue-header">
          <div>
            <p className="account-eyebrow">SUBMISSION QUEUE</p>
            <h2 id="queue-title">Review ideas</h2>
            <p>{items.length} submitted idea{items.length === 1 ? "" : "s"}. Registration and submitted ideas are shown separately.</p>
          </div>
          <span className="organizer-queue-count"><Users size={15} aria-hidden="true" /> {items.length} submissions</span>
        </div>

        {loadError ? (
          <div className="account-panel dashboard-error" role="alert"><h2>Review queue unavailable.</h2><p>Organizer data could not be loaded. Refresh the page to try again.</p></div>
        ) : (
          <>
            <div className="organizer-queue-tools">
              <label className="organizer-search"><span className="sr-only">Search by team, registration reference, or idea</span><Search size={16} aria-hidden="true" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search team, reference, or idea…" /></label>
              <label className="organizer-filter"><span>Track</span><select value={trackFilter} onChange={(event) => setTrackFilter(event.target.value)}><option value="all">All tracks</option>{trackOptions.map((track) => <option key={track} value={track}>{track.toUpperCase()}</option>)}</select></label>
              <label className="organizer-filter"><span>Submission state</span><select value={submissionStatusFilter} onChange={(event) => setSubmissionStatusFilter(event.target.value as SubmissionStatusFilter)}><option value="all">All states</option><option value="submitted">Submitted</option><option value="under_review">Under review</option></select></label>
              <label className="organizer-filter"><span>Decision</span><select value={filter} onChange={(event) => setFilter(event.target.value as DecisionFilter)}>{Object.entries(decisionLabels).map(([value, label]) => <option key={value} value={value}>{label} ({counts[value as DecisionFilter]})</option>)}</select></label>
            </div>
            {filteredItems.length ? (
              <div className="organizer-review-list">{filteredItems.map((item) => <ReviewCard key={item.submission_id} item={item} locked={Boolean(publishedAt)} />)}</div>
            ) : (
              <div className="account-panel organizer-empty-state"><h3>{items.length ? "No matching submissions." : "No submitted ideas yet."}</h3><p>{items.length ? "Try another search term or decision filter." : "When a team finalizes its idea, it will appear here for review."}</p></div>
            )}
          </>
        )}
      </section>
    </>
  )
}
