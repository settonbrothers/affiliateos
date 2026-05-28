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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_runs: {
        Row: {
          agent_version: string
          completed_at: string | null
          created_at: string
          credits_charged: number | null
          envelope: Json | null
          error_message: string | null
          estimated_cost: number | null
          id: string
          input_payload: Json
          langfuse_trace_id: string | null
          model: string
          offer_id: string | null
          orchestrator_name: string
          output_payload: Json | null
          prompt_version_id: string | null
          provider: string
          related_entity_id: string | null
          related_entity_type: string | null
          started_at: string
          status: Database["public"]["Enums"]["ai_run_status"]
          tokens_input: number | null
          tokens_output: number | null
          user_id: string | null
          validated_output: Json | null
          workspace_id: string | null
        }
        Insert: {
          agent_version: string
          completed_at?: string | null
          created_at?: string
          credits_charged?: number | null
          envelope?: Json | null
          error_message?: string | null
          estimated_cost?: number | null
          id?: string
          input_payload: Json
          langfuse_trace_id?: string | null
          model: string
          offer_id?: string | null
          orchestrator_name: string
          output_payload?: Json | null
          prompt_version_id?: string | null
          provider?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["ai_run_status"]
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string | null
          validated_output?: Json | null
          workspace_id?: string | null
        }
        Update: {
          agent_version?: string
          completed_at?: string | null
          created_at?: string
          credits_charged?: number | null
          envelope?: Json | null
          error_message?: string | null
          estimated_cost?: number | null
          id?: string
          input_payload?: Json
          langfuse_trace_id?: string | null
          model?: string
          offer_id?: string | null
          orchestrator_name?: string
          output_payload?: Json | null
          prompt_version_id?: string | null
          provider?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["ai_run_status"]
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string | null
          validated_output?: Json | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_runs_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_user_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          reason: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          reason?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          context: Json | null
          created_at: string
          id: string
          message: string
          severity: Database["public"]["Enums"]["error_severity"]
          source: string
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: string
          message: string
          severity: Database["public"]["Enums"]["error_severity"]
          source: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: string
          message?: string
          severity?: Database["public"]["Enums"]["error_severity"]
          source?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "error_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      failed_messages: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          max_attempts: number
          message_type: Database["public"]["Enums"]["failed_message_type"]
          next_retry_at: string | null
          payload: Json
          status: Database["public"]["Enums"]["failed_message_status"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          message_type: Database["public"]["Enums"]["failed_message_type"]
          next_retry_at?: string | null
          payload: Json
          status?: Database["public"]["Enums"]["failed_message_status"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          message_type?: Database["public"]["Enums"]["failed_message_type"]
          next_retry_at?: string | null
          payload?: Json
          status?: Database["public"]["Enums"]["failed_message_status"]
          updated_at?: string
        }
        Relationships: []
      }
      offers: {
        Row: {
          affiliate_program_url: string | null
          created_at: string
          created_by_user_id: string
          evaluation: Json | null
          id: string
          logo_url: string | null
          name: string
          network: string | null
          primary_language: string | null
          short_description: string | null
          slug: string
          status: Database["public"]["Enums"]["offer_status"]
          updated_at: string
          vendor_name: string | null
          vertical_id: string
          visibility: Database["public"]["Enums"]["offer_visibility"]
          website_url: string | null
          workspace_id: string | null
        }
        Insert: {
          affiliate_program_url?: string | null
          created_at?: string
          created_by_user_id: string
          evaluation?: Json | null
          id?: string
          logo_url?: string | null
          name: string
          network?: string | null
          primary_language?: string | null
          short_description?: string | null
          slug: string
          status?: Database["public"]["Enums"]["offer_status"]
          updated_at?: string
          vendor_name?: string | null
          vertical_id: string
          visibility?: Database["public"]["Enums"]["offer_visibility"]
          website_url?: string | null
          workspace_id?: string | null
        }
        Update: {
          affiliate_program_url?: string | null
          created_at?: string
          created_by_user_id?: string
          evaluation?: Json | null
          id?: string
          logo_url?: string | null
          name?: string
          network?: string | null
          primary_language?: string | null
          short_description?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["offer_status"]
          updated_at?: string
          vendor_name?: string | null
          vertical_id?: string
          visibility?: Database["public"]["Enums"]["offer_visibility"]
          website_url?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          system_role: Database["public"]["Enums"]["system_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          system_role?: Database["public"]["Enums"]["system_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          system_role?: Database["public"]["Enums"]["system_role"]
          updated_at?: string
        }
        Relationships: []
      }
      verticals: {
        Row: {
          created_at: string
          display_order: number
          enabled_for_users: boolean
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          enabled_for_users?: boolean
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          display_order?: number
          enabled_for_users?: boolean
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_current_user_admin: { Args: never; Returns: boolean }
      is_workspace_member: { Args: { ws_id: string }; Returns: boolean }
    }
    Enums: {
      ai_run_status: "pending" | "running" | "success" | "partial" | "failed"
      audit_action:
        | "offer.create"
        | "offer.update"
        | "offer.delete"
        | "offer.publish"
        | "ai_run.start"
        | "ai_run.complete"
        | "prompt.activate"
        | "prompt.rollback"
        | "kill_switch.toggle"
        | "credit.grant"
        | "credit.deduct"
        | "credit.refund"
        | "user.invite"
        | "user.delete"
        | "fact.approve"
        | "fact.reject"
        | "subscription.create"
        | "subscription.cancel"
      error_severity: "debug" | "info" | "warning" | "error" | "critical"
      failed_message_status: "pending" | "retrying" | "succeeded" | "abandoned"
      failed_message_type:
        | "ai_run"
        | "webhook_send"
        | "email_send"
        | "stripe_webhook"
      offer_status:
        | "draft"
        | "needs_source_ingestion"
        | "ready_for_analysis"
        | "ai_analyzed"
        | "published"
        | "rejected"
        | "deprecated"
      offer_visibility: "global" | "workspace_private" | "admin_only"
      system_role: "user" | "admin"
      workspace_role: "owner" | "member"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      ai_run_status: ["pending", "running", "success", "partial", "failed"],
      audit_action: [
        "offer.create",
        "offer.update",
        "offer.delete",
        "offer.publish",
        "ai_run.start",
        "ai_run.complete",
        "prompt.activate",
        "prompt.rollback",
        "kill_switch.toggle",
        "credit.grant",
        "credit.deduct",
        "credit.refund",
        "user.invite",
        "user.delete",
        "fact.approve",
        "fact.reject",
        "subscription.create",
        "subscription.cancel",
      ],
      error_severity: ["debug", "info", "warning", "error", "critical"],
      failed_message_status: ["pending", "retrying", "succeeded", "abandoned"],
      failed_message_type: [
        "ai_run",
        "webhook_send",
        "email_send",
        "stripe_webhook",
      ],
      offer_status: [
        "draft",
        "needs_source_ingestion",
        "ready_for_analysis",
        "ai_analyzed",
        "published",
        "rejected",
        "deprecated",
      ],
      offer_visibility: ["global", "workspace_private", "admin_only"],
      system_role: ["user", "admin"],
      workspace_role: ["owner", "member"],
    },
  },
} as const
