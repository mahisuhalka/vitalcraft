"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { eventConfig, type TrackKey } from "@/lib/event-config"
import { createClient } from "@/lib/supabase/server"

export type AuthFormState = {
  status: "idle" | "error" | "success"
  message: string
}

const trackValues: TrackKey[] = ["hardware", "software", "open"]
const challengeIds = new Set(eventConfig.challenges.map((challenge) => challenge.id))
const emailSchema = z.string().trim().email().max(254)
const passwordSchema = z.string().min(8).max(72)

function readTrack(value: FormDataEntryValue | null): TrackKey | null {
  return typeof value === "string" && trackValues.includes(value as TrackKey) ? value as TrackKey : null
}

function readChallenge(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && challengeIds.has(value) ? value : null
}

function dashboardPath(track: TrackKey | null, challenge: string | null) {
  const query = new URLSearchParams()
  if (track) query.set("track", track)
  if (challenge) query.set("challenge", challenge)
  const suffix = query.toString()
  return suffix ? `/dashboard?${suffix}` : "/dashboard"
}

export async function signInAction(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z.object({ email: emailSchema, password: passwordSchema }).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email address and password of at least 8 characters." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    if (error.code === "email_not_confirmed") {
      return { status: "error", message: "Confirm your email using the link we sent, then sign in." }
    }
    if (error.status === 429 || error.code?.includes("rate_limit")) {
      return { status: "error", message: "Too many attempts. Wait a little while, then try again." }
    }
    if (error.code === "invalid_credentials" || error.message.toLowerCase().includes("invalid login credentials")) {
      return { status: "error", message: "Email or password is incorrect." }
    }
    return { status: "error", message: "We could not sign you in. Check your details and try again." }
  }

  const track = readTrack(formData.get("track"))
  const challenge = readChallenge(formData.get("challenge"))
  if (track || challenge) {
    await supabase.auth.updateUser({
      data: {
        ...(track ? { preferred_track: track } : {}),
        ...(challenge ? { preferred_challenge_id: challenge } : {}),
      },
    })
  }

  revalidatePath("/", "layout")
  redirect(dashboardPath(track, challenge))
}

export async function signUpAction(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z.object({
    fullName: z.string().trim().min(2).max(120),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(8).max(72),
  }).safeParse({
    fullName: formData.get("full_name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirm_password"),
  })

  if (!parsed.success) {
    return { status: "error", message: "Check your name, email, and password. Passwords must be at least 8 characters." }
  }
  if (parsed.data.password !== parsed.data.confirmPassword) {
    return { status: "error", message: "The passwords do not match." }
  }

  const track = readTrack(formData.get("track"))
  const challenge = readChallenge(formData.get("challenge"))
  const requestHeaders = await headers()
  const origin = requestHeaders.get("origin") ?? "http://localhost:3000"
  const emailRedirectTo = process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? new URL("/auth/callback", origin).toString()
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo,
      data: {
        full_name: parsed.data.fullName,
        ...(track ? { preferred_track: track } : {}),
        ...(challenge ? { preferred_challenge_id: challenge } : {}),
      },
    },
  })

  if (error) {
    if (error.code === "weak_password") {
      return { status: "error", message: "Choose a stronger password with at least 8 characters." }
    }
    if (error.code === "email_address_invalid") {
      return { status: "error", message: "Enter a valid email address." }
    }
    if (error.code === "email_address_not_authorized") {
      return { status: "error", message: "The project email provider can only send to addresses in its authorized organization. Try an authorized address or ask the organizers to configure email delivery." }
    }
    if (error.status === 429 || error.code?.includes("rate_limit")) {
      return { status: "error", message: "Confirmation emails are being sent too quickly. Wait a little while, then try again." }
    }
    return { status: "error", message: "We could not create the account. Check the details and try again." }
  }

  if (data.session) {
    revalidatePath("/", "layout")
    redirect(dashboardPath(track, challenge))
  }

  redirect("/auth/sign-up-success")
}

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/")
}
