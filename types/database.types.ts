export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

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
          team_size_confirmed: boolean
          updated_at: string
        }
        Insert: {
          id?: boolean
          max_team_size?: number
          min_team_size?: number
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          team_size_confirmed?: boolean
          updated_at?: string
        }
        Update: {
          id?: boolean
          max_team_size?: number
          min_team_size?: number
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          team_size_confirmed?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: { college: string; created_at: string; full_name: string; id: string; updated_at: string }
        Insert: { college?: string; created_at?: string; full_name?: string; id: string; updated_at?: string }
        Update: { college?: string; created_at?: string; full_name?: string; id?: string; updated_at?: string }
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
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
