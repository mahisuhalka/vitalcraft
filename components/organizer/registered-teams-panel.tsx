"use client"

import { useState } from "react"
import { Search, Users } from "lucide-react"
import type { Database } from "@/types/database.types"

export type RegisteredTeam = Database["public"]["Functions"]["get_organizer_registration_overview"]["Returns"][number]
type RegistrationStatusFilter = "all" | "not_started" | "draft" | "submitted" | "under_review"

const statusLabels: Record<RegistrationStatusFilter, string> = {
  all: "All registrations",
  not_started: "Registration only",
  draft: "Draft idea",
  submitted: "Submitted",
  under_review: "Under review",
}

function statusLabel(status: string | null) {
  if (status === "submitted") return "Idea submitted"
  if (status === "under_review") return "In review"
  if (status === "draft") return "Draft in progress"
  return "Registration only"
}

function formatUtc(value: string) {
  return `${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value))} UTC`
}

export function RegisteredTeamsPanel({ teams, loadError }: { teams: RegisteredTeam[]; loadError: boolean }) {
  const [search, setSearch] = useState("")
  const [trackFilter, setTrackFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState<RegistrationStatusFilter>("all")
  const trackOptions = Array.from(new Set(teams.map((team) => team.team_track))).sort()
  const completed = teams.filter((team) => team.submission_status === "submitted" || team.submission_status === "under_review").length
  const inReview = teams.filter((team) => team.submission_status === "under_review").length
  const notStarted = teams.filter((team) => !team.submission_status).length
  const normalizedSearch = search.trim().toLowerCase()

  const filteredTeams = teams.filter((team) => {
    const status = (team.submission_status ?? "not_started") as RegistrationStatusFilter
    if (statusFilter !== "all" && status !== statusFilter) return false
    if (trackFilter !== "all" && team.team_track !== trackFilter) return false
    if (!normalizedSearch) return true
    return [team.registration_reference, team.team_name, team.team_college, team.team_track]
      .some((value) => value.toLowerCase().includes(normalizedSearch))
  })

  return (
    <section className="account-panel organizer-registration-panel" aria-labelledby="registration-overview-title">
      <header className="organizer-queue-header">
        <div>
          <p className="account-eyebrow">TEAM REGISTRATIONS</p>
          <h2 id="registration-overview-title">Registered teams</h2>
          <p>Registration and idea submission are tracked separately. Only submitted ideas enter the review queue.</p>
        </div>
        <span className="organizer-queue-count"><Users size={15} aria-hidden="true" /> {teams.length} registered</span>
      </header>

      {loadError ? (
        <p className="account-message account-message-error" role="alert">Registered teams could not be loaded. Refresh the page to try again.</p>
      ) : (
        <>
          <div className="organizer-registration-summary" aria-label="Registration totals">
            <article><span>Registered teams</span><strong>{teams.length}</strong></article>
            <article><span>Ideas submitted</span><strong>{completed}</strong></article>
            <article><span>In review</span><strong>{inReview}</strong></article>
            <article><span>Registration only</span><strong>{notStarted}</strong></article>
          </div>

          <div className="organizer-registration-tools">
            <label className="organizer-search"><span className="sr-only">Search registrations by team name or reference</span><Search size={16} aria-hidden="true" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search team or registration reference…" /></label>
            <label className="organizer-filter"><span>Track</span><select value={trackFilter} onChange={(event) => setTrackFilter(event.target.value)}><option value="all">All tracks</option>{trackOptions.map((track) => <option key={track} value={track}>{track.toUpperCase()}</option>)}</select></label>
            <label className="organizer-filter"><span>Submission state</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as RegistrationStatusFilter)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>

          {filteredTeams.length ? (
            <div className="organizer-registration-list" role="list" aria-label="Registered teams">
              {filteredTeams.map((team) => {
                const status = team.submission_status ?? "not_started"
                return (
                  <article className="organizer-registration-card" role="listitem" key={team.team_id}>
                    <div className="organizer-registration-card-head">
                      <div>
                        <p className="organizer-reference">REF {team.registration_reference}</p>
                        <h3>{team.team_name}</h3>
                        <p>{team.team_college}</p>
                      </div>
                      <span className={`organizer-registration-status organizer-registration-status-${status}`}>{statusLabel(team.submission_status)}</span>
                    </div>
                    <dl className="organizer-registration-meta">
                      <div><dt>Track</dt><dd>{team.team_track.toUpperCase()}</dd></div>
                      <div><dt>Team size</dt><dd>{team.team_size}</dd></div>
                      <div><dt>Registered</dt><dd>{formatUtc(team.registered_at)}</dd></div>
                    </dl>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="organizer-empty-state"><h3>{teams.length ? "No matching teams." : "No teams registered yet."}</h3><p>{teams.length ? "Try a different search, track, or submission-state filter." : "Team registrations will appear here as they are completed."}</p></div>
          )}
        </>
      )}
    </section>
  )
}
