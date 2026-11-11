import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowUpRight, Blocks, LogOut, ShieldCheck, Users } from "lucide-react"
import { TeamRegistrationForm } from "@/app/dashboard/team-registration-form"
import { SubmissionWorkflow } from "@/app/dashboard/submission-workflow"
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
    supabase.from("event_registration_settings").select("registration_opens_at, registration_closes_at, submission_opens_at, submission_closes_at, min_team_size, max_team_size, team_size_confirmed").eq("id", true).maybeSingle(),
  ])

  const team = teamResult.data
  const [memberResult, submissionResult] = await Promise.all([
    team
      ? supabase.from("team_members").select("member_name, is_captain").eq("team_id", team.id).order("is_captain", { ascending: false }).order("created_at", { ascending: true })
      : Promise.resolve(null),
    team
      ? supabase.from("idea_submissions").select("id, challenge_id, idea_title, problem_statement, intended_users, proposed_solution, technical_approach, resources_and_stack, planned_mvp, demo_plan, status, updated_at, submitted_at").eq("team_id", team.id).maybeSingle()
      : Promise.resolve(null),
  ])
  const submission = submissionResult?.data ?? null
  const deckResult = submission
    ? await supabase.from("submission_decks").select("original_filename, file_size_bytes, uploaded_at").eq("submission_id", submission.id).maybeSingle()
    : null
  const deck = deckResult?.data ?? null
  const submissionLoadError = Boolean(submissionResult?.error || deckResult?.error)
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

  const submissionOpenAt = settings?.submission_opens_at ?? null
  const submissionCloseAt = settings?.submission_closes_at ?? null
  const canSaveSubmission = Boolean(
    settings && !settingsResult.error && !submissionLoadError
      && (!submissionCloseAt || now <= Date.parse(submissionCloseAt))
      && (!submission || submission.status === "draft"),
  )
  const canSubmitSubmission = Boolean(
    canSaveSubmission && submissionOpenAt && submissionCloseAt
      && now >= Date.parse(submissionOpenAt) && now <= Date.parse(submissionCloseAt),
  )
  const submissionWindowMessage = settingsResult.error || !settings
    ? "Submission settings are unavailable. Drafts and final submissions are temporarily disabled."
    : !submissionCloseAt
      ? "The final submission deadline has not been announced. Drafts can be saved while the submission window is being prepared."
      : now > Date.parse(submissionCloseAt)
        ? "The submission window has closed. Existing submissions are locked."
        : !submissionOpenAt
          ? `Drafts can be saved now. Final submissions will open once organizers announce a start date; the current deadline is ${formatUtc(submissionCloseAt)}.`
          : now < Date.parse(submissionOpenAt)
            ? `Drafts can be saved now. Final submissions open ${formatUtc(submissionOpenAt)} and close ${formatUtc(submissionCloseAt)}.`
            : `Final submissions are open until ${formatUtc(submissionCloseAt)}.`
  const submissionChallenges = team?.track === "open"
    ? [{ id: "open-innovation", title: "Open Innovation" }]
    : eventConfig.challenges.filter((challenge) => challenge.track === team?.track).map(({ id, title }) => ({ id, title }))

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
            <p>VitalCraft ’26 takes place 28–29 November 2026 at BMSIT&amp;M. Team registration and idea submissions are managed here.</p>
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
          <>
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
                <p>{submission ? `Last saved ${formatUtc(submission.updated_at)}.` : "Your team can begin an idea draft and add its pitch deck here."}</p>
                <span className="coming-soon"><span /> {submission?.status === "under_review" ? "UNDER REVIEW" : submission?.status === "submitted" ? "SUBMITTED" : submission ? "DRAFT IN PROGRESS" : "READY TO START"}</span>
                <Link href="#idea-submission" className="account-inline-link">Open submission workspace <ArrowUpRight size={14} /></Link>
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
          <SubmissionWorkflow
            submission={submission}
            deck={deck}
            challengeOptions={submissionChallenges}
            canEdit={canSaveSubmission}
            canSubmit={canSubmitSubmission}
            windowMessage={submissionWindowMessage}
            loadError={submissionLoadError}
          />
          </>
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
              <p className="registration-intro">Create a team when organizers open registration and confirm team-size limits. Your account profile stays private until you submit.</p>
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
                <h2>Save the date.</h2>
                <p>VitalCraft ’26 is scheduled for 28–29 November 2026 at BMSIT&amp;M. Registration dates, team-size limits, and prizes will be confirmed by organizers.</p>
                <span className="coming-soon"><span /> 28–29 NOV 2026 · BMSIT&amp;M</span>
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
