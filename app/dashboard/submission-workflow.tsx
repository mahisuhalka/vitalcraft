"use client"

import { useRef, useState } from "react"
import { Check, Clock3, Download, FileText, Save, Send, ShieldCheck, Upload } from "lucide-react"
import {
  cancelSubmissionDeckUploadAction,
  createSubmissionDeckDownloadLinkAction,
  createSubmissionDeckUploadIntentAction,
  finalizeSubmissionDeckUploadAction,
  finalizeSubmissionAction,
  saveSubmissionDraftAction,
  type SubmissionFormValues,
} from "@/app/dashboard/submission-actions"
import { createClient } from "@/lib/supabase/client"

type SubmissionRecord = {
  id: string
  challenge_id: string
  idea_title: string
  problem_statement: string
  intended_users: string
  proposed_solution: string
  technical_approach: string
  resources_and_stack: string
  planned_mvp: string
  demo_plan: string
  status: "draft" | "submitted" | "under_review"
  updated_at: string
  submitted_at: string | null
}

type DeckRecord = {
  original_filename: string
  file_size_bytes: number
  uploaded_at: string
}

type SubmissionWorkflowProps = {
  submission: SubmissionRecord | null
  deck: DeckRecord | null
  challengeOptions: { id: string; title: string }[]
  canEdit: boolean
  canSubmit: boolean
  windowMessage: string
  loadError: boolean
}

const emptyValues = {
  challenge_id: "",
  idea_title: "",
  problem_statement: "",
  intended_users: "",
  proposed_solution: "",
  technical_approach: "",
  resources_and_stack: "",
  planned_mvp: "",
  demo_plan: "",
}

