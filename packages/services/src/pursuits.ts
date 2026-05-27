// Ki — pursuits service
//
// Pursuits are the central organizational unit in Ki — something the user
// is carrying: a question they are living, a thing they are building, a
// direction they are moving in. Max 3 active pursuits per user.
// Curiosities (status='curiosity') are uncapped and have no core_question.
// See docs/PURSUIT_MODEL.md for full spec.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Pursuit, PursuitStatus } from '@ki/types'

export async function getPursuit(client: SupabaseClient, pursuitId: string) {
  return client
    .from('pursuits')
    .select('*')
    .eq('id', pursuitId)
    .single()
}

export async function getActivePursuits(client: SupabaseClient, userId: string) {
  return client
    .from('pursuits')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
}

export async function getCuriosities(client: SupabaseClient, userId: string) {
  return client
    .from('pursuits')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'curiosity')
    .order('created_at', { ascending: false })
}

export async function getArchivedPursuits(client: SupabaseClient, userId: string) {
  return client
    .from('pursuits')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'archived')
    .order('updated_at', { ascending: false })
}

export async function createPursuit(
  client: SupabaseClient,
  userId: string,
  data: {
    name: string
    description?: string
    color?: string
    status?: PursuitStatus
    core_question?: string
    pursuit_mode?: string
  }
): Promise<Pursuit> {
  const { data: pursuit, error } = await client
    .from('pursuits')
    .insert({
      user_id: userId,
      name: data.name.trim(),
      description: data.description ?? null,
      color: data.color ?? null,
      status: data.status ?? 'curiosity',
      core_question: data.core_question ?? null,
      pursuit_mode: data.pursuit_mode ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return pursuit as Pursuit
}

export async function updatePursuit(
  client: SupabaseClient,
  pursuitId: string,
  data: Partial<{
    name: string
    description: string | null
    color: string | null
    pursuit_mode: string | null
    core_question: string | null
  }>
) {
  return client
    .from('pursuits')
    .update(data)
    .eq('id', pursuitId)
    .select()
    .single()
}

// Promote a curiosity to an active pursuit.
// Validates: slot available (< 3 active), core_question provided.
// Note: embedding generation for core_question_embedding is handled by the
// match-corpus-to-pursuit Edge Function, triggered after this call.
export async function promotePursuit(
  client: SupabaseClient,
  userId: string,
  pursuitId: string,
  coreQuestion: string
): Promise<Pursuit> {
  const { data: active, error: countError } = await client
    .from('pursuits')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
  if (countError) throw countError
  if ((active ?? []).length >= 3) {
    throw new Error('Maximum of 3 active pursuits reached. Archive one before promoting.')
  }
  const { data: pursuit, error } = await client
    .from('pursuits')
    .update({ status: 'active', core_question: coreQuestion.trim() })
    .eq('id', pursuitId)
    .select()
    .single()
  if (error) throw error
  return pursuit as Pursuit
}

export async function archivePursuit(client: SupabaseClient, pursuitId: string) {
  return client
    .from('pursuits')
    .update({ status: 'archived' })
    .eq('id', pursuitId)
}

export async function deletePursuit(client: SupabaseClient, pursuitId: string) {
  return client
    .from('pursuits')
    .delete()
    .eq('id', pursuitId)
}

export async function addCaptureToPursuit(
  client: SupabaseClient,
  captureId: string,
  pursuitId: string,
  userId: string
) {
  return client
    .from('capture_pursuits')
    .upsert(
      { capture_id: captureId, pursuit_id: pursuitId, user_id: userId },
      { onConflict: 'capture_id,pursuit_id' }
    )
}

export async function removeCaptureFromPursuit(
  client: SupabaseClient,
  captureId: string,
  pursuitId: string
) {
  return client
    .from('capture_pursuits')
    .delete()
    .eq('capture_id', captureId)
    .eq('pursuit_id', pursuitId)
}

export async function getPursuitCaptures(client: SupabaseClient, pursuitId: string) {
  return client
    .from('capture_pursuits')
    .select(`
      capture_id,
      captures (
        *,
        enrichments (*),
        capture_tags ( tag_id, tags (id, name) )
      )
    `)
    .eq('pursuit_id', pursuitId)
    .order('created_at', { ascending: false })
}
