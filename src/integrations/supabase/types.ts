export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      eut_admin_management_log: {
        Row: {
          action: string
          actor_id: string
          after_state: Json
          before_state: Json
          created_at: string
          id: number
          reason: string
          target_key: string
          target_type: string
        }
        Insert: {
          action: string
          actor_id: string
          after_state?: Json
          before_state?: Json
          created_at?: string
          id?: never
          reason: string
          target_key: string
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string
          after_state?: Json
          before_state?: Json
          created_at?: string
          id?: never
          reason?: string
          target_key?: string
          target_type?: string
        }
        Relationships: []
      }
      eut_contact_entitlements: {
        Row: {
          access_date: string
          client_id: string
          created_at: string
          daily_slot: number
          id: string
          paid_at: string
          payment_reference: string
          price_cents: number
          technician_id: string
        }
        Insert: {
          access_date: string
          client_id: string
          created_at?: string
          daily_slot: number
          id?: string
          paid_at: string
          payment_reference: string
          price_cents: number
          technician_id: string
        }
        Update: {
          access_date?: string
          client_id?: string
          created_at?: string
          daily_slot?: number
          id?: string
          paid_at?: string
          payment_reference?: string
          price_cents?: number
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eut_contact_entitlements_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      eut_contact_purchase_intents: {
        Row: {
          access_date: string
          client_id: string
          created_at: string
          currency: string
          expires_at: string
          id: string
          provider: string | null
          provider_reference: string | null
          quoted_price_cents: number
          state: string
          technician_id: string
          updated_at: string
        }
        Insert: {
          access_date: string
          client_id: string
          created_at?: string
          currency?: string
          expires_at: string
          id?: string
          provider?: string | null
          provider_reference?: string | null
          quoted_price_cents: number
          state?: string
          technician_id: string
          updated_at?: string
        }
        Update: {
          access_date?: string
          client_id?: string
          created_at?: string
          currency?: string
          expires_at?: string
          id?: string
          provider?: string | null
          provider_reference?: string | null
          quoted_price_cents?: number
          state?: string
          technician_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eut_contact_purchase_intents_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      eut_direct_request_consents: {
        Row: {
          client_id: string
          request_id: string
          shared_at: string
          technician_id: string
        }
        Insert: {
          client_id: string
          request_id: string
          shared_at?: string
          technician_id: string
        }
        Update: {
          client_id?: string
          request_id?: string
          shared_at?: string
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eut_direct_request_consents_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eut_direct_request_consents_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      eut_direct_request_replies: {
        Row: {
          body: string
          created_at: string
          request_id: string
          technician_user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          request_id: string
          technician_user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          request_id?: string
          technician_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eut_direct_request_replies_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      eut_ibge_municipalities: {
        Row: {
          id: number
          latitude: number
          longitude: number
          name: string
          uf: string
        }
        Insert: {
          id: number
          latitude: number
          longitude: number
          name: string
          uf: string
        }
        Update: {
          id?: number
          latitude?: number
          longitude?: number
          name?: string
          uf?: string
        }
        Relationships: []
      }
      eut_legacy_employer_management: {
        Row: {
          admin_notes: string
          corrected_name: string | null
          created_at: string
          record_state: string
          source_key: string
          updated_at: string
          updated_by: string | null
          wp_post_id: number
        }
        Insert: {
          admin_notes?: string
          corrected_name?: string | null
          created_at?: string
          record_state?: string
          source_key?: string
          updated_at?: string
          updated_by?: string | null
          wp_post_id: number
        }
        Update: {
          admin_notes?: string
          corrected_name?: string | null
          created_at?: string
          record_state?: string
          source_key?: string
          updated_at?: string
          updated_by?: string | null
          wp_post_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "eut_legacy_employer_fk"
            columns: ["source_key", "wp_post_id"]
            isOneToOne: true
            referencedRelation: "legacy_review_profiles"
            referencedColumns: ["source_key", "wp_post_id"]
          },
        ]
      }
      eut_legacy_profile_management: {
        Row: {
          admin_notes: string
          corrected_name: string | null
          coverage_notes: string
          created_at: string
          location_status: string
          municipality: string | null
          neighborhood: string | null
          public_description: string
          record_state: string
          service_status: string
          source_key: string
          state_uf: string | null
          updated_at: string
          updated_by: string | null
          verification_basis: string
          wp_post_id: number
        }
        Insert: {
          admin_notes?: string
          corrected_name?: string | null
          coverage_notes?: string
          created_at?: string
          location_status?: string
          municipality?: string | null
          neighborhood?: string | null
          public_description?: string
          record_state?: string
          service_status?: string
          source_key: string
          state_uf?: string | null
          updated_at?: string
          updated_by?: string | null
          verification_basis?: string
          wp_post_id: number
        }
        Update: {
          admin_notes?: string
          corrected_name?: string | null
          coverage_notes?: string
          created_at?: string
          location_status?: string
          municipality?: string | null
          neighborhood?: string | null
          public_description?: string
          record_state?: string
          service_status?: string
          source_key?: string
          state_uf?: string | null
          updated_at?: string
          updated_by?: string | null
          verification_basis?: string
          wp_post_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "eut_legacy_profile_management_source_key_wp_post_id_fkey"
            columns: ["source_key", "wp_post_id"]
            isOneToOne: true
            referencedRelation: "legacy_review_profiles"
            referencedColumns: ["source_key", "wp_post_id"]
          },
        ]
      }
      eut_legacy_profile_services: {
        Row: {
          confirmation_status: string
          evidence: string
          service_slug: string
          source_key: string
          updated_at: string
          updated_by: string | null
          wp_post_id: number
        }
        Insert: {
          confirmation_status?: string
          evidence?: string
          service_slug: string
          source_key: string
          updated_at?: string
          updated_by?: string | null
          wp_post_id: number
        }
        Update: {
          confirmation_status?: string
          evidence?: string
          service_slug?: string
          source_key?: string
          updated_at?: string
          updated_by?: string | null
          wp_post_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "eut_legacy_profile_services_service_slug_fkey"
            columns: ["service_slug"]
            isOneToOne: false
            referencedRelation: "eut_service_types"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "eut_legacy_profile_services_source_key_wp_post_id_fkey"
            columns: ["source_key", "wp_post_id"]
            isOneToOne: false
            referencedRelation: "eut_legacy_profile_management"
            referencedColumns: ["source_key", "wp_post_id"]
          },
        ]
      }
      eut_legacy_service_areas: {
        Row: {
          created_at: string
          evidence: string
          municipality: string
          neighborhood: string
          source_key: string
          state_uf: string
          status: string
          updated_at: string
          updated_by: string | null
          wp_post_id: number
        }
        Insert: {
          created_at?: string
          evidence?: string
          municipality: string
          neighborhood?: string
          source_key: string
          state_uf: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          wp_post_id: number
        }
        Update: {
          created_at?: string
          evidence?: string
          municipality?: string
          neighborhood?: string
          source_key?: string
          state_uf?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          wp_post_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "eut_legacy_service_areas_source_key_wp_post_id_fkey"
            columns: ["source_key", "wp_post_id"]
            isOneToOne: false
            referencedRelation: "eut_legacy_profile_management"
            referencedColumns: ["source_key", "wp_post_id"]
          },
        ]
      }
      eut_legacy_specialty_evidence: {
        Row: {
          imported_at: string
          review_state: string
          source_key: string
          source_label: string
          taxonomy: string
          term_name: string
          wp_post_id: number
        }
        Insert: {
          imported_at?: string
          review_state?: string
          source_key: string
          source_label?: string
          taxonomy: string
          term_name: string
          wp_post_id: number
        }
        Update: {
          imported_at?: string
          review_state?: string
          source_key?: string
          source_label?: string
          taxonomy?: string
          term_name?: string
          wp_post_id?: number
        }
        Relationships: []
      }
      eut_legacy_url_routes: {
        Row: {
          created_at: string
          display_name: string | null
          kind: string
          slug: string
          source_key: string
          status: string
          wp_post_id: number
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          kind: string
          slug: string
          source_key: string
          status?: string
          wp_post_id: number
        }
        Update: {
          created_at?: string
          display_name?: string | null
          kind?: string
          slug?: string
          source_key?: string
          status?: string
          wp_post_id?: number
        }
        Relationships: []
      }
      eut_pioneer_badges: {
        Row: {
          recognized_at: string
          technician_id: string
          tier: string
        }
        Insert: {
          recognized_at?: string
          technician_id: string
          tier?: string
        }
        Update: {
          recognized_at?: string
          technician_id?: string
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "eut_pioneer_badges_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: true
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      eut_service_categories: {
        Row: {
          active: boolean
          created_at: string
          description: string
          display_order: number
          label: string
          slug: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          display_order?: number
          label: string
          slug: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          display_order?: number
          label?: string
          slug?: string
        }
        Relationships: []
      }
      eut_service_types: {
        Row: {
          active: boolean
          category_slug: string
          created_at: string
          description: string
          display_order: number
          label: string
          slug: string
        }
        Insert: {
          active?: boolean
          category_slug: string
          created_at?: string
          description?: string
          display_order?: number
          label: string
          slug: string
        }
        Update: {
          active?: boolean
          category_slug?: string
          created_at?: string
          description?: string
          display_order?: number
          label?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "eut_service_types_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "eut_service_categories"
            referencedColumns: ["slug"]
          },
        ]
      }
      eut_technician_invite_codes: {
        Row: {
          code: string
          created_at: string
          technician_user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          technician_user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          technician_user_id?: string
        }
        Relationships: []
      }
      eut_technician_presence: {
        Row: {
          available: boolean
          last_seen_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          available?: boolean
          last_seen_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          available?: boolean
          last_seen_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      eut_technician_private_contacts: {
        Row: {
          allow_paid_contact: boolean
          phone_e164: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_paid_contact?: boolean
          phone_e164: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_paid_contact?: boolean
          phone_e164?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      eut_technician_referrals: {
        Row: {
          invited_at: string
          invited_user_id: string
          inviter_user_id: string
        }
        Insert: {
          invited_at?: string
          invited_user_id: string
          inviter_user_id: string
        }
        Update: {
          invited_at?: string
          invited_user_id?: string
          inviter_user_id?: string
        }
        Relationships: []
      }
      legacy_profile_claims: {
        Row: {
          claimant_id: string
          claimant_note: string
          created_at: string
          id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_key: string
          status: string
          updated_at: string
          wp_post_id: number
        }
        Insert: {
          claimant_id: string
          claimant_note?: string
          created_at?: string
          id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_key?: string
          status?: string
          updated_at?: string
          wp_post_id: number
        }
        Update: {
          claimant_id?: string
          claimant_note?: string
          created_at?: string
          id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_key?: string
          status?: string
          updated_at?: string
          wp_post_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "legacy_claim_profile_fk"
            columns: ["source_key", "wp_post_id"]
            isOneToOne: false
            referencedRelation: "legacy_review_profiles"
            referencedColumns: ["source_key", "wp_post_id"]
          },
        ]
      }
      legacy_public_archive: {
        Row: {
          city_confirmed: boolean
          contact_enabled: boolean
          country_label: string
          display_name: string
          sector_tags: string[]
          source_key: string
          validation_status: string
          wp_post_id: number
        }
        Insert: {
          city_confirmed?: boolean
          contact_enabled?: boolean
          country_label?: string
          display_name: string
          sector_tags?: string[]
          source_key?: string
          validation_status?: string
          wp_post_id: number
        }
        Update: {
          city_confirmed?: boolean
          contact_enabled?: boolean
          country_label?: string
          display_name?: string
          sector_tags?: string[]
          source_key?: string
          validation_status?: string
          wp_post_id?: number
        }
        Relationships: []
      }
      legacy_review_profiles: {
        Row: {
          demo_candidate: boolean
          imported_at: string
          kind: string
          locality_quality: string
          location1: string | null
          location2: string | null
          location3: string | null
          review_status: string
          slug: string
          source_key: string
          source_status: string
          specialty_present: boolean
          specialty_title: string | null
          title: string
          wp_post_id: number
          wp_sector_tags: string[]
          wp_user_id: number
        }
        Insert: {
          demo_candidate?: boolean
          imported_at?: string
          kind: string
          locality_quality?: string
          location1?: string | null
          location2?: string | null
          location3?: string | null
          review_status?: string
          slug: string
          source_key: string
          source_status: string
          specialty_present?: boolean
          specialty_title?: string | null
          title: string
          wp_post_id: number
          wp_sector_tags?: string[]
          wp_user_id: number
        }
        Update: {
          demo_candidate?: boolean
          imported_at?: string
          kind?: string
          locality_quality?: string
          location1?: string | null
          location2?: string | null
          location3?: string | null
          review_status?: string
          slug?: string
          source_key?: string
          source_status?: string
          specialty_present?: boolean
          specialty_title?: string | null
          title?: string
          wp_post_id?: number
          wp_sector_tags?: string[]
          wp_user_id?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      search_events: {
        Row: {
          category: string
          city: string
          created_at: string
          filters: string[]
          id: string
          region: string
          result_count: number
          updated_at: string
        }
        Insert: {
          category?: string
          city?: string
          created_at?: string
          filters?: string[]
          id?: string
          region?: string
          result_count?: number
          updated_at?: string
        }
        Update: {
          category?: string
          city?: string
          created_at?: string
          filters?: string[]
          id?: string
          region?: string
          result_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      service_requests: {
        Row: {
          accepted_at: string | null
          category: string
          city: string
          client_id: string
          created_at: string
          description: string
          id: string
          region: string | null
          status: Database["public"]["Enums"]["request_status"]
          technician_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          category: string
          city: string
          client_id: string
          created_at?: string
          description: string
          id?: string
          region?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          technician_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          category?: string
          city?: string
          client_id?: string
          created_at?: string
          description?: string
          id?: string
          region?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          technician_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      technicians: {
        Row: {
          avatar_path: string | null
          bio: string | null
          city: string
          coverage_city_ids: number[]
          created_at: string
          display_name: string
          id: string
          neighborhood: string | null
          public_slug: string
          region: string | null
          reviewed_at: string | null
          service_radius_km: number | null
          service_slugs: string[]
          specialties: string[]
          state_uf: string | null
          status: Database["public"]["Enums"]["approval_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_path?: string | null
          bio?: string | null
          city: string
          coverage_city_ids?: number[]
          created_at?: string
          display_name: string
          id?: string
          neighborhood?: string | null
          public_slug: string
          region?: string | null
          reviewed_at?: string | null
          service_radius_km?: number | null
          service_slugs?: string[]
          specialties?: string[]
          state_uf?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_path?: string | null
          bio?: string | null
          city?: string
          coverage_city_ids?: number[]
          created_at?: string
          display_name?: string
          id?: string
          neighborhood?: string | null
          public_slug?: string
          region?: string | null
          reviewed_at?: string | null
          service_radius_km?: number | null
          service_slugs?: string[]
          specialties?: string[]
          state_uf?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technicians_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_search_metrics: { Args: never; Returns: Json }
      choose_account_type: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
      }
      eut_accept_member_invitation: { Args: never; Returns: Json }
      eut_accept_technician_invite: { Args: { _code: string }; Returns: string }
      eut_account_operational: { Args: never; Returns: boolean }
      eut_admin_account_edit_name: {
        Args: { _full_name: string; _reason: string; _user_id: string }
        Returns: Json
      }
      eut_admin_accounts_snapshot: {
        Args: { _filter?: string; _page?: number; _search?: string }
        Returns: Json
      }
      eut_admin_client_insights: {
        Args: {
          _audit_filter?: string
          _page?: number
          _subject_user_id?: string
        }
        Returns: Json
      }
      eut_admin_contact_action: {
        Args: {
          _action: string
          _block_id?: string
          _message_id?: string
          _message_status?: string
          _phone?: string
          _reason?: string
          _user_id?: string
        }
        Returns: Json
      }
      eut_admin_contact_reveal: {
        Args: { _reason: string; _user_id: string }
        Returns: Json
      }
      eut_admin_contacts_dashboard: {
        Args: { _filter?: string; _page?: number; _search?: string }
        Returns: Json
      }
      eut_admin_enable_my_technician_role: { Args: never; Returns: Json }
      eut_admin_identity_get: { Args: { _record_key: string }; Returns: Json }
      eut_admin_identity_save: {
        Args: {
          _expected_updated_at: string
          _payload: Json
          _reason: string
          _record_key: string
        }
        Returns: Json
      }
      eut_admin_legacy_action: {
        Args: {
          p_action: string
          p_ids: number[]
          p_reason: string
          p_value: string
        }
        Returns: Json
      }
      eut_admin_member_invite_action: {
        Args: {
          _action: string
          _email?: string
          _invite_id?: string
          _reason?: string
          _role?: Database["public"]["Enums"]["app_role"]
        }
        Returns: Json
      }
      eut_admin_member_invites_snapshot: { Args: never; Returns: Json }
      eut_admin_set_home_public_proof: {
        Args: { _enabled: boolean; _expected_enabled: boolean; _reason: string }
        Returns: Json
      }
      eut_admin_technician_action: {
        Args: {
          p_action: string
          p_id: string
          p_reason: string
          p_value: Json
        }
        Returns: Json
      }
      eut_admin_technician_archive: {
        Args: {
          _action: string
          _expected_updated_at: string
          _reason: string
          _technician_id: string
        }
        Returns: Json
      }
      eut_admin_technician_change: {
        Args: {
          _expected_updated_at: string
          _payload: Json
          _reason: string
          _technician_id: string
        }
        Returns: Json
      }
      eut_admin_technician_coverage: {
        Args: {
          _expected_updated_at?: string
          _payload?: Json
          _reason?: string
          _technician_id: string
        }
        Returns: Json
      }
      eut_admin_technician_record_archive: {
        Args: {
          _action: string
          _expected_updated_at: string
          _reason: string
          _technician_id: string
        }
        Returns: Json
      }
      eut_admin_technician_record_save: {
        Args: {
          _expected_updated_at: string
          _origin: string
          _payload: Json
          _reason: string
          _source_id: string
        }
        Returns: Json
      }
      eut_admin_technician_registry_list: {
        Args: { _limit?: number; _offset?: number; _search?: string }
        Returns: {
          admin_active: boolean
          archived: boolean
          category_slugs: string[]
          city_ibge_id: number
          contact_last4: string
          ddd: string
          display_name: string
          is_demo: boolean
          origin: string
          region_approx: string
          service_slugs: string[]
          source_id: string
          technician_id: string
          total_count: number
          updated_at: string
        }[]
      }
      eut_admin_unified_contact: {
        Args: { _reason?: string; _record_key: string }
        Returns: Json
      }
      eut_admin_users_unified_360: {
        Args: {
          _after_key?: string
          _after_name?: string
          _limit?: number
          _role?: string
          _search?: string
          _state?: string
        }
        Returns: Json
      }
      eut_ads_admin_activate_card: {
        Args: {
          _approval_note: string
          _campaign_id: string
          _creative_id: string
          _placement_id: string
        }
        Returns: Json
      }
      eut_ads_admin_activate_image: {
        Args: {
          _approval_note: string
          _campaign_id: string
          _creative_id: string
          _placement_id: string
        }
        Returns: Json
      }
      eut_ads_admin_save: {
        Args: { _data: Json; _kind: string }
        Returns: Json
      }
      eut_ads_admin_snapshot: { Args: never; Returns: Json }
      eut_ads_can_copy_approved_asset: {
        Args: { _path: string }
        Returns: boolean
      }
      eut_ads_public_slot: {
        Args: { _route_path: string; _slot_key: string }
        Returns: Json
      }
      eut_attest_technician_email_otp: { Args: never; Returns: Json }
      eut_begin_technician_email_otp: { Args: never; Returns: Json }
      eut_bootstrap_legacy_admin: { Args: never; Returns: string }
      eut_bootstrap_project_owner: { Args: never; Returns: string }
      eut_can_bootstrap_legacy_admin: { Args: never; Returns: boolean }
      eut_can_bootstrap_project_owner: { Args: never; Returns: boolean }
      eut_claim_my_pioneer_pre_registration: { Args: never; Returns: Json }
      eut_confirm_my_legacy_account: { Args: never; Returns: Json }
      eut_contact_access_quote: {
        Args: { _technician_id: string }
        Returns: Json
      }
      eut_home_public_proof_visible: { Args: never; Returns: boolean }
      eut_legacy_candidate_claimable: {
        Args: { _source_key: string; _wp_post_id: number }
        Returns: boolean
      }
      eut_link_my_legacy_account: { Args: never; Returns: string }
      eut_my_legacy_account: {
        Args: never
        Returns: {
          activation_state: string
          directory_profiles: number
          intended_type: string
          legacy_name: string
        }[]
      }
      eut_my_legacy_candidate_profiles: {
        Args: never
        Returns: {
          display_name: string
          wp_post_id: number
        }[]
      }
      eut_my_linked_legacy_candidate_details: {
        Args: never
        Returns: {
          legacy_bio: string
          legacy_location1: string
          legacy_location2: string
          legacy_location3: string
          legacy_name: string
          legacy_specialty: string
          wp_post_id: number
        }[]
      }
      eut_my_member_invitation: { Args: never; Returns: Json }
      eut_my_presence_is_online: { Args: never; Returns: boolean }
      eut_my_private_contact: { Args: never; Returns: Json }
      eut_my_referral_dashboard: { Args: never; Returns: Json }
      eut_online_published_ids: {
        Args: { _technician_ids: string[] }
        Returns: {
          technician_id: string
        }[]
      }
      eut_owner_directory_settings: { Args: never; Returns: Json }
      eut_owner_update_directory_settings: {
        Args: { _expected_version: number; _reason: string; _settings: Json }
        Returns: Json
      }
      eut_prepare_contact_purchase: {
        Args: { _technician_id: string }
        Returns: Json
      }
      eut_public_admin_technicians: {
        Args: {
          _category?: string
          _city?: string
          _limit?: number
          _offset?: number
          _region?: string
          _service?: string
          _slug?: string
          _uf?: string
        }
        Returns: Json[]
      }
      eut_public_directory_settings: { Args: never; Returns: Json }
      eut_public_eligible_technician_ids: {
        Args: { _ids: string[] }
        Returns: {
          technician_id: string
        }[]
      }
      eut_public_legacy_archive_page: {
        Args: { _limit?: number; _offset?: number }
        Returns: Json
      }
      eut_public_online_technician_ids: {
        Args: never
        Returns: {
          technician_id: string
        }[]
      }
      eut_public_referral_highlights: {
        Args: { _technician_ids: string[] }
        Returns: {
          technician_id: string
        }[]
      }
      eut_publish_my_technician: {
        Args: {
          _bio?: string
          _city: string
          _display_name: string
          _neighborhood?: string
          _region?: string
          _service_slugs: string[]
          _specialties: string[]
          _state_uf: string
        }
        Returns: Json
      }
      eut_remove_my_private_contact: { Args: never; Returns: boolean }
      eut_remove_my_technician_profile: { Args: never; Returns: Json }
      eut_respond_to_direct_request: {
        Args: { _body: string; _request_id: string }
        Returns: Json
      }
      eut_reveal_paid_technician_contact: {
        Args: { _technician_id: string }
        Returns: Json
      }
      eut_save_my_private_contact: {
        Args: { _allow_paid_contact: boolean; _phone: string }
        Returns: Json
      }
      eut_set_my_presence: { Args: { _available: boolean }; Returns: string }
      eut_set_my_technician_avatar: { Args: { _path: string }; Returns: Json }
      eut_set_my_technician_coverage: {
        Args: { _city_ids: number[]; _radius_km: number }
        Returns: Json
      }
      eut_share_direct_request: { Args: { _request_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      my_technician_id: { Args: never; Returns: string }
      set_request_status: {
        Args: {
          _id: string
          _status: Database["public"]["Enums"]["request_status"]
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "tecnico" | "cliente"
      approval_status: "pendente" | "aprovado" | "rejeitado" | "suspenso"
      request_status:
        | "aberta"
        | "aceita"
        | "recusada"
        | "concluida"
        | "cancelada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "tecnico", "cliente"],
      approval_status: ["pendente", "aprovado", "rejeitado", "suspenso"],
      request_status: [
        "aberta",
        "aceita",
        "recusada",
        "concluida",
        "cancelada",
      ],
    },
  },
} as const
