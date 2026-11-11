import type { Metadata } from "next"
import { AuthForm } from "@/components/auth/auth-form"
import { AuthShell } from "@/components/auth/auth-shell"
import { eventConfig, type TrackKey } from "@/lib/event-config"

export const metadata: Metadata = {
  title: "Sign in | VitalCraft ’26",
  description: "Sign in to your VitalCraft team account.",
  robots: { index: false, follow: false },
}

function readTrack(value?: string): TrackKey | null {
  return value === "hardware" || value === "software" || value === "open" ? value : null
}

function readChallenge(value?: string): string | null {
  return value && eventConfig.challenges.some((challenge) => challenge.id === value) ? value : null
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ track?: string; challenge?: string; next?: string }> }) {
  const params = await searchParams
  const track = readTrack(params.track)
  const challenge = readChallenge(params.challenge)
  const next = params.next === "/organizer" ? "/organizer" : null

  return (
    <AuthShell
      eyebrow="ACCOUNT ACCESS"
      title="Welcome back."
      description="Sign in to return to your team space and event updates."
    >
      <AuthForm mode="sign-in" track={track} challenge={challenge} next={next} />
    </AuthShell>
  )
}
