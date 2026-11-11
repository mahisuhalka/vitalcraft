import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Blocks, LogOut, ShieldCheck } from "lucide-react"
import { OrganizerReviewWorkspace } from "@/components/organizer/organizer-review-workspace"
import { signOutAction } from "@/app/auth/actions"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Organizer review | VitalCraft ’26",
  description: "Private organizer review and results publication workspace for VitalCraft ’26.",
  robots: { index: false, follow: false },
}

export default async function OrganizerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=%2Forganizer")

  const { data: member, error: memberError } = await supabase
    .from("organizer_members")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle()

  if (memberError) {
    return <OrganizerUnavailable message="Organizer membership could not be verified. Refresh the page to try again." />
  }
  if (!member || (member.role !== "admin" && member.role !== "reviewer")) {
    redirect("/dashboard?access=organizer")
  }

  const [queueResult, settingsResult, registrationsResult] = await Promise.all([
    supabase.rpc("get_organizer_submission_queue"),
    supabase.from("event_registration_settings").select("results_published_at").eq("id", true).maybeSingle(),
    supabase.rpc("get_organizer_registration_overview"),
  ])

  return (
    <main className="dashboard-page organizer-page">
      <div className="dashboard-wrap">
        <header className="dashboard-topbar">
          <Link className="account-brand" href="/" aria-label="VitalCraft home">
            <span className="brand-cube"><Blocks size={18} strokeWidth={2.5} /></span>
            <span className="brand-name">VITAL<span>CRAFT</span></span>
            <span className="brand-edition">’26</span>
          </Link>
          <div className="dashboard-account">
            <span>{user.email}</span>
            <Link className="organizer-dashboard-link" href="/dashboard">Team dashboard</Link>
            <form action={signOutAction}><button className="account-signout" type="submit"><LogOut size={14} aria-hidden="true" /> Sign out</button></form>
          </div>
        </header>

        <section className="dashboard-heading organizer-heading">
          <div>
            <p className="account-eyebrow">ORGANIZER SPACE / VITALCRAFT ’26</p>
            <h1>Review ideas. Publish with care.</h1>
            <p>Review submitted ideas and pitch decks, keep internal notes private, and publish decisions only when they are ready.</p>
          </div>
          <span className="dashboard-security"><ShieldCheck size={16} aria-hidden="true" /> {member.role.toUpperCase()} ACCESS</span>
        </section>

        {settingsResult.error || !settingsResult.data ? (
          <section className="account-panel dashboard-error" role="alert"><h2>Publication status unavailable.</h2><p>The event settings could not be loaded. Results stay private until status can be verified.</p></section>
        ) : (
          <OrganizerReviewWorkspace
            items={queueResult.data ?? []}
            registrations={registrationsResult.data ?? []}
            role={member.role as "admin" | "reviewer"}
            publishedAt={settingsResult.data.results_published_at}
            loadError={Boolean(queueResult.error)}
            registrationLoadError={Boolean(registrationsResult.error)}
          />
        )}

        <footer className="dashboard-footer"><span>IEEE EMBS – BMSIT&amp;M · PRIVATE ORGANIZER WORKSPACE</span><Link href="/">Back to event home</Link></footer>
      </div>
    </main>
  )
}

function OrganizerUnavailable({ message }: { message: string }) {
  return (
    <main className="dashboard-page organizer-page">
      <div className="dashboard-wrap">
        <section className="account-panel dashboard-error" role="alert"><h1>Organizer workspace unavailable.</h1><p>{message}</p><Link className="account-inline-link" href="/dashboard">Return to team dashboard</Link></section>
      </div>
    </main>
  )
}
