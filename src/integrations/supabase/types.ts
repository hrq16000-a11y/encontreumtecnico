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
      legacy_review_profiles: {
        Row: {
          demo_candidate: boolean
          imported_at: string
          kind: string
          location1: string | null
          location2: string | null
          location3: string | null
          review_status: string
          slug: string
          source_key: string
          source_status: string
          specialty_title: string | null
          title: string
          wp_post_id: number
          wp_user_id: number
        }
        Insert: {
          demo_candidate?: boolean
          imported_at?: string
          kind: string
          location1?: string | null
          location2?: string | null
          location3?: string | null
          review_status?: string
          slug: string
          source_key: string
          source_status: string
          specialty_title?: string | null
          title: string
          wp_post_id: number
          wp_user_id: number
        }
        Update: {
          demo_candidate?: boolean
          imported_at?: string
          kind?: string
          location1?: string | null
          location2?: string | null
          location3?: string | null
          review_status?: string
          slug?: string
          source_key?: string
          source_status?: string
          specialty_title?: string | null
          title?: string
          wp_post_id?: number
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
          bio: string | null
          city: string
          created_at: string
          display_name: string
          id: string
          neighborhood: string | null
          state_uf: string | null
          service_slugs: string[]
          region: string | null
          reviewed_at: string | null
          specialties: string[]
          status: Database["public"]["Enums"]["approval_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          city: string
          created_at?: string
          display_name: string
          id?: string
          neighborhood?: string | null
          state_uf?: string | null
          service_slugs?: string[]
          region?: string | null
          reviewed_at?: string | null
          specialties?: string[]
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          city?: string
          created_at?: string
          display_name?: string
          id?: string
          neighborhood?: string | null
          state_uf?: string | null
          service_slugs?: string[]
          region?: string | null
          reviewed_at?: string | null
          specialties?: string[]
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
