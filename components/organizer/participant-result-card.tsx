"use client"

import { useActionState } from "react"
import { Check, Clock3, ShieldCheck } from "lucide-react"
import type { Database } from "@/types/database.types"
import { respondToSubmissionResultAction, type OrganizerActionState } from "@/app/organizer/actions"

type SubmissionResult = Database["public"]["Functions"]["get_my_submission_result"]["Returns"][number]

const idle: OrganizerActionState = { status: "idle", message: "" }

function resultLabel(decision: string) {
  if (decision === "shortlisted") return "Shortlisted"
  if (decision === "waitlisted") return "Waitlisted"
  return "Not shortlisted"
}

function formatUtc(value: string) {
  return `${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value))} UTC`
}

export function ParticipantResultCard({ result, loadError }: { result: SubmissionResult | null; loadError: boolean }) {
  const [state, formAction, pending] = useActionState(respondToSubmissionResultAction, idle)

  return (
    <section className="account-panel participant-result-panel" aria-labelledby="participant-result-title">
      <div className="participant-result-heading">
        <div>
          <p className="account-eyebrow">PRIVATE TEAM UPDATE</p>
          <h2 id="participant-result-title">Selection result</h2>
        </div>
        <ShieldCheck size={20} aria-hidden="true" />
      </div>

      {loadError ? (
        <p className="account-message account-message-error" role="alert">Your result could not be loaded right now. Refresh the dashboard to try again.</p>
      ) : !result ? (
        <p className="participant-result-copy"><Clock3 size={16} aria-hidden="true" /> Organizers have not published decisions yet. Your result will appear here after publication.</p>
      ) : (
        <>
          <div className="participant-result-status">
            <span className={`organizer-decision organizer-decision-${result.decision}`}>{resultLabel(result.decision)}</span>
            <span>Published {formatUtc(result.published_at)}</span>
          </div>
          {result.decision === "shortlisted" ? (
            <div className="participant-attendance">
              <div>
                <h3>Finale attendance</h3>
                <p>Your team can confirm or decline its place in the 24-hour finale.</p>
                <span className="participant-attendance-current"><Check size={14} aria-hidden="true" /> {result.attendance_response === "pending" ? "No response yet" : `Your team ${result.attendance_response} attendance`}</span>
              </div>
              <form action={formAction} className="participant-attendance-actions">
                <button className="account-button account-button-primary" type="submit" name="response" value="confirmed" disabled={pending}>{pending ? "Saving…" : "Confirm attendance"}</button>
                <button className="account-button account-button-secondary" type="submit" name="response" value="declined" disabled={pending}>Decline</button>
              </form>
              {state.message && <p className={`organizer-inline-message ${state.status === "error" ? "organizer-inline-error" : ""}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
            </div>
          ) : (
            <p className="participant-result-copy">Thank you for submitting your idea. Your team&apos;s decision is available here; internal reviewer notes are not shared.</p>
          )}
        </>
      )}
    </section>
  )
}
