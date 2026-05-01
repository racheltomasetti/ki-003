// Ki — project_artifacts service
//
// Mermaid diagrams and other generated artifacts saved alongside the Ki document.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProjectArtifact } from '@ki/types'

export async function getProjectArtifacts(
  client: SupabaseClient,
  projectId: string
): Promise<ProjectArtifact[]> {
  const { data, error } = await client
    .from('project_artifacts')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as ProjectArtifact[]
}

export async function createProjectArtifact(
  client: SupabaseClient,
  projectId: string,
  userId: string,
  title: string,
  content: string,
  type = 'mermaid'
): Promise<ProjectArtifact> {
  const { data, error } = await client
    .from('project_artifacts')
    .insert({ project_id: projectId, user_id: userId, type, title, content })
    .select()
    .single()
  if (error) throw error
  return data as ProjectArtifact
}

export async function deleteProjectArtifact(
  client: SupabaseClient,
  artifactId: string
): Promise<void> {
  const { error } = await client
    .from('project_artifacts')
    .delete()
    .eq('id', artifactId)
  if (error) throw error
}
