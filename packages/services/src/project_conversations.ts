// Ki — project_conversations service
//
// Persistent chat history between user and Ki for a given project.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProjectConversation, ProjectConversationRole } from '@ki/types'

export async function getProjectConversation(
  client: SupabaseClient,
  projectId: string
): Promise<ProjectConversation[]> {
  const { data, error } = await client
    .from('project_conversations')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as ProjectConversation[]
}

export async function addProjectMessage(
  client: SupabaseClient,
  projectId: string,
  userId: string,
  role: ProjectConversationRole,
  content: string
): Promise<ProjectConversation> {
  const { data, error } = await client
    .from('project_conversations')
    .insert({ project_id: projectId, user_id: userId, role, content })
    .select()
    .single()
  if (error) throw error
  return data as ProjectConversation
}