function formatFileSize(size: number) {
  return size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`
}

function toSha256(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export function SubmissionWorkflow({
  submission,
  deck: initialDeck,
  challengeOptions,
  canEdit,
  canSubmit,
  windowMessage,
  loadError,
}: SubmissionWorkflowProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [submissionId, setSubmissionId] = useState(submission?.id ?? null)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [deck, setDeck] = useState(initialDeck)
  const [pending, setPending] = useState(false)
  const [selectedFileName, setSelectedFileName] = useState("")
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [deckLink, setDeckLink] = useState("")

  const readValues = (): SubmissionFormValues => {
    const data = new FormData(formRef.current ?? undefined)
    const read = (name: string) => {
      const value = data.get(name)
      return typeof value === "string" ? value : ""
    }

    return {
      submissionId,
      challengeId: read("challengeId"),
      ideaTitle: read("ideaTitle"),
      problemStatement: read("problemStatement"),
      intendedUsers: read("intendedUsers"),
      proposedSolution: read("proposedSolution"),
      technicalApproach: read("technicalApproach"),
      resourcesAndStack: read("resourcesAndStack"),
      plannedMvp: read("plannedMvp"),
      demoPlan: read("demoPlan"),
    }
  }

  async function saveDraft() {
    if (!canEdit || pending) return
    setPending(true)
    setFeedback(null)
    try {
      const result = await saveSubmissionDraftAction(readValues())
      if (result.status === "error" || !result.submissionId) {
        setFeedback({ type: "error", text: result.message })
        return
      }
      setSubmissionId(result.submissionId)
      setFeedback({ type: "success", text: result.message })
    } catch {
      setFeedback({ type: "error", text: "We couldn’t save your draft. Please try again." })
    } finally {
      setPending(false)
    }
  }

  async function uploadDeck() {
    const file = fileRef.current?.files?.[0]
    if (!canEdit || pending) return
    if (!file) {
      setFeedback({ type: "error", text: "Choose a PDF or PPTX file before uploading." })
      return
    }
    if (file.size < 1 || file.size > 10 * 1024 * 1024) {
      setFeedback({ type: "error", text: "The pitch deck must be larger than 0 bytes and no more than 10 MB." })
      return
    }
    if (!/\.(pdf|pptx)$/i.test(file.name)) {
      setFeedback({ type: "error", text: "Only PDF and PPTX pitch decks are accepted." })
      return
    }

    setPending(true)
    setFeedback(null)
    let activeSubmissionId = submissionId
    let intentCreated = false
    try {
      if (!activeSubmissionId) {
        const draft = await saveSubmissionDraftAction(readValues())
        if (draft.status === "error" || !draft.submissionId) {
          setFeedback({ type: "error", text: draft.message })
          return
        }
        activeSubmissionId = draft.submissionId
        setSubmissionId(draft.submissionId)
      }

      const intent = await createSubmissionDeckUploadIntentAction(activeSubmissionId, file.name, file.size)
      if (intent.status === "error" || !intent.storagePath || !intent.contentType) {
        setFeedback({ type: "error", text: intent.message })
        return
      }
      intentCreated = true

      const hash = toSha256(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))
      const supabase = createClient()
      const { error: uploadError } = await supabase.storage
        .from("vitalcraft-pitch-decks")
        .upload(intent.storagePath, file, { contentType: intent.contentType, upsert: false })
      if (uploadError) throw new Error("storage-upload")

      const finalized = await finalizeSubmissionDeckUploadAction(activeSubmissionId, hash)
      if (finalized.status === "error") throw new Error("metadata-finalize")

      setDeck({ original_filename: file.name, file_size_bytes: file.size, uploaded_at: new Date().toISOString() })
      setDeckLink("")
      setSelectedFileName("")
      if (fileRef.current) fileRef.current.value = ""
      setFeedback({ type: "success", text: "Pitch deck uploaded privately to your team submission." })
    } catch {
      if (intentCreated && activeSubmissionId) {
        await cancelSubmissionDeckUploadAction(activeSubmissionId).catch(() => undefined)
      }
      setFeedback({ type: "error", text: "The deck could not be uploaded. Check the file and try again." })
    } finally {
      setPending(false)
    }
  }

  async function submitFinal() {
    if (!canSubmit || !canEdit || pending || !window.confirm("Submit this idea and pitch deck? You will not be able to edit the submission afterward.")) return
    setPending(true)
    setFeedback(null)
    try {
      let values = readValues()
      if (!values.submissionId) {
        const draft = await saveSubmissionDraftAction(values)
        if (draft.status === "error" || !draft.submissionId) {
          setFeedback({ type: "error", text: draft.message })
          return
        }
        setSubmissionId(draft.submissionId)
        values = { ...values, submissionId: draft.submissionId }
      }

      const result = await finalizeSubmissionAction(values)
      if (result.status === "error") {
        setFeedback({ type: "error", text: result.message })
        return
      }
      setHasSubmitted(true)
      setFeedback({ type: "success", text: "Your idea and pitch deck have been submitted." })
    } catch {
      setFeedback({ type: "error", text: "We couldn’t submit your idea. Please try again." })
    } finally {
      setPending(false)
    }
  }

  async function getDeckLink() {
    if (!submissionId || pending) return
    setPending(true)
    setFeedback(null)
    try {
      const result = await createSubmissionDeckDownloadLinkAction(submissionId)
      if (result.status === "error" || !result.url) {
        setFeedback({ type: "error", text: result.message })
        return
      }
      setDeckLink(result.url)
    } catch {
      setFeedback({ type: "error", text: "A secure deck link could not be created. Please try again." })
    } finally {
      setPending(false)
    }
  }

  const submitted = hasSubmitted || submission?.status === "submitted" || submission?.status === "under_review"
  const values = submission ?? emptyValues

  return (
    <section className="account-panel submission-panel" id="idea-submission" aria-labelledby="submission-title">
      <div className="submission-panel-heading">
        <div>
          <p className="account-eyebrow">IDEA & PITCH DECK</p>
          <h2 id="submission-title">Build your submission.</h2>
          <p className="submission-intro">Save progress as a draft, attach a private deck, and submit once the official window opens.</p>
        </div>
        <span className={`submission-status ${submitted ? "submission-status-complete" : ""}`}>
          {submission?.status === "under_review" ? "UNDER REVIEW" : submitted ? "SUBMITTED" : submission ? "DRAFT SAVED" : "NO DRAFT YET"}
        </span>
      </div>

      <ol className="submission-steps" aria-label="Submission progress">
        <li className="submission-step-complete"><span><Check size={14} /></span><b>Team registered</b></li>
        <li className={submission ? "submission-step-complete" : ""}><span>{submission ? <Check size={14} /> : "2"}</span><b>Idea draft</b></li>
        <li className={deck ? "submission-step-complete" : ""}><span>{deck ? <Check size={14} /> : "3"}</span><b>Pitch deck</b></li>
        <li className={submitted ? "submission-step-complete" : ""}><span>{submitted ? <Check size={14} /> : "4"}</span><b>Final submission</b></li>
      </ol>

      <p className="submission-window-note"><Clock3 size={15} aria-hidden="true" /> {windowMessage}</p>
      {loadError && <p className="account-message account-message-error" role="alert">Submission details could not be loaded. Refresh the page before making changes.</p>}
      {feedback && <p className={`account-message ${feedback.type === "error" ? "account-message-error" : "account-message-success"}`} role={feedback.type === "error" ? "alert" : "status"}>{feedback.text}</p>}

      <form ref={formRef} className="submission-form" onSubmit={(event) => event.preventDefault()}>
        <input type="hidden" name="submissionId" value={submissionId ?? ""} readOnly />
        <div className="submission-fields">
          <label className="account-field submission-field-full">
            <span>Challenge <small>Choose one for your registered track</small></span>
            <select name="challengeId" defaultValue={values.challenge_id} disabled={!canEdit || submitted || pending || loadError}>
              <option value="">Select a challenge</option>
              {challengeOptions.map((challenge) => <option key={challenge.id} value={challenge.id}>{challenge.title}</option>)}
            </select>
          </label>
          <label className="account-field submission-field-full">
            <span>Idea title</span>
            <input name="ideaTitle" defaultValue={values.idea_title} maxLength={120} disabled={!canEdit || submitted || pending || loadError} placeholder="Give your idea a clear, memorable name" />
            <small>2–120 characters for final submission</small>
          </label>
          <label className="account-field submission-field-full">
            <span>Problem statement</span>
            <textarea name="problemStatement" defaultValue={values.problem_statement} maxLength={2000} rows={4} disabled={!canEdit || submitted || pending || loadError} placeholder="What need or challenge are you addressing?" />
            <small>Describe the problem, its context, and why it matters.</small>
          </label>
          <label className="account-field">
            <span>Intended users</span>
            <textarea name="intendedUsers" defaultValue={values.intended_users} maxLength={1000} rows={3} disabled={!canEdit || submitted || pending || loadError} placeholder="Who will benefit from this?" />
          </label>
          <label className="account-field">
            <span>Proposed solution</span>
            <textarea name="proposedSolution" defaultValue={values.proposed_solution} maxLength={2000} rows={3} disabled={!canEdit || submitted || pending || loadError} placeholder="How will your idea address the problem?" />
          </label>
          <label className="account-field">
            <span>Technical approach</span>
            <textarea name="technicalApproach" defaultValue={values.technical_approach} maxLength={2000} rows={3} disabled={!canEdit || submitted || pending || loadError} placeholder="Describe the main components and how they work together." />
          </label>
          <label className="account-field">
            <span>Resources & stack</span>
            <textarea name="resourcesAndStack" defaultValue={values.resources_and_stack} maxLength={1000} rows={3} disabled={!canEdit || submitted || pending || loadError} placeholder="Languages, tools, hardware, data, or APIs" />
          </label>
          <label className="account-field">
            <span>Planned 24-hour MVP</span>
            <textarea name="plannedMvp" defaultValue={values.planned_mvp} maxLength={2000} rows={3} disabled={!canEdit || submitted || pending || loadError} placeholder="What will your team build during the finale?" />
          </label>
          <label className="account-field">
            <span>Demo plan</span>
            <textarea name="demoPlan" defaultValue={values.demo_plan} maxLength={1500} rows={3} disabled={!canEdit || submitted || pending || loadError} placeholder="How will you demonstrate the idea?" />
          </label>
        </div>
      </form>

      <div className="submission-deck-card">
        <div className="submission-deck-copy">
          <span className="submission-deck-icon"><FileText size={20} /></span>
          <div>
            <h3>Pitch deck</h3>
            <p>PDF or PPTX, up to 10 MB. Your file stays private to your team and event organizers.</p>
            {deck ? <p className="submission-deck-file"><Check size={14} /> {deck.original_filename} <span>· {formatFileSize(deck.file_size_bytes)}</span></p> : <p className="submission-deck-missing">No pitch deck uploaded yet.</p>}
          </div>
        </div>
        {deck && submissionId && (
          <div className="submission-deck-actions">
            <button className="account-button account-button-secondary" type="button" onClick={getDeckLink} disabled={pending || loadError}><Download size={15} /> Get secure link</button>
            {deckLink && <a className="account-inline-link" href={deckLink} target="_blank" rel="noreferrer">Open deck</a>}
          </div>
        )}
        {!submitted && canEdit && !loadError && (
          <div className="submission-upload-controls">
            <label className="submission-file-input">
              <span>{selectedFileName || "Choose a pitch deck"}</span>
              <input ref={fileRef} type="file" accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation" onChange={(event) => setSelectedFileName(event.currentTarget.files?.[0]?.name ?? "")} disabled={pending} />
            </label>
            <button className="account-button account-button-secondary" type="button" onClick={uploadDeck} disabled={pending || !selectedFileName}>
              <Upload size={15} /> {pending ? "Working…" : deck ? "Replace deck" : "Upload deck"}
            </button>
          </div>
        )}
      </div>

      {!submitted && (
        <div className="submission-actions">
          <button className="account-button account-button-secondary" type="button" onClick={saveDraft} disabled={!canEdit || submitted || pending || loadError}>
            <Save size={15} /> {pending ? "Saving…" : "Save draft"}
          </button>
          <button className="account-button account-button-primary" type="button" onClick={submitFinal} disabled={!canSubmit || !canEdit || !deck || pending || loadError}>
            <Send size={15} /> Submit final idea
          </button>
        </div>
      )}

      <p className="submission-privacy"><ShieldCheck size={14} /> Final submission locks editing. The database rechecks your team, deck, and submission window before accepting it.</p>
    </section>
  )
}
