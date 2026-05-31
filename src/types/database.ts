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
      agent_kill_switches: {
        Row: {
          is_paused: boolean
          orchestrator_name: string
          paused_at: string | null
          paused_by: string | null
          reason: string | null
          updated_at: string
        }
        Insert: {
          is_paused?: boolean
          orchestrator_name: string
          paused_at?: string | null
          paused_by?: string | null
          reason?: string | null
          updated_at?: string
        }
        Update: {
          is_paused?: boolean
          orchestrator_name?: string
          paused_at?: string | null
          paused_by?: string | null
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_kill_switches_paused_by_fkey"
            columns: ["paused_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      eval_runs: {
        Row: {
          accuracy_pct: number
          completed_at: string | null
          details: Json | null
          id: string
          matched_risk_flags_count: number
          matched_score_range_count: number
          matched_verdict_count: number
          prompt_id: string
          started_at: string
          total_cost_usd: number | null
          total_offers: number
          trigger_type: Database["public"]["Enums"]["eval_run_trigger"]
          triggered_by: string | null
        }
        Insert: {
          accuracy_pct: number
          completed_at?: string | null
          details?: Json | null
          id?: string
          matched_risk_flags_count: number
          matched_score_range_count: number
          matched_verdict_count: number
          prompt_id: string
          started_at?: string
          total_cost_usd?: number | null
          total_offers: number
          trigger_type: Database["public"]["Enums"]["eval_run_trigger"]
          triggered_by?: string | null
        }
        Update: {
          accuracy_pct?: number
          completed_at?: string | null
          details?: Json | null
          id?: string
          matched_risk_flags_count?: number
          matched_score_range_count?: number
          matched_verdict_count?: number
          prompt_id?: string
          started_at?: string
          total_cost_usd?: number | null
          total_offers?: number
          trigger_type?: Database["public"]["Enums"]["eval_run_trigger"]
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eval_runs_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eval_runs_triggered_by_fkey"
            columns: ["triggered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      extracted_facts: {
        Row: {
          confidence_score: number | null
          created_at: string
          fact_type: Database["public"]["Enums"]["fact_type"]
          fact_value: string
          id: string
          offer_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_document_id: string | null
          source_quote: string | null
          status: Database["public"]["Enums"]["fact_status"]
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          fact_type: Database["public"]["Enums"]["fact_type"]
          fact_value: string
          id?: string
          offer_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_document_id?: string | null
          source_quote?: string | null
          status?: Database["public"]["Enums"]["fact_status"]
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          fact_type?: Database["public"]["Enums"]["fact_type"]
          fact_value?: string
          id?: string
          offer_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_document_id?: string | null
          source_quote?: string | null
          status?: Database["public"]["Enums"]["fact_status"]
        }
        Relationships: [
          {
            foreignKeyName: "extracted_facts_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extracted_facts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extracted_facts_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "source_documents"
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
      golden_set_offers: {
        Row: {
          created_at: string
          created_by: string | null
          expected_dimension_ranges: Json | null
          expected_high_ceiling_signal: string | null
          expected_risk_flags: string[] | null
          expected_score_range: unknown
          expected_verdict: string
          external_id: string | null
          facts_snapshot: Json
          id: string
          must_mention: string[] | null
          must_not_mention: string[] | null
          notes: string | null
          offer_name: string
          offer_url: string | null
          updated_at: string
          vertical_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expected_dimension_ranges?: Json | null
          expected_high_ceiling_signal?: string | null
          expected_risk_flags?: string[] | null
          expected_score_range?: unknown
          expected_verdict: string
          external_id?: string | null
          facts_snapshot?: Json
          id?: string
          must_mention?: string[] | null
          must_not_mention?: string[] | null
          notes?: string | null
          offer_name: string
          offer_url?: string | null
          updated_at?: string
          vertical_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expected_dimension_ranges?: Json | null
          expected_high_ceiling_signal?: string | null
          expected_risk_flags?: string[] | null
          expected_score_range?: unknown
          expected_verdict?: string
          external_id?: string | null
          facts_snapshot?: Json
          id?: string
          must_mention?: string[] | null
          must_not_mention?: string[] | null
          notes?: string | null
          offer_name?: string
          offer_url?: string | null
          updated_at?: string
          vertical_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "golden_set_offers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "golden_set_offers_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_evaluation_snapshots: {
        Row: {
          ai_run_id: string
          created_at: string
          id: string
          is_current: boolean
          offer_id: string
          snapshot: Json
        }
        Insert: {
          ai_run_id: string
          created_at?: string
          id?: string
          is_current?: boolean
          offer_id: string
          snapshot: Json
        }
        Update: {
          ai_run_id?: string
          created_at?: string
          id?: string
          is_current?: boolean
          offer_id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "offer_evaluation_snapshots_ai_run_id_fkey"
            columns: ["ai_run_id"]
            isOneToOne: false
            referencedRelation: "ai_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_evaluation_snapshots_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
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
      prompts: {
        Row: {
          content: string
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          orchestrator_name: string
          prompt_type: Database["public"]["Enums"]["prompt_type"]
          version: string
          vertical_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          orchestrator_name: string
          prompt_type?: Database["public"]["Enums"]["prompt_type"]
          version: string
          vertical_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          orchestrator_name?: string
          prompt_type?: Database["public"]["Enums"]["prompt_type"]
          version?: string
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompts_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      source_documents: {
        Row: {
          created_at: string
          doc_type: Database["public"]["Enums"]["source_doc_type"]
          error_message: string | null
          extracted_at: string | null
          fetched_at: string | null
          id: string
          language: string | null
          offer_id: string
          raw_html_storage_path: string | null
          raw_text: string | null
          source_reliability_score: number | null
          source_summary: string | null
          status: Database["public"]["Enums"]["source_doc_status"]
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          doc_type?: Database["public"]["Enums"]["source_doc_type"]
          error_message?: string | null
          extracted_at?: string | null
          fetched_at?: string | null
          id?: string
          language?: string | null
          offer_id: string
          raw_html_storage_path?: string | null
          raw_text?: string | null
          source_reliability_score?: number | null
          source_summary?: string | null
          status?: Database["public"]["Enums"]["source_doc_status"]
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: Database["public"]["Enums"]["source_doc_type"]
          error_message?: string | null
          extracted_at?: string | null
          fetched_at?: string | null
          id?: string
          language?: string | null
          offer_id?: string
          raw_html_storage_path?: string | null
          raw_text?: string | null
          source_reliability_score?: number | null
          source_summary?: string | null
          status?: Database["public"]["Enums"]["source_doc_status"]
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_documents_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      source_fetch_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          offer_id: string
          source_document_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["fetch_job_status"]
          triggered_by: string
          url: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          offer_id: string
          source_document_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["fetch_job_status"]
          triggered_by: string
          url: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          offer_id?: string
          source_document_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["fetch_job_status"]
          triggered_by?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_fetch_jobs_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_fetch_jobs_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "source_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_fetch_jobs_triggered_by_fkey"
            columns: ["triggered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      workspace_credit_caps: {
        Row: {
          daily_credits_cap: number
          daily_usd_cap: number
          monthly_credits_cap: number
          monthly_usd_cap: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          daily_credits_cap?: number
          daily_usd_cap?: number
          monthly_credits_cap?: number
          monthly_usd_cap?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          daily_credits_cap?: number
          daily_usd_cap?: number
          monthly_credits_cap?: number
          monthly_usd_cap?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_credit_caps_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_daily_usage: {
        Row: {
          credits_spent: number
          day: string
          usd_spent: number
          workspace_id: string
        }
        Insert: {
          credits_spent?: number
          day: string
          usd_spent?: number
          workspace_id: string
        }
        Update: {
          credits_spent?: number
          day?: string
          usd_spent?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_daily_usage_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
      eval_run_trigger: "manual" | "cron" | "pre_publish"
      fact_status: "proposed" | "verified" | "rejected"
      fact_type:
        | "commission_value"
        | "commission_type"
        | "payout_delay"
        | "cookie_duration"
        | "traffic_rule_paid_social"
        | "traffic_rule_google"
        | "traffic_rule_native"
        | "traffic_rule_youtube"
        | "traffic_rule_brand_bidding"
        | "traffic_rule_direct_link"
        | "traffic_rule_email"
        | "traffic_rule_seo"
        | "traffic_rule_organic_social"
        | "allowed_geo"
        | "restricted_geo"
        | "cap"
        | "refund_policy"
        | "compliance_claim"
        | "pricing_aov"
        | "minimum_payout"
        | "contact"
        | "other"
      failed_message_status: "pending" | "retrying" | "succeeded" | "abandoned"
      failed_message_type:
        | "ai_run"
        | "webhook_send"
        | "email_send"
        | "stripe_webhook"
      fetch_job_status:
        | "queued"
        | "fetching"
        | "extracting"
        | "completed"
        | "failed"
      offer_status:
        | "draft"
        | "needs_source_ingestion"
        | "ready_for_analysis"
        | "ai_analyzed"
        | "published"
        | "rejected"
        | "deprecated"
      offer_visibility: "global" | "workspace_private" | "admin_only"
      prompt_type: "main" | "judge" | "extractor" | "compliance"
      source_doc_status: "pending" | "fetched" | "extracted" | "failed"
      source_doc_type:
        | "product_page"
        | "pricing_page"
        | "affiliate_terms"
        | "checkout_page"
        | "review_page"
        | "ad_example"
        | "landing_page"
        | "manual_note"
        | "unknown"
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
      eval_run_trigger: ["manual", "cron", "pre_publish"],
      fact_status: ["proposed", "verified", "rejected"],
      fact_type: [
        "commission_value",
        "commission_type",
        "payout_delay",
        "cookie_duration",
        "traffic_rule_paid_social",
        "traffic_rule_google",
        "traffic_rule_native",
        "traffic_rule_youtube",
        "traffic_rule_brand_bidding",
        "traffic_rule_direct_link",
        "traffic_rule_email",
        "traffic_rule_seo",
        "traffic_rule_organic_social",
        "allowed_geo",
        "restricted_geo",
        "cap",
        "refund_policy",
        "compliance_claim",
        "pricing_aov",
        "minimum_payout",
        "contact",
        "other",
      ],
      failed_message_status: ["pending", "retrying", "succeeded", "abandoned"],
      failed_message_type: [
        "ai_run",
        "webhook_send",
        "email_send",
        "stripe_webhook",
      ],
      fetch_job_status: [
        "queued",
        "fetching",
        "extracting",
        "completed",
        "failed",
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
      prompt_type: ["main", "judge", "extractor", "compliance"],
      source_doc_status: ["pending", "fetched", "extracted", "failed"],
      source_doc_type: [
        "product_page",
        "pricing_page",
        "affiliate_terms",
        "checkout_page",
        "review_page",
        "ad_example",
        "landing_page",
        "manual_note",
        "unknown",
      ],
      system_role: ["user", "admin"],
      workspace_role: ["owner", "member"],
    },
  },
} as const
