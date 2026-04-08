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
      capture_tags: {
        Row: {
          capture_id: string
          created_at: string
          tag_id: string
          user_id: string
        }
        Insert: {
          capture_id: string
          created_at?: string
          tag_id: string
          user_id: string
        }
        Update: {
          capture_id?: string
          created_at?: string
          tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capture_tags_capture_id_fkey"
            columns: ["capture_id"]
            isOneToOne: false
            referencedRelation: "captures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capture_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capture_tags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      captures: {
        Row: {
          body: string | null
          captured_at: string
          chunk_index: number | null
          created_at: string
          enrichment_profile: string
          fts_body: unknown
          id: string
          is_chunked: boolean
          is_starred: boolean
          media_paths: string[] | null
          parent_id: string | null
          source_metadata: Json | null
          source_title: string | null
          source_type: string
          source_url: string | null
          status: string
          title: string | null
          type: string
          updated_at: string
          user_context: string | null
          user_id: string
          visibility: string
        }
        Insert: {
          body?: string | null
          captured_at?: string
          chunk_index?: number | null
          created_at?: string
          enrichment_profile: string
          fts_body?: unknown
          id?: string
          is_chunked?: boolean
          is_starred?: boolean
          media_paths?: string[] | null
          parent_id?: string | null
          source_metadata?: Json | null
          source_title?: string | null
          source_type: string
          source_url?: string | null
          status?: string
          title?: string | null
          type: string
          updated_at?: string
          user_context?: string | null
          user_id: string
          visibility?: string
        }
        Update: {
          body?: string | null
          captured_at?: string
          chunk_index?: number | null
          created_at?: string
          enrichment_profile?: string
          fts_body?: unknown
          id?: string
          is_chunked?: boolean
          is_starred?: boolean
          media_paths?: string[] | null
          parent_id?: string | null
          source_metadata?: Json | null
          source_title?: string | null
          source_type?: string
          source_url?: string | null
          status?: string
          title?: string | null
          type?: string
          updated_at?: string
          user_context?: string | null
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "captures_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "captures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captures_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichments: {
        Row: {
          capture_id: string
          capture_intent: string | null
          embedding: string | null
          energy_level: string | null
          enrichment_status: string
          entities: Json | null
          id: string
          key_quotes: string[] | null
          model_used: string | null
          mood_tags: string[] | null
          people_mentioned: string[] | null
          processed_at: string | null
          questions_raised: string[] | null
          sentiment: string | null
          source_sentiment: string | null
          summary: string | null
          themes: string[] | null
          time_of_day_cat: string | null
          updated_at: string
          user_context: string | null
        }
        Insert: {
          capture_id: string
          capture_intent?: string | null
          embedding?: string | null
          energy_level?: string | null
          enrichment_status?: string
          entities?: Json | null
          id?: string
          key_quotes?: string[] | null
          model_used?: string | null
          mood_tags?: string[] | null
          people_mentioned?: string[] | null
          processed_at?: string | null
          questions_raised?: string[] | null
          sentiment?: string | null
          source_sentiment?: string | null
          summary?: string | null
          themes?: string[] | null
          time_of_day_cat?: string | null
          updated_at?: string
          user_context?: string | null
        }
        Update: {
          capture_id?: string
          capture_intent?: string | null
          embedding?: string | null
          energy_level?: string | null
          enrichment_status?: string
          entities?: Json | null
          id?: string
          key_quotes?: string[] | null
          model_used?: string | null
          mood_tags?: string[] | null
          people_mentioned?: string[] | null
          processed_at?: string | null
          questions_raised?: string[] | null
          sentiment?: string | null
          source_sentiment?: string | null
          summary?: string | null
          themes?: string[] | null
          time_of_day_cat?: string | null
          updated_at?: string
          user_context?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrichments_capture_id_fkey"
            columns: ["capture_id"]
            isOneToOne: true
            referencedRelation: "captures"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          memory_document: string | null
          memory_updated_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          memory_document?: string | null
          memory_updated_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          memory_document?: string | null
          memory_updated_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          id: string
          name: string
          user_id: string
        }
        Insert: {
          id?: string
          name: string
          user_id: string
        }
        Update: {
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_user_id_fkey"
            columns: ["user_id"]
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
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
