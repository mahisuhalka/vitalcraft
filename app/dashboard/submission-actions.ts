"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

export type SubmissionFormValues = {
  submissionId: string | null
  challengeId: string
  ideaTitle: string
  problemStatement: string
  intendedUsers: string
  proposedSolution: string
  technicalApproach: string
  resourcesAndStack: string
  plannedMvp: string
  demoPlan: string
}

type ActionResult = {
  status: "success" | "error"
  message: string
  submissionId?: string
  storagePath?: string
  contentType?: string
  url?: string
}

const fieldsSchema = z.object({
  challengeId: z.enum(["", "inclusive-wayfinding", "everyday-sensing", "accessible-routines", "open-innovation"]),
  ideaTitle: z.string().trim().max(120),
  problemStatement: z.string().trim().max(2000),
  intendedUsers: z.string().trim().max(1000),
  proposedSolution: z.string().trim().max(2000),
  technicalApproach: z.string().trim().max(2000),
  resourcesAndStack: z.string().trim().max(1000),
  plannedMvp: z.string().trim().max(2000),
  demoPlan: z.string().trim().max(1500),
})

const draftSchema = fieldsSchema.extend({ submissionId: z.string().uuid().nullable() })
const finalSchema = fieldsSchema.extend({ submissionId: z.string().uuid() })

function safeDatabaseMessage(message: string) {
  const normalized = message.toLowerCase()
  if (normalized.includes("submission window is closed")) return "The submission window has closed. This draft can no longer be changed."
  if (normalized.includes("final submission window is not open")) return "Final submissions are not open yet or the deadline has passed. Your draft remains saved."
  if (normalized.includes("complete every required idea field")) return "Complete all required idea fields before final submission."
  if (normalized.includes("upload a valid pitch deck")) return "Upload your PDF or PPTX pitch deck before final submission."
  if (normalized.includes("choose a challenge")) return "Choose a challenge that matches your registered track."
  if (normalized.includes("already in progress")) return "A deck upload is already in progress. Wait a few minutes and try again."
  if (normalized.includes("pitch deck must be") || normalized.includes("only pdf and pptx")) return "Use a PDF or PPTX file no larger than 10 MB."
  if (normalized.includes("settings are unavailable")) return "Submission settings are unavailable. Please try again later."
  return "We couldn’t complete that submission action. Check your information and try again."
}

async function authenticatedClient() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { supabase: null, message: "Sign in again before updating your submission." }
  return { supabase, message: "" }
}

export async function saveSubmissionDraftAction(values: SubmissionFormValues): Promise<ActionResult> {
  const parsed = draftSchema.safeParse(values)
  if (!parsed.success) return { status: "error", message: "Check the idea fields and keep each answer within its character limit." }

  const { supabase, message } = await authenticatedClient()
  if (!supabase) return { status: "error", message }

  const { data, error } = await supabase.rpc("save_idea_submission", {
    p_submission_id: parsed.data.submissionId,
    p_challenge_id: parsed.data.challengeId,
    p_idea_title: parsed.data.ideaTitle,
    p_problem_statement: parsed.data.problemStatement,
    p_intended_users: parsed.data.intendedUsers,
    p_proposed_solution: parsed.data.proposedSolution,
    p_technical_approach: parsed.data.technicalApproach,
    p_resources_and_stack: parsed.data.resourcesAndStack,
    p_planned_mvp: parsed.data.plannedMvp,
    p_demo_plan: parsed.data.demoPlan,
    p_final: false,
  })

  if (error || !data) return { status: "error", message: safeDatabaseMessage(error?.message ?? "") }
  revalidatePath("/dashboard")
  return { status: "success", message: "Draft saved. You can come back and continue editing.", submissionId: data }
}

