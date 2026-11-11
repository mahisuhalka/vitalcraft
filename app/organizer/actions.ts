"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

export type OrganizerActionState = {
  status: "idle" | "success" | "error"
  message: string
}

export type DeckLinkState = OrganizerActionState & {
  url?: string
  filename?: string
}

const decisionSchema = z.enum(["pending", "shortlisted", "waitlisted", "not_selected"])

async function getOrganizerClient(allowedRoles: string[]) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { supabase: null, message: "Sign in again before continuing." }

  const { data: member, error: memberError } = await supabase
    .from("organizer_members")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle()

  if (memberError || !member || !allowedRoles.includes(member.role)) {
    return { supabase: null, message: "Your account does not have permission to perform this action." }
  }

  return { supabase, message: "" }
}

function safeActionMessage(message: string) {
  const normalized = message.toLowerCase()
  if (normalized.includes("review every submitted idea")) return "Finish reviewing every submitted idea before publishing."
  if (normalized.includes("unpublish results")) return "Unpublish the results before changing a decision."
  if (normalized.includes("results are already published")) return "Results are already published."
  if (normalized.includes("there are no submitted ideas")) return "There are no submitted ideas to publish yet."
  return "The action could not be completed. Please try again."
}

export async function saveOrganizerSubmissionReviewAction(
  _previousState: OrganizerActionState,
  formData: FormData,
): Promise<OrganizerActionState> {
  const parsed = z.object({
    submissionId: z.string().uuid(),
    decision: decisionSchema,
    internalNotes: z.string().max(3000),
  }).safeParse({
    submissionId: formData.get("submission_id"),
    decision: formData.get("decision"),
    internalNotes: formData.get("internal_notes"),
  })

  if (!parsed.success) return { status: "error", message: "Check the decision and keep notes within 3,000 characters." }

  const { supabase, message } = await getOrganizerClient(["reviewer", "admin"])
  if (!supabase) return { status: "error", message }

  const { error } = await supabase.rpc("save_organizer_submission_review", {
    p_submission_id: parsed.data.submissionId,
    p_decision: parsed.data.decision,
    p_internal_notes: parsed.data.internalNotes.trim(),
  })

  if (error) return { status: "error", message: safeActionMessage(error.message) }
  revalidatePath("/organizer")
  return { status: "success", message: "Review saved." }
}

export async function publishSubmissionResultsAction(
  _previousState: OrganizerActionState,
  _formData: FormData,
): Promise<OrganizerActionState> {
  const { supabase, message } = await getOrganizerClient(["admin"])
  if (!supabase) return { status: "error", message }

  const { error } = await supabase.rpc("publish_submission_results")
  if (error) return { status: "error", message: safeActionMessage(error.message) }
  revalidatePath("/organizer")
  revalidatePath("/dashboard")
  return { status: "success", message: "Results published to team dashboards." }
}

export async function unpublishSubmissionResultsAction(
  _previousState: OrganizerActionState,
  _formData: FormData,
): Promise<OrganizerActionState> {
  const { supabase, message } = await getOrganizerClient(["admin"])
  if (!supabase) return { status: "error", message }

  const { error } = await supabase.rpc("unpublish_submission_results")
  if (error) return { status: "error", message: safeActionMessage(error.message) }
  revalidatePath("/organizer")
  revalidatePath("/dashboard")
  return { status: "success", message: "Results are hidden from team dashboards." }
}

export async function getOrganizerDeckDownloadAction(submissionId: string): Promise<DeckLinkState> {
  const parsed = z.string().uuid().safeParse(submissionId)
  if (!parsed.success) return { status: "error", message: "The deck link is invalid." }

  const { supabase, message } = await getOrganizerClient(["reviewer", "admin"])
  if (!supabase) return { status: "error", message }

  const { data: deck, error: deckError } = await supabase
    .from("submission_decks")
    .select("storage_path, original_filename")
    .eq("submission_id", parsed.data)
    .maybeSingle()
  if (deckError || !deck) return { status: "error", message: "The private pitch deck could not be found." }

  const { data, error } = await supabase.storage
    .from("vitalcraft-pitch-decks")
    .createSignedUrl(deck.storage_path, 60, { download: deck.original_filename })
  if (error || !data?.signedUrl) return { status: "error", message: "A secure deck link could not be created. Please try again." }

  return { status: "success", message: "Private link ready for 60 seconds.", url: data.signedUrl, filename: deck.original_filename }
}

export async function respondToSubmissionResultAction(
  _previousState: OrganizerActionState,
  formData: FormData,
): Promise<OrganizerActionState> {
  const response = z.enum(["confirmed", "declined"]).safeParse(formData.get("response"))
  if (!response.success) return { status: "error", message: "Choose confirm or decline to continue." }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { status: "error", message: "Sign in again before updating your response." }

  const { error } = await supabase.rpc("respond_to_submission_result", { p_response: response.data })
  if (error) return { status: "error", message: "Your attendance response could not be saved. Please try again." }

  revalidatePath("/dashboard")
  return { status: "success", message: "Your attendance response has been saved." }
}
