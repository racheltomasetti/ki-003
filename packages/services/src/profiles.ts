// Ki — profiles service
//
// Profile reads and writes. Memory document lives here.
// All functions accept a Supabase client — mobile passes its own, web passes its own.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProfileUpdate } from '@ki/types'

export async function getProfile(client: SupabaseClient, userId: string) {
  return client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
}

export async function updateProfile(client: SupabaseClient, userId: string, update: ProfileUpdate) {
  return client
    .from('profiles')
    .update(update)
    .eq('id', userId)
    .select()
    .single()
}

export async function updateMemoryDocument(
  client: SupabaseClient,
  userId: string,
  memoryDocument: string
) {
  return client
    .from('profiles')
    .update({
      memory_document: memoryDocument,
      memory_updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single()
}