export async function finalizeSubmissionAction(values: SubmissionFormValues): Promise<ActionResult> {
  const parsed = finalSchema.safeParse(values)
  if (!parsed.success) return { status: "error", message: "Save your draft first, then complete the required fields before submitting." }

  const { supabase, message } = await authenticatedClient()
  if (!supabase) return { status: "error", message }

  const { data, error } = await supabase.rpc("save_idea_submission", {
    p_submission_id: parsed.data.submissionId,
    p_challenge_id: parsed.data.challengeId,
    p_idea_title: parsed.data.ideaTitle,
    p_problem_statement: parsed.data.problemStatement,
    p_intended_users: parsed.data.intendedUsers,
    p_proposed_solution: parsed.data.proposedSolution,
    p_technical_approach: parsed.data.technicalApproach,
    p_resources_and_stack: parsed.data.resourcesAndStack,
    p_planned_mvp: parsed.data.plannedMvp,
    p_demo_plan: parsed.data.demoPlan,
    p_final: true,
  })

  if (error || !data) return { status: "error", message: safeDatabaseMessage(error?.message ?? "") }
  revalidatePath("/dashboard")
  return { status: "success", message: "Your idea and pitch deck have been submitted.", submissionId: data }
}

const uploadIntentSchema = z.object({
  submissionId: z.string().uuid(),
  originalFilename: z.string().trim().min(1).max(180),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
})

export async function createSubmissionDeckUploadIntentAction(
  submissionId: string,
  originalFilename: string,
  sizeBytes: number,
): Promise<ActionResult> {
  const parsed = uploadIntentSchema.safeParse({ submissionId, originalFilename, sizeBytes })
  if (!parsed.success) return { status: "error", message: "Choose a PDF or PPTX file no larger than 10 MB." }

  const { supabase, message } = await authenticatedClient()
  if (!supabase) return { status: "error", message }

  const { data, error } = await supabase.rpc("create_submission_upload_intent", {
    p_submission_id: parsed.data.submissionId,
    p_original_filename: parsed.data.originalFilename,
    p_size_bytes: parsed.data.sizeBytes,
  })
  if (error) return { status: "error", message: safeDatabaseMessage(error.message) }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { status: "error", message: "A secure upload could not be started. Please try again." }
  }

  const storagePath = data.storage_path
  const contentType = data.content_type
  if (typeof storagePath !== "string" || typeof contentType !== "string") {
    return { status: "error", message: "A secure upload could not be started. Please try again." }
  }

  return { status: "success", message: "Upload ready.", storagePath, contentType }
}

export async function finalizeSubmissionDeckUploadAction(submissionId: string, sha256: string): Promise<ActionResult> {
  const parsed = z.object({ submissionId: z.string().uuid(), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).safeParse({ submissionId, sha256 })
  if (!parsed.success) return { status: "error", message: "The uploaded deck could not be verified." }

  const { supabase, message } = await authenticatedClient()
  if (!supabase) return { status: "error", message }

  const { error } = await supabase.rpc("finalize_submission_deck_upload", {
    p_submission_id: parsed.data.submissionId,
    p_sha256: parsed.data.sha256,
  })
  if (error) return { status: "error", message: safeDatabaseMessage(error.message) }
  revalidatePath("/dashboard")
  return { status: "success", message: "Pitch deck uploaded successfully." }
}

export async function cancelSubmissionDeckUploadAction(submissionId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(submissionId)
  if (!parsed.success) return { status: "error", message: "The upload could not be cancelled." }

  const { supabase, message } = await authenticatedClient()
  if (!supabase) return { status: "error", message }

  const { error } = await supabase.rpc("cancel_submission_upload_intent", { p_submission_id: parsed.data })
  if (error) return { status: "error", message: "The unfinished upload could not be cleared. Please try again shortly." }
  return { status: "success", message: "Upload cancelled." }
}

export async function createSubmissionDeckDownloadLinkAction(submissionId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(submissionId)
  if (!parsed.success) return { status: "error", message: "The deck link is invalid." }

  const { supabase, message } = await authenticatedClient()
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
  return { status: "success", message: "Secure link ready.", url: data.signedUrl }
}
