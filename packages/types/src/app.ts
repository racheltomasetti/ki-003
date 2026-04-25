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

export type CaptureStatus = 'active' | 'archived' | 'deleted'

export type Visibility = 'private' | 'friends' | 'public'

export type EnrichmentProfile = 'personal' | 'artifact'

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

export interface Project {
  id: string
  user_id: string
  name: string
  description: string | null
  color: string | null
  brief: string | null
  brief_generated_at: string | null
  created_at: string
  updated_at: string
}

export interface CaptureProject {
  capture_id: string
  project_id: string
  user_id: string
  created_at: string
  projects?: Project
}

// ─── Derived / composed types used in the UI ─────────────────────────────────

export interface CaptureWithEnrichment extends Capture {
  enrichments: Enrichment | null
  capture_tags: CaptureTag[]
  capture_projects?: CaptureProject[]
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

export type ProfileUpdate = Partial<
  Pick<Profile, 'display_name' | 'avatar_url' | 'bio' | 'memory_document' | 'memory_updated_at'>
>
