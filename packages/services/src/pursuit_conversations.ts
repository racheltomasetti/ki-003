// Ki — pursuit_conversations service
//
// Persistent chat history between the hero and Ki for a given pursuit.
// Roles: 'hero' (the user) | 'ki' (the AI thinking partner).
// Edge functions map hero→user and ki→assistant before calling Anthropic API.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PursuitConversation, PursuitConversationRole } from '@ki/types'

export async function getPursuitConversation(
  client: SupabaseClient,
  pursuitId: string
): Promise<PursuitConversation[]> {
  const { data, error } = await client
    .from('pursuit_conversations')
    .select('*')
    .eq('pursuit_id', pursuitId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as PursuitConversation[]
}

export async function addPursuitMessage(
  client: SupabaseClient,
  pursuitId: string,
  userId: string,
  role: PursuitConversationRole,
  content: string
): Promise<PursuitConversation> {
  const { data, error } = await client
    .from('pursuit_conversations')
    .insert({ pursuit_id: pursuitId, user_id: userId, role, content })
    .select()
    .single()
  if (error) throw error
  return data as PursuitConversation
}
