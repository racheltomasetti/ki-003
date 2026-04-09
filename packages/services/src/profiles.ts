// Ki — profiles service
//
// Profile reads and writes. Memory document lives here.
// All functions accept a Supabase client — mobile passes its own, web passes its own.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile, ProfileUpdate } from '@ki/types'

export async function getProfile(client: SupabaseClient, userId: string): Promise<Profile | null> {
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) return null
  return data as Profile
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
