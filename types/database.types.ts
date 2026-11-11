export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type SubmissionStatus = "draft" | "submitted" | "under_review"
type ReviewDecision = "pending" | "shortlisted" | "waitlisted" | "not_selected"
type ResultDecision = Exclude<ReviewDecision, "pending">
type AttendanceResponse = "pending" | "confirmed" | "declined" | "not_applicable"
type DeckMimeType = "application/pdf" | "application/vnd.openxmlformats-officedocument.presentationml.presentation"

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" }
  public: {
    Tables: {
      event_registration_settings: {
        Row: {
          id: boolean
          max_team_size: number
          min_team_size: number
          registration_closes_at: string | null
          registration_opens_at: string | null
          results_published_at: string | null
          submission_closes_at: string | null
          submission_opens_at: string | null
          team_size_confirmed: boolean
          updated_at: string
        }
        Insert: {
          id?: boolean
          max_team_size?: number
          min_team_size?: number
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          results_published_at?: string | null
          submission_closes_at?: string | null
          submission_opens_at?: string | null
          team_size_confirmed?: boolean
          updated_at?: string
        }
        Update: {
          id?: boolean
          max_team_size?: number
          min_team_size?: number
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          results_published_at?: string | null
          submission_closes_at?: string | null
          submission_opens_at?: string | null
          team_size_confirmed?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      idea_submissions: {
        Row: {
          challenge_id: string
          created_at: string
          demo_plan: string
          id: string
          idea_title: string
          intended_users: string
          planned_mvp: string
          problem_statement: string
          proposed_solution: string
          resources_and_stack: string
          status: SubmissionStatus
          submitted_at: string | null
          team_id: string
          technical_approach: string
          updated_at: string
        }
        Insert: {
          challenge_id?: string
          created_at?: string
          demo_plan?: string
          id?: string
          idea_title?: string
          intended_users?: string
          planned_mvp?: string
          problem_statement?: string
          proposed_solution?: string
          resources_and_stack?: string
          status?: SubmissionStatus
          submitted_at?: string | null
          team_id: string
          technical_approach?: string
          updated_at?: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          demo_plan?: string
          id?: string
          idea_title?: string
          intended_users?: string
          planned_mvp?: string
          problem_statement?: string
          proposed_solution?: string
          resources_and_stack?: string
          status?: SubmissionStatus
          submitted_at?: string | null
          team_id?: string
          technical_approach?: string
          updated_at?: string
        }
        Relationships: []
      }
      organizer_members: {
        Row: { added_at: string; role: string; user_id: string }
        Insert: { added_at?: string; role: string; user_id: string }
        Update: { added_at?: string; role?: string; user_id?: string }
        Relationships: []
      }
      submission_reviews: {
        Row: { decision: ReviewDecision; internal_notes: string; reviewer_id: string; submission_id: string; updated_at: string }
        Insert: { decision?: ReviewDecision; internal_notes?: string; reviewer_id: string; submission_id: string; updated_at?: string }
        Update: { decision?: ReviewDecision; internal_notes?: string; reviewer_id?: string; submission_id?: string; updated_at?: string }
        Relationships: []
      }
      submission_results: {
        Row: { attendance_responded_at: string | null; attendance_response: AttendanceResponse; decision: ResultDecision; published_at: string; submission_id: string; team_id: string }
        Insert: { attendance_responded_at?: string | null; attendance_response?: AttendanceResponse; decision: ResultDecision; published_at?: string; submission_id: string; team_id: string }
        Update: { attendance_responded_at?: string | null; attendance_response?: AttendanceResponse; decision?: ResultDecision; published_at?: string; submission_id?: string; team_id?: string }
        Relationships: []
      }
      profiles: {
        Row: { college: string; created_at: string; full_name: string; id: string; updated_at: string }
        Insert: { college?: string; created_at?: string; full_name?: string; id: string; updated_at?: string }
        Update: { college?: string; created_at?: string; full_name?: string; id?: string; updated_at?: string }
        Relationships: []
      }
      submission_decks: {
        Row: {
          content_type: DeckMimeType
          file_size_bytes: number
          id: string
          original_filename: string
          sha256: string
          storage_path: string
          submission_id: string
          team_id: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          content_type: DeckMimeType
          file_size_bytes: number
          id?: string
          original_filename: string
          sha256: string
          storage_path: string
          submission_id: string
          team_id: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          content_type?: DeckMimeType
          file_size_bytes?: number
          id?: string
          original_filename?: string
          sha256?: string
          storage_path?: string
          submission_id?: string
          team_id?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      submission_upload_intents: {
        Row: {
          content_type: DeckMimeType
          created_at: string
          created_by: string
          expected_size_bytes: number
          expires_at: string
          id: string
          original_filename: string
          storage_path: string
          submission_id: string
          team_id: string
        }
        Insert: {
          content_type: DeckMimeType
          created_at?: string
          created_by: string
          expected_size_bytes: number
          expires_at: string
          id?: string
          original_filename: string
          storage_path: string
          submission_id: string
          team_id: string
        }
        Update: {
          content_type?: DeckMimeType
          created_at?: string
          created_by?: string
          expected_size_bytes?: number
          expires_at?: string
          id?: string
          original_filename?: string
          storage_path?: string
          submission_id?: string
          team_id?: string
        }
        Relationships: []
      }
      team_members: {
        Row: { created_at: string; id: string; is_captain: boolean; member_name: string; team_id: string }
        Insert: { created_at?: string; id?: string; is_captain?: boolean; member_name: string; team_id: string }
        Update: { created_at?: string; id?: string; is_captain?: boolean; member_name?: string; team_id?: string }
        Relationships: [{ foreignKeyName: "team_members_team_id_fkey"; columns: ["team_id"]; isOneToOne: false; referencedRelation: "teams"; referencedColumns: ["id"] }]
      }
      teams: {
        Row: {
          captain_id: string
          college: string
          consented_at: string
          id: string
          registered_at: string
          registration_reference: string
          team_name: string
          team_size: number
          track: string
        }
        Insert: {
          captain_id: string
          college: string
          consented_at: string
          id?: string
          registered_at?: string
          registration_reference?: string
          team_name: string
          team_size: number
          track: string
        }
        Update: {
          captain_id?: string
          college?: string
          consented_at?: string
          id?: string
          registered_at?: string
          registration_reference?: string
          team_name?: string
          team_size?: number
          track?: string
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      cancel_submission_upload_intent: { Args: { p_submission_id: string }; Returns: undefined }
      create_submission_upload_intent: {
        Args: { p_original_filename: string; p_size_bytes: number; p_submission_id: string }
        Returns: Json
      }
      finalize_submission_deck_upload: { Args: { p_sha256: string; p_submission_id: string }; Returns: Json }
      register_vitalcraft_team: {
        Args: {
          p_college: string
          p_coordination_consent: boolean
          p_leader_name: string
          p_other_member_names: string[]
          p_team_name: string
          p_track: string
        }
        Returns: { registration_reference: string; team_id: string }[]
      }
      get_organizer_submission_queue: {
        Args: Record<PropertyKey, never>
        Returns: {
          challenge_id: string
          deck_filename: string | null
          deck_path: string | null
          demo_plan: string
          intended_users: string
          internal_notes: string
          attendance_response: AttendanceResponse | null
          registration_reference: string
          idea_title: string
          members: Json
          planned_mvp: string
          problem_statement: string
          proposed_solution: string
          resources_and_stack: string
          review_decision: ReviewDecision
          reviewed_at: string | null
          submission_id: string
          submission_status: SubmissionStatus
          submitted_at: string | null
          team_college: string
          team_id: string
          team_name: string
          team_size: number
          team_track: string
          technical_approach: string
        }[]
      }
      get_organizer_registration_overview: {
        Args: Record<PropertyKey, never>
        Returns: {
          registered_at: string
          registration_reference: string
          submission_status: SubmissionStatus | null
          team_college: string
          team_id: string
          team_name: string
          team_size: number
          team_track: string
        }[]
      }
      get_my_submission_result: {
        Args: Record<PropertyKey, never>
        Returns: { attendance_responded_at: string | null; attendance_response: AttendanceResponse; decision: ResultDecision; published_at: string }[]
      }
      publish_submission_results: { Args: Record<PropertyKey, never>; Returns: string }
      respond_to_submission_result: { Args: { p_response: string }; Returns: undefined }
      save_organizer_submission_review: {
        Args: { p_decision: string; p_internal_notes: string; p_submission_id: string }
        Returns: undefined
      }
      unpublish_submission_results: { Args: Record<PropertyKey, never>; Returns: undefined }
      save_idea_submission: {
        Args: {
          p_challenge_id: string
          p_demo_plan: string
          p_final: boolean
          p_idea_title: string
          p_intended_users: string
          p_planned_mvp: string
          p_problem_statement: string
          p_proposed_solution: string
          p_resources_and_stack: string
          p_submission_id: string | null
          p_technical_approach: string
        }
        Returns: string
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
