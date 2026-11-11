import type { Metadata } from "next"
import Link from "next/link"
import { AuthShell } from "@/components/auth/auth-shell"

export const metadata: Metadata = {
  title: "Check your email | VitalCraft ’26",
  description: "Confirm your email to finish creating a VitalCraft account.",
  robots: { index: false, follow: false },
}

export default function SignUpSuccessPage() {
  return (
    <AuthShell
      eyebrow="ONE MORE STEP"
      title="Check your inbox."
      description="If the address can receive a confirmation, we have sent a link to finish setting up your account."
    >
      <div className="account-notice" role="status">
        <strong>Email confirmation is required.</strong>
        <span>Open the link from the same device or browser to continue to your dashboard.</span>
      </div>
      <Link className="button button-primary account-submit account-link-button" href="/auth/login">
        Continue to sign in
      </Link>
    </AuthShell>
  )
}
