// Ki — storage service
//
// Handles media uploads and signed URL generation.
// Audio is NOT stored — transcription only. See CLAUDE.md.

import type { SupabaseClient } from '@supabase/supabase-js'

const MEDIA_BUCKET = 'media'

export async function uploadMedia(
  client: SupabaseClient,
  userId: string,
  file: File | Blob,
  contentType: string
): Promise<{ path: string } | null> {
  const ext = contentType.split('/')[1] ?? 'bin'
  const path = `${userId}/${Date.now()}.${ext}`

  const { error } = await client.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { contentType, upsert: false })

  if (error) return null
  return { path }
}

export async function getSignedUrl(
  client: SupabaseClient,
  path: string,
  expiresIn = 3600
): Promise<string | null> {
  const { data, error } = await client.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(path, expiresIn)

  if (error || !data) return null
  return data.signedUrl
}

export async function deleteMedia(client: SupabaseClient, path: string) {
  return client.storage.from(MEDIA_BUCKET).remove([path])
}

export async function uploadAvatar(
  client: SupabaseClient,
  userId: string,
  file: File | Blob,
  contentType: string
): Promise<{ path: string } | null> {
  const ext = contentType.split('/')[1] ?? 'jpg'
  const path = `avatars/${userId}.${ext}`

  const { error } = await client.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { contentType, upsert: true })

  if (error) return null
  return { path }
}
