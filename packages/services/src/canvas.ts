// Ki — canvas service
//
// All canvas data access lives here. No direct Supabase calls in canvas
// components — everything goes through these functions.
//
// Client injection pattern: pass the appropriate Supabase client (browser or
// server) as the first argument. Same functions work on web client components
// and in Edge Functions.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CanvasNode, CanvasEdge, CanvasConversation, CanvasNodeInsert, CanvasEdgeInsert } from '@ki/types'

// ─── Nodes ────────────────────────────────────────────────────────────────────

export async function getCanvasNodes(client: SupabaseClient, projectId: string) {
  return client
    .from('canvas_nodes')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
}

export async function upsertCanvasNode(client: SupabaseClient, node: CanvasNodeInsert) {
  return client
    .from('canvas_nodes')
    .upsert(node, { onConflict: 'project_id,node_id' })
    .select()
    .single()
}

export async function deleteCanvasNode(
  client: SupabaseClient,
  projectId: string,
  nodeId: string
) {
  // IMPORTANT: canvas_edges has no DB-level cascade on node deletion.
  // Always call deleteEdgesForNode() before or alongside this to avoid
  // orphaned edges that reference a node_id that no longer exists.
  return client
    .from('canvas_nodes')
    .delete()
    .eq('project_id', projectId)
    .eq('node_id', nodeId)
}

// Call this whenever a node is deleted — cleans up all edges that reference it.
// NOTE: RLS prevents cross-user access but does not prevent a user from
// connecting their own nodes across projects. Harmless data-wise, but worth
// validating at the application layer if strict project scoping matters later.
export async function deleteEdgesForNode(
  client: SupabaseClient,
  projectId: string,
  nodeId: string
) {
  return client
    .from('canvas_edges')
    .delete()
    .eq('project_id', projectId)
    .or(`source_id.eq.${nodeId},target_id.eq.${nodeId}`)
}

// ─── Edges ────────────────────────────────────────────────────────────────────

export async function getCanvasEdges(client: SupabaseClient, projectId: string) {
  return client
    .from('canvas_edges')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
}

export async function upsertCanvasEdge(client: SupabaseClient, edge: CanvasEdgeInsert) {
  return client
    .from('canvas_edges')
    .upsert(edge, { onConflict: 'project_id,edge_id' })
    .select()
    .single()
}

export async function deleteCanvasEdge(
  client: SupabaseClient,
  projectId: string,
  edgeId: string
) {
  return client
    .from('canvas_edges')
    .delete()
    .eq('project_id', projectId)
    .eq('edge_id', edgeId)
}

// ─── Phantom flow helpers ─────────────────────────────────────────────────────
//
// The agent proposes diagrams as 'pending' nodes/edges. The user accepts or
// rejects the proposal as a batch. Only one pending proposal exists at a time.

export async function acceptPendingNodes(client: SupabaseClient, projectId: string) {
  return client
    .from('canvas_nodes')
    .update({ status: 'accepted' })
    .eq('project_id', projectId)
    .eq('status', 'pending')
}

export async function acceptPendingEdges(client: SupabaseClient, projectId: string) {
  return client
    .from('canvas_edges')
    .update({ status: 'accepted' })
    .eq('project_id', projectId)
    .eq('status', 'pending')
}

export async function clearPendingNodes(client: SupabaseClient, projectId: string) {
  return client
    .from('canvas_nodes')
    .delete()
    .eq('project_id', projectId)
    .eq('status', 'pending')
}

export async function clearPendingEdges(client: SupabaseClient, projectId: string) {
  return client
    .from('canvas_edges')
    .delete()
    .eq('project_id', projectId)
    .eq('status', 'pending')
}

// ─── Conversations ────────────────────────────────────────────────────────────

export async function getCanvasConversations(client: SupabaseClient, projectId: string) {
  return client
    .from('canvas_conversations')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
}

export async function addCanvasMessage(
  client: SupabaseClient,
  projectId: string,
  userId: string,
  role: CanvasConversation['role'],
  content: string
) {
  return client
    .from('canvas_conversations')
    .insert({ project_id: projectId, user_id: userId, role, content })
    .select()
    .single()
}
