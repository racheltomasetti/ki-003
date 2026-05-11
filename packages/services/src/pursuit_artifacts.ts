// Ki — pursuit_artifacts service
//
// Typed artifacts (prose, outline, mermaid, and future kinds) saved from
// the thought distiller in a pursuit workspace. See .claude/ARTIFACTS_BUILD_PLAN.md.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PursuitArtifact } from '@ki/types'

export async function getPursuitArtifacts(
  client: SupabaseClient,
  pursuitId: string
): Promise<PursuitArtifact[]> {
  const { data, error } = await client
    .from('pursuit_artifacts')
    .select('*')
    .eq('pursuit_id', pursuitId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as PursuitArtifact[]
}

export async function getPursuitArtifact(
  client: SupabaseClient,
  artifactId: string
): Promise<PursuitArtifact> {
  const { data, error } = await client
    .from('pursuit_artifacts')
    .select('*')
    .eq('id', artifactId)
    .single()
  if (error) throw error
  return data as PursuitArtifact
}

export async function createPursuitArtifact(
  client: SupabaseClient,
  params: {
    pursuit_id: string
    user_id: string
    type: string
    title: string
    content: string
    data?: Record<string, unknown>
  }
): Promise<PursuitArtifact> {
  const { data, error } = await client
    .from('pursuit_artifacts')
    .insert({
      pursuit_id: params.pursuit_id,
      user_id: params.user_id,
      type: params.type,
      title: params.title,
      content: params.content,
      data: params.data ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data as PursuitArtifact
}

export async function deletePursuitArtifact(
  client: SupabaseClient,
  artifactId: string
): Promise<void> {
  const { error } = await client
    .from('pursuit_artifacts')
    .delete()
    .eq('id', artifactId)
  if (error) throw error
}
