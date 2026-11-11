"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

export type RegistrationFormState = {
  status: "idle" | "error"
  message: string
}

const registrationSchema = z.object({
  teamName: z.string().trim().min(2).max(80),
  leaderName: z.string().trim().min(2).max(120),
  college: z.string().trim().min(2).max(160),
  track: z.enum(["hardware", "software", "open"]),
  memberNames: z.array(z.string().trim().min(2).max(120)).max(9),
  coordinationConsent: z.literal(true),
})

export async function registerTeamAction(_previousState: RegistrationFormState, formData: FormData): Promise<RegistrationFormState> {
  const memberNames = formData.getAll("member_name").filter((value): value is string => typeof value === "string")
  const coordinationConsent = formData.get("coordination_consent") === "on"
  const parsed = registrationSchema.safeParse({
    teamName: formData.get("team_name"),
    leaderName: formData.get("leader_name"),
    college: formData.get("college"),
    track: formData.get("track"),
    memberNames,
    coordinationConsent,
  })

  if (!parsed.success) {
    return { status: "error", message: "Check the team details, include each teammate, and confirm the consent statement." }
  }

  const normalizedNames = parsed.data.memberNames.map((name) => name.toLocaleLowerCase())
  if (new Set(normalizedNames).size !== normalizedNames.length || normalizedNames.includes(parsed.data.leaderName.toLocaleLowerCase())) {
    return { status: "error", message: "Each team member must have a distinct name." }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { status: "error", message: "Sign in again before submitting your team." }
  }

  const { error } = await supabase.rpc("register_vitalcraft_team", {
    p_team_name: parsed.data.teamName,
    p_leader_name: parsed.data.leaderName,
    p_college: parsed.data.college,
    p_track: parsed.data.track,
    p_other_member_names: parsed.data.memberNames,
    p_coordination_consent: parsed.data.coordinationConsent,
  })

  if (error) {
    if (error.code === "23505") {
      return { status: "error", message: "This account already has a team registration." }
    }
    if (error.message.includes("Registration is not open")) {
      return { status: "error", message: "Team registration is not open yet. Your details have not been saved." }
    }
    if (error.message.includes("configured limits")) {
      return { status: "error", message: "The team size does not match the limits set by the organizers." }
    }
    if (error.message.includes("Consent is required")) {
      return { status: "error", message: "Confirm the consent statement before continuing." }
    }
    return { status: "error", message: "We could not submit the team. Check the details and try again." }
  }

  revalidatePath("/dashboard")
  redirect("/dashboard?registered=1")
}
