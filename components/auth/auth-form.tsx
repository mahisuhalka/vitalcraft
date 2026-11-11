"use client"

import { useActionState } from "react"
import Link from "next/link"
import { signInAction, signUpAction, type AuthFormState } from "@/app/auth/actions"
import type { TrackKey } from "@/lib/event-config"

const initialState: AuthFormState = { status: "idle", message: "" }

type Props = {
  mode: "sign-in" | "sign-up"
  track: TrackKey | null
  challenge: string | null
}

export function AuthForm({ mode, track, challenge }: Props) {
  const isSignUp = mode === "sign-up"
  const action = isSignUp ? signUpAction : signInAction
  const [state, formAction, pending] = useActionState(action, initialState)
  const query = new URLSearchParams()
  if (track) query.set("track", track)
  if (challenge) query.set("challenge", challenge)
  const suffix = query.toString() ? `?${query.toString()}` : ""

  return (
    <form className="account-form" action={formAction}>
      {track && <input type="hidden" name="track" value={track} />}
      {challenge && <input type="hidden" name="challenge" value={challenge} />}

      {isSignUp && (
        <label className="account-field">
          <span>Full name</span>
          <input name="full_name" type="text" autoComplete="name" minLength={2} maxLength={120} required />
        </label>
      )}

      <label className="account-field">
        <span>Email address</span>
        <input name="email" type="email" autoComplete="email" maxLength={254} required />
      </label>

      <label className="account-field">
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete={isSignUp ? "new-password" : "current-password"}
          minLength={8}
          maxLength={72}
          required
        />
        {isSignUp && <small>Use at least 8 characters.</small>}
      </label>

      {isSignUp && (
        <label className="account-field">
          <span>Confirm password</span>
          <input name="confirm_password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
        </label>
      )}

      {state.message && (
        <p className={`account-message ${state.status === "error" ? "account-message-error" : "account-message-success"}`} role={state.status === "error" ? "alert" : "status"}>
          {state.message}
        </p>
      )}

      <button className="button button-primary account-submit" type="submit" disabled={pending}>
        {pending ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
      </button>

      <p className="account-switch">
        {isSignUp ? "Already have an account?" : "New to VitalCraft?"}{" "}
        <Link href={isSignUp ? `/auth/login${suffix}` : `/auth/sign-up${suffix}`}>
          {isSignUp ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  )
}
