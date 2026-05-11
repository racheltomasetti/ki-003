// Ki — shared app-level TypeScript types
// These mirror the database schema exactly.
// When supabase gen types runs, use the generated Database type for Supabase client
// calls. Use these types for UI-layer logic, props, and state.

// ─── Enums ───────────────────────────────────────────────────────────────────

export type CaptureType = 'voice' | 'text' | 'file'

export type SourceType =
  | 'voice'
  | 'text'
  | 'file'
  | 'oura'
  | 'apple_health'
  | 'manual'
  | 'distilled'

export type CaptureStatus = 'active' | 'archived' | 'deleted'

export type Visibility = 'private' | 'friends' | 'public'

export type EnrichmentProfile = 'personal' | 'artifact' | 'distilled'

export type EnrichmentStatus = 'pending' | 'complete' | 'failed'

export type Sentiment = 'positive' | 'neutral' | 'negative' | 'mixed'

export type EnergyLevel = 'low' | 'medium' | 'high'

export type CaptureIntent =
  | 'reflection'
  | 'idea'
  | 'question'
  | 'observation'
  | 'gratitude'
  | 'processing'

export type TimeOfDayCat = 'morning' | 'afternoon' | 'evening' | 'night'

// ─── Core entities ───────────────────────────────────────────────────────────

export interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  memory_document: string | null
  memory_updated_at: string | null
  created_at: string
  updated_at: string
}

export interface Capture {
  id: string
  user_id: string
  type: CaptureType
  source_type: SourceType
  source_url: string | null
  source_title: string | null
  source_metadata: Record<string, unknown> | null
  title: string | null
  body: string | null
  media_paths: string[] | null
  user_context: string | null
  parent_id: string | null
  chunk_index: number | null
  is_chunked: boolean
  enrichment_profile: EnrichmentProfile
  status: CaptureStatus
  visibility: Visibility
  is_starred: boolean
  captured_at: string
  created_at: string
  updated_at: string
}

export interface Enrichment {
  id: string
  capture_id: string
  summary: string | null
  themes: string[] | null
  sentiment: Sentiment | null
  mood_tags: string[] | null
  energy_level: EnergyLevel | null
  capture_intent: CaptureIntent | null
  questions_raised: string[] | null
  people_mentioned: string[] | null
  time_of_day_cat: TimeOfDayCat | null
  key_quotes: string[] | null
  entities: Record<string, unknown> | null
  source_sentiment: Sentiment | null
  user_context: string | null
  embedding: number[] | null
  enrichment_status: EnrichmentStatus
  processed_at: string | null
  model_used: string | null
  updated_at: string
}

export interface Tag {
  id: string
  user_id: string
  name: string
}

export interface CaptureTag {
  capture_id: string
  tag_id: string
  user_id: string
  created_at: string
  tags?: Tag
}

export type PursuitStatus = 'active' | 'curiosity' | 'archived'

export type PursuitMode = 'building' | 'researching' | 'figuring_out' | 'creating'

export type PursuitConversationRole = 'hero' | 'ki'

// source_metadata shape for distilled captures (source_type === 'distilled').
// Written at save time by the thought distiller — never by the enrichment pipeline.
export interface DistilledCaptureMetadata {
  referenced_capture_ids: string[]   // UUIDs of the captures Ki drew from during distillation
  distilled_at: string               // ISO timestamp of when the user saved this distilled thought
  pursuit_id: string                 // the pursuit workspace where this was distilled
}

// Shape of each entry in enrichments.pursuit_connections jsonb column.
// Written by enrich-capture (live) and match-corpus-to-pursuit (retroactive).
export interface PursuitConnection {
  pursuit_id: string   // uuid of the matched pursuit
  reason: string       // human-readable explanation of why this capture resonates
  confidence: number   // 0–1 cosine similarity score
  matched_at: string   // ISO timestamp — ≈ captured_at if live match, later if retroactive
}

