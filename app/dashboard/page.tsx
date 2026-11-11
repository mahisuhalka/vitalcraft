import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowUpRight, Blocks, LogOut, ShieldCheck, Users } from "lucide-react"
import { TeamRegistrationForm } from "@/app/dashboard/team-registration-form"
import { signOutAction } from "@/app/auth/actions"
import { eventConfig, type TrackKey } from "@/lib/event-config"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Team dashboard | VitalCraft ’26",
  description: "Manage your VitalCraft team account and registration.",
  robots: { index: false, follow: false },
}

type SearchParams = Promise<{ track?: string; challenge?: string; registered?: string }>

function readTrack(value: unknown): TrackKey | null {
  return value === "hardware" || value === "software" || value === "open" ? value : null
}

function formatUtc(value: string) {
  return `${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value))} UTC`
}

const trackLabels: Record<TrackKey, string> = {
  hardware: "Hardware",
  software: "Software",
  open: "Open Innovation",
}

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const [profileResult, teamResult, settingsResult] = await Promise.all([
    supabase.from("profiles").select("full_name, college").eq("id", user.id).maybeSingle(),
    supabase.from("teams").select("id, registration_reference, team_name, college, track, team_size, registered_at").eq("captain_id", user.id).maybeSingle(),
    supabase.from("event_registration_settings").select("registration_opens_at, registration_closes_at, min_team_size, max_team_size, team_size_confirmed").eq("id", true).maybeSingle(),
  ])

  const team = teamResult.data
  const memberResult = team
    ? await supabase.from("team_members").select("member_name, is_captain").eq("team_id", team.id).order("is_captain", { ascending: false }).order("created_at", { ascending: true })
    : null
  const settings = settingsResult.data
  const now = Date.now()
  const registrationOpen = Boolean(
    settings?.team_size_confirmed
      && settings.registration_opens_at
      && settings.registration_closes_at
      && now >= Date.parse(settings.registration_opens_at)
      && now <= Date.parse(settings.registration_closes_at),
  )
  const registrationStatus = settingsResult.error
    ? "Event registration settings are unavailable, so registration remains closed."
    : !settings?.team_size_confirmed
      ? "Organizers have not confirmed the proposed team-size limits yet."
      : !settings.registration_opens_at || !settings.registration_closes_at
        ? "Registration dates are to be announced."
        : now < Date.parse(settings.registration_opens_at)
          ? `Registration is scheduled to open ${formatUtc(settings.registration_opens_at)}.`
          : now > Date.parse(settings.registration_closes_at)
            ? "The registration window has closed."
            : `Registration is open until ${formatUtc(settings.registration_closes_at)}.`

  const selectedTrack = readTrack(params.track) ?? readTrack(user.user_metadata?.preferred_track) ?? "hardware"
  const challengeId = typeof params.challenge === "string"
    ? params.challenge
    : typeof user.user_metadata?.preferred_challenge_id === "string"
      ? user.user_metadata.preferred_challenge_id
      : null
  const selectedChallenge = eventConfig.challenges.find((challenge) => challenge.id === challengeId)
  const profile = profileResult.data

  return (
    <main className="dashboard-page">
      <div className="dashboard-wrap">
        <header className="dashboard-topbar">
          <Link className="account-brand" href="/" aria-label="VitalCraft home">
            <span className="brand-cube"><Blocks size={18} strokeWidth={2.5} /></span>
            <span className="brand-name">VITAL<span>CRAFT</span></span>
            <span className="brand-edition">’26</span>
          </Link>
          <div className="dashboard-account">
            <span>{user.email}</span>
            <form action={signOutAction}>
              <button className="account-signout" type="submit"><LogOut size={14} /> Sign out</button>
            </form>
          </div>
        </header>

        <section className="dashboard-heading">
          <div>
            <p className="account-eyebrow">TEAM SPACE / VITALCRAFT ’26</p>
            <h1>{profile?.full_name ? `Good to have you, ${profile.full_name}.` : "Your team space."}</h1>
            <p>Event date and venue remain to be announced. Account access is ready; team registration is controlled by the confirmed event window.</p>
          </div>
          <span className="dashboard-security"><ShieldCheck size={16} /> PRIVATE ACCOUNT</span>
        </section>

        {params.registered === "1" && team && (
          <p className="account-message account-message-success dashboard-flash" role="status">
            Team registration submitted. Keep your reference code for event updates.
          </p>
        )}

        {teamResult.error ? (
          <section className="account-panel dashboard-error" role="alert">
            <h2>We couldn&apos;t load your team.</h2>
            <p>Your account is still signed in. Refresh the page to try again.</p>
          </section>
        ) : team ? (
          <div className="dashboard-grid">
            <section className="account-panel team-panel" aria-labelledby="team-title">
              <div className="dashboard-panel-heading">
                <span className="dashboard-icon"><Users size={18} /></span>
                <span className="team-status">REGISTRATION SUBMITTED</span>
              </div>
              <p className="account-eyebrow">TEAM REFERENCE</p>
              <h2 id="team-title">{team.team_name}</h2>
              <p className="team-reference">{team.registration_reference}</p>
              <dl className="team-facts">
                <div><dt>Track</dt><dd>{trackLabels[team.track as TrackKey] ?? team.track}</dd></div>
                <div><dt>Institution</dt><dd>{team.college}</dd></div>
                <div><dt>Team size</dt><dd>{team.team_size} members</dd></div>
                <div><dt>Submitted</dt><dd>{formatUtc(team.registered_at)}</dd></div>
              </dl>
              <h3 className="member-list-title">Team members</h3>
              {memberResult?.error ? (
                <p className="dashboard-muted">Member details could not be loaded right now.</p>
              ) : (
                <ul className="member-list">
                  {memberResult?.data?.map((member) => (
                    <li key={`${member.is_captain ? "captain" : "member"}-${member.member_name}`}>
                      <span>{member.member_name}</span>{member.is_captain && <span className="captain-pill">TEAM LEAD</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <aside className="dashboard-side-column">
              <section className="account-panel next-step-panel">
                <p className="account-eyebrow">NEXT UP</p>
                <h2>Prepare your idea.</h2>
                <p>Idea descriptions and pitch-deck submission will be added in the next phase. No submission has been created yet.</p>
                <span className="coming-soon"><span /> SUBMISSION DETAILS · TBA</span>
              </section>
              {selectedChallenge && (
                <section className="account-panel selected-challenge-panel">
                  <p className="account-eyebrow">SAVED STARTING POINT</p>
                  <h2>{selectedChallenge.title}</h2>
                  <p>{selectedChallenge.summary}</p>
                  <Link href="/#challenges" className="account-inline-link">Explore all challenges <ArrowUpRight size={14} /></Link>
                </section>
              )}
            </aside>
          </div>
        ) : (
          <div className="dashboard-grid">
            <section className="account-panel registration-panel" aria-labelledby="registration-title">
              <div className="dashboard-panel-heading">
                <span className="dashboard-icon"><Users size={18} /></span>
                <span className={registrationOpen ? "team-status" : "team-status team-status-pending"}>
                  {registrationOpen ? "REGISTRATION OPEN" : "REGISTRATION PENDING"}
                </span>
              </div>
              <p className="account-eyebrow">BUILD YOUR CREW</p>
              <h2 id="registration-title">Register a team.</h2>
              <p className="registration-intro">Create a team when the organizers confirm dates and team limits. Your account profile stays private until you submit.</p>
              <TeamRegistrationForm
                registrationOpen={registrationOpen}
                registrationStatus={registrationStatus}
                minTeamSize={settings?.min_team_size ?? 2}
                maxTeamSize={settings?.max_team_size ?? 4}
                leaderName={profile?.full_name ?? String(user.user_metadata?.full_name ?? "")}
                college={profile?.college ?? ""}
                leaderEmail={user.email ?? ""}
                initialTrack={selectedTrack}
              />
            </section>

            <aside className="dashboard-side-column">
              {selectedChallenge ? (
                <section className="account-panel selected-challenge-panel">
                  <p className="account-eyebrow">SAVED STARTING POINT</p>
                  <h2>{selectedChallenge.title}</h2>
                  <p>{selectedChallenge.summary}</p>
                  <Link href="/#challenges" className="account-inline-link">Explore all challenges <ArrowUpRight size={14} /></Link>
                </section>
              ) : (
                <section className="account-panel next-step-panel">
                  <p className="account-eyebrow">YOUR NEXT STEP</p>
                  <h2>Find your first block.</h2>
                  <p>Explore the proposed tracks and illustrative challenge prompts. You can choose a starting point when you are ready.</p>
                  <Link href="/#challenges" className="account-inline-link">Explore challenges <ArrowUpRight size={14} /></Link>
                </section>
              )}
              <section className="account-panel proposed-panel">
                <p className="account-eyebrow">EVENT DETAILS</p>
                <h2>Still taking shape.</h2>
                <p>Registration dates, venue, team-size limits, and prizes remain subject to organizer confirmation.</p>
                <span className="coming-soon"><span /> DATES · TO BE ANNOUNCED</span>
              </section>
            </aside>
          </div>
        )}

        <footer className="dashboard-footer">
          <span>IEEE EMBS – BMSIT&M · VITALCRAFT ’26</span>
          <Link href="/">Back to event home</Link>
        </footer>
      </div>
    </main>
  )
}
