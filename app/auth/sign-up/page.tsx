import type { Metadata } from "next"
import { AuthForm } from "@/components/auth/auth-form"
import { AuthShell } from "@/components/auth/auth-shell"
import { eventConfig, type TrackKey } from "@/lib/event-config"

export const metadata: Metadata = {
  title: "Create account | VitalCraft ’26",
  description: "Create an account for your VitalCraft team.",
  robots: { index: false, follow: false },
}

function readTrack(value?: string): TrackKey | null {
  return value === "hardware" || value === "software" || value === "open" ? value : null
}

function readChallenge(value?: string): string | null {
  return value && eventConfig.challenges.some((challenge) => challenge.id === value) ? value : null
}

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ track?: string; challenge?: string }> }) {
  const params = await searchParams
  const track = readTrack(params.track)
  const challenge = readChallenge(params.challenge)

  return (
    <AuthShell
      eyebrow="GET READY TO BUILD"
      title="Start with a name."
      description="Create your account now. Team registration stays closed until organizers confirm the event dates and team limits."
    >
      <AuthForm mode="sign-up" track={track} challenge={challenge} />
    </AuthShell>
  )
}