export interface Pursuit {
  id: string
  user_id: string
  name: string
  description: string | null
  color: string | null
  status: PursuitStatus
  core_question: string | null        // null for curiosities; required for active
  core_question_embedding: number[] | null
  what: string | null
  why: string | null
  success_looks_like: string | null
  open_question: string | null
  pursuit_mode: PursuitMode | null
  created_at: string
  updated_at: string
}

export interface PursuitConversation {
  id: string
  pursuit_id: string
  user_id: string
  role: PursuitConversationRole
  content: string
  created_at: string
}

export interface PursuitArtifact {
  id: string
  pursuit_id: string
  user_id: string
  type: string
  title: string
  content: string
  data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface CapturePursuit {
  capture_id: string
  pursuit_id: string
  user_id: string
  created_at: string
  pursuits?: Pursuit
}

// ─── Derived / composed types used in the UI ─────────────────────────────────

export interface CaptureWithEnrichment extends Capture {
  enrichments: Enrichment | null
  capture_tags: CaptureTag[]
  capture_pursuits?: CapturePursuit[]
}

// ─── Insert / update payloads ─────────────────────────────────────────────────
// Omit server-generated fields. Required fields enforced.

export type CaptureInsert = Pick<
  Capture,
  'type' | 'source_type' | 'enrichment_profile'
> &
  Partial<
    Pick<
      Capture,
      | 'title'
      | 'body'            // optional: voice captures inserted before transcription completes
      | 'source_metadata'
      | 'media_paths'
      | 'user_context'
      | 'parent_id'
      | 'chunk_index'
      | 'is_chunked'
      | 'captured_at'
      | 'visibility'
    >
  >

export type CaptureStatusUpdate = Pick<Capture, 'status'>

// ─── Canvas ───────────────────────────────────────────────────────────────────

export type CanvasNodeType = 'box' | 'circle' | 'diamond' | 'text' | 'sticky'

export type CanvasCreatedBy = 'user' | 'agent'

export type CanvasStatus = 'pending' | 'accepted' | 'rejected'

export interface CanvasNode {
  id: string
  project_id: string
  user_id: string
  node_id: string
  type: CanvasNodeType | string   // string fallback for future types added without migration
  // Content — all optional, any combination valid
  title: string | null
  body: string | null
  url: string | null
  url_title: string | null
  media_paths: string[] | null
  // Layout
  position_x: number
  position_y: number
  width: number | null
  height: number | null
  // Meta
  style: Record<string, unknown> | null
  created_by: CanvasCreatedBy
  status: CanvasStatus
  created_at: string
  updated_at: string
}

export interface CanvasEdge {
  id: string
  project_id: string
  user_id: string
  edge_id: string
  source_id: string
  target_id: string
  label: string | null
  style: Record<string, unknown> | null
  created_by: CanvasCreatedBy
  status: CanvasStatus
  created_at: string
  updated_at: string
}

export interface CanvasConversation {
  id: string
  project_id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

// Insert payloads — omit server-generated fields

export type CanvasNodeInsert = Omit<CanvasNode, 'id' | 'created_at' | 'updated_at'>

export type CanvasEdgeInsert = Omit<CanvasEdge, 'id' | 'created_at' | 'updated_at'>

// Agent response schema — returned by the canvas-agent Edge Function

export type CanvasOperation =
  | {
      type: 'create_shape'
      node_id: string
      shape_type: CanvasNodeType
      title?: string
      body?: string
      url?: string
      url_title?: string
      position: { x: number; y: number }
      size: { width: number; height: number }
      style?: Record<string, string>
    }
  | {
      type: 'create_connection'
      edge_id: string
      source_node_id: string
      target_node_id: string
      label?: string
    }

export interface CanvasAgentResponse {
  operations: CanvasOperation[]
  clear_pending: boolean
  summary: string
  suggested_next?: string
}

export type ProfileUpdate = Partial<
  Pick<Profile, 'display_name' | 'avatar_url' | 'bio' | 'memory_document' | 'memory_updated_at'>
>
