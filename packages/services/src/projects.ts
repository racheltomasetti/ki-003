// Ki — projects service
//
// Projects are named collections that captures belong to.
// A capture can live in multiple projects.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Project } from '@ki/types'

export async function updateProject(
  client: SupabaseClient,
  projectId: string,
  data: Partial<{ name: string; description: string | null; brief: string | null }>
) {
  return client
    .from('projects')
    .update(data)
    .eq('id', projectId)
    .select()
    .single()
}

export async function getProject(client: SupabaseClient, projectId: string) {
  return client
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()
}

export async function getProjects(client: SupabaseClient, userId: string) {
  return client
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
}

export async function createProject(
  client: SupabaseClient,
  userId: string,
  data: { name: string; description?: string; color?: string }
): Promise<Project> {
  const { data: project, error } = await client
    .from('projects')
    .insert({ user_id: userId, name: data.name.trim(), description: data.description ?? null, color: data.color ?? null })
    .select()
    .single()
  if (error) throw error
  return project as Project
}

export async function addCaptureToProject(
  client: SupabaseClient,
  captureId: string,
  projectId: string,
  userId: string
) {
  return client
    .from('capture_projects')
    .upsert({ capture_id: captureId, project_id: projectId, user_id: userId }, { onConflict: 'capture_id,project_id' })
}

export async function removeCaptureFromProject(
  client: SupabaseClient,
  captureId: string,
  projectId: string
) {
  return client
    .from('capture_projects')
    .delete()
    .eq('capture_id', captureId)
    .eq('project_id', projectId)
}

export async function getProjectCaptures(client: SupabaseClient, projectId: string) {
  return client
    .from('capture_projects')
    .select(`
      capture_id,
      captures (
        *,
        enrichments (*),
        capture_tags ( tag_id, tags (id, name) )
      )
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
}
