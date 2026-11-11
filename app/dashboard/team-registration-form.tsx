"use client"

import { useActionState, useState } from "react"
import { registerTeamAction, type RegistrationFormState } from "@/app/dashboard/actions"
import type { TrackKey } from "@/lib/event-config"

const initialState: RegistrationFormState = { status: "idle", message: "" }
const trackLabels: Record<TrackKey, string> = {
  hardware: "Hardware",
  software: "Software",
  open: "Open Innovation",
}

type Props = {
  registrationOpen: boolean
  registrationStatus: string
  minTeamSize: number
  maxTeamSize: number
  leaderName: string
  college: string
  leaderEmail: string
  initialTrack: TrackKey
}

export function TeamRegistrationForm({
  registrationOpen,
  registrationStatus,
  minTeamSize,
  maxTeamSize,
  leaderName,
  college,
  leaderEmail,
  initialTrack,
}: Props) {
  const [state, formAction, pending] = useActionState(registerTeamAction, initialState)
  const [teamSize, setTeamSize] = useState(Math.max(minTeamSize, Math.min(maxTeamSize, 2)))
  const [track, setTrack] = useState<TrackKey>(initialTrack)

  return (
    <form className="team-registration-form" action={formAction}>
      {!registrationOpen && (
        <div className="account-notice" role="status">
          <strong>Team registration is not open.</strong>
          <span>{registrationStatus} Your information will not be saved until the window opens.</span>
        </div>
      )}

      <fieldset disabled={!registrationOpen || pending}>
        <legend>Team details</legend>
        <div className="registration-fields">
          <label className="account-field">
            <span>Team name</span>
            <input name="team_name" type="text" minLength={2} maxLength={80} required />
          </label>
          <label className="account-field">
            <span>Team lead name</span>
            <input name="leader_name" type="text" autoComplete="name" defaultValue={leaderName} minLength={2} maxLength={120} required />
          </label>
          <label className="account-field">
            <span>Team lead email</span>
            <input type="email" value={leaderEmail} readOnly aria-describedby="leader-email-note" />
            <small id="leader-email-note">Linked to your signed-in account.</small>
          </label>
          <label className="account-field">
            <span>College or institution</span>
            <input name="college" type="text" autoComplete="organization" defaultValue={college} minLength={2} maxLength={160} required />
          </label>
          <label className="account-field">
            <span>Track</span>
            <select name="track" value={track} onChange={(event) => setTrack(event.target.value as TrackKey)}>
              {Object.entries(trackLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="account-field">
            <span>Team size <small className="proposed-label">PROPOSED</small></span>
            <select name="team_size" value={teamSize} onChange={(event) => setTeamSize(Number(event.target.value))}>
              {Array.from({ length: Math.max(0, maxTeamSize - minTeamSize + 1) }, (_, index) => minTeamSize + index).map((size) => (
                <option key={size} value={size}>{size} {size === 1 ? "member" : "members"}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="member-fields">
          <h3>Teammates</h3>
          <p>Enter each teammate&apos;s name. They do not need an account yet.</p>
          {Array.from({ length: Math.max(0, teamSize - 1) }, (_, index) => (
            <label className="account-field" key={index}>
              <span>Teammate {index + 1} name</span>
              <input name="member_name" type="text" minLength={2} maxLength={120} required />
            </label>
          ))}
        </div>

        <label className="consent-field">
          <input name="coordination_consent" type="checkbox" required />
          <span>I confirm my teammates know their names are included and agree that organizers may contact me about this registration.</span>
        </label>
      </fieldset>

      {state.message && <p className="account-message account-message-error" role="alert">{state.message}</p>}
      <button className="button button-primary account-submit" type="submit" disabled={!registrationOpen || pending}>
        {pending ? "Submitting…" : registrationOpen ? "Submit team registration" : "Registration unavailable"}
      </button>
      <p className="registration-footnote">Proposed team limits are {minTeamSize}–{maxTeamSize}, subject to organizer confirmation.</p>
    </form>
  )
}
