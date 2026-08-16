// Ki — captures service
//
// All capture CRUD lives here. Nothing else in the codebase touches captures
// directly. Every function accepts a Supabase client — mobile passes its own,
// web passes its own. Same logic, different clients.
//
// TODO: Once migrations are written and `supabase gen types` is run, replace
// SupabaseClient with SupabaseClient<Database> from @ki/types for full type inference.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Capture, CaptureInsert, CaptureStatus, DistilledCaptureMetadata } from '@ki/types'
import { addCaptureToPursuit } from './pursuits'

export interface GetCapturesOptions {
  status?: CaptureStatus
  tagId?: string
  search?: string
  parentId?: string | null
  limit?: number
  offset?: number
}

export async function getCaptures(client: SupabaseClient, options: GetCapturesOptions = {}) {
  const { status = 'active', tagId, search, parentId, limit = 30, offset = 0 } = options

  let query = client
    .from('captures')
    .select(`
      *,
      enrichments (*),
      capture_tags (
        tag_id,
        tags (id, name)
      ),
      capture_pursuits (
        pursuit_id
      )
    `)
    .neq('status', 'deleted')
    .is('parent_id', parentId ?? null)
    .order('captured_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status !== 'deleted') {
    query = query.eq('status', status)
  }

  if (tagId) {
    query = query.eq('capture_tags.tag_id', tagId)
  }

  if (search) {
    // Phase 1: Postgres full-text search on body
    // Phase 2: replace with hybrid BM25 + pgvector
    query = query.textSearch('body', search, { type: 'websearch' })
  }

  return query
}

export async function getCaptureCounts(
  client: SupabaseClient,
  userId: string
): Promise<{ total: number; distilled: number }> {
  const [{ count: total }, { count: distilled }] = await Promise.all([
    client
      .from('captures')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active')
      .neq('source_type', 'distilled'),
    client
      .from('captures')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('source_type', 'distilled')
      .eq('status', 'active'),
  ])
  return { total: total ?? 0, distilled: distilled ?? 0 }
}

export async function getCapture(client: SupabaseClient, id: string) {
  return client
    .from('captures')
    .select(`
      *,
      enrichments (*),
      capture_tags (
        tag_id,
        tags (id, name)
      )
    `)
    .eq('id', id)
    .single()
}

export async function createCapture(
  client: SupabaseClient,
  capture: CaptureInsert & { user_id: string }
): Promise<Capture> {
  const { data, error } = await client
    .from('captures')
    .insert({
      ...capture,
      captured_at: capture.captured_at ?? new Date().toISOString(),
    })
    .select()
    .single()
  if (error) throw error
  return data as Capture
}

export interface SaveArtifactCaptureParams {
  userId: string
  body: string
  title?: string | null
  referencedCaptureIds: string[]
  pursuitId?: string   // present when saved from a pursuit workspace, absent from global Create
}

/**
 * Save a Create-panel artifact (or a distilled chat message) as a capture.
 * The single save path for both the pursuit workspace and global Create —
 * replaces any direct-insert done in a component. enrichment_profile is
 * 'distilled' (not 'personal'): enrich-capture doesn't yet branch on this
 * field for any value, so it's a no-op today, but it's the semantically
 * correct value migration 010 exists for.
 */
export async function saveArtifactCapture(
  client: SupabaseClient,
  params: SaveArtifactCaptureParams
): Promise<Capture> {
  const { userId, body, title, referencedCaptureIds, pursuitId } = params
  const distilledAt = new Date().toISOString()

  const metadata: DistilledCaptureMetadata = {
    referenced_capture_ids: referencedCaptureIds,
    distilled_at: distilledAt,
    ...(pursuitId ? { pursuit_id: pursuitId } : {}),
  }

  const { data, error } = await client
    .from('captures')
    .insert({
      user_id: userId,
      type: 'text',
      source_type: 'distilled',
      enrichment_profile: 'distilled',
      title: title ?? null,
      body,
      captured_at: distilledAt,
      source_metadata: metadata,
    })
    .select()
    .single()

  if (error) throw error
  const capture = data as Capture

  if (pursuitId) {
    const { error: linkError } = await addCaptureToPursuit(client, capture.id, pursuitId, userId)
    if (linkError) throw linkError
  }

  return capture
}

// body is the one field that is never updated after write — enforced here
export async function updateCaptureStatus(
  client: SupabaseClient,
  id: string,
  status: CaptureStatus
) {
  return client
    .from('captures')
    .update({ status })
    .eq('id', id)
    .select()
    .single()
}

export async function deleteCapture(client: SupabaseClient, id: string) {
  return client
    .from('captures')
    .delete()
    .eq('id', id)
}

export async function starCapture(client: SupabaseClient, id: string, isStarred: boolean) {
  return client
    .from('captures')
    .update({ is_starred: isStarred })
    .eq('id', id)
    .select()
    .single()
}

export async function updateCaptureTitle(client: SupabaseClient, id: string, title: string) {
  return client
    .from('captures')
    .update({ title })
    .eq('id', id)
    .select()
    .single()
}

export async function updateCaptureVisibility(
  client: SupabaseClient,
  id: string,
  visibility: 'private' | 'friends' | 'public'
) {
  return client
    .from('captures')
    .update({ visibility })
    .eq('id', id)
    .select()
    .single()
}

// Tags
export async function addTagToCapture(
  client: SupabaseClient,
  captureId: string,
  tagId: string,
  userId: string
) {
  return client
    .from('capture_tags')
    .insert({ capture_id: captureId, tag_id: tagId, user_id: userId })
}

export async function removeTagFromCapture(
  client: SupabaseClient,
  captureId: string,
  tagId: string
) {
  return client
    .from('capture_tags')
    .delete()
    .eq('capture_id', captureId)
    .eq('tag_id', tagId)
}

export async function getTags(client: SupabaseClient, userId: string) {
  return client
    .from('tags')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true })
}

export async function createTag(client: SupabaseClient, userId: string, name: string) {
  return client
    .from('tags')
    .upsert({ user_id: userId, name: name.toLowerCase().trim() }, { onConflict: 'user_id,name' })
    .select()
    .single()
}
