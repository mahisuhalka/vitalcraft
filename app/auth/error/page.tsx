import type { Metadata } from "next"
import Link from "next/link"
import { AuthShell } from "@/components/auth/auth-shell"

export const metadata: Metadata = {
  title: "Authentication link issue | VitalCraft ’26",
  description: "The VitalCraft sign-in link could not be verified.",
  robots: { index: false, follow: false },
}

export default function AuthErrorPage() {
  return (
    <AuthShell
      eyebrow="LINK NOT VERIFIED"
      title="That link didn’t work."
      description="The confirmation link may have expired or already been used. Request a fresh link by creating an account or signing in."
    >
      <div className="account-actions">
        <Link className="button button-primary account-link-button" href="/auth/sign-up">Create account</Link>
        <Link className="button button-outline account-link-button" href="/auth/login">Sign in</Link>
      </div>
    </AuthShell>
  )
}
