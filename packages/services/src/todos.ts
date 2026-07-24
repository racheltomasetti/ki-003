// Ki — todos service
//
// Todos turn thinking into action. They may stand alone or connect to one of
// the user's active pursuits. Agent-created todos use this same service after
// the user confirms them.

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Todo,
  TodoInsert,
  TodoPriority,
  TodoStatus,
  TodoUpdate,
} from '@ki/types'

export interface GetTodosOptions {
  status?: TodoStatus | TodoStatus[]
  priority?: TodoPriority
  pursuitId?: string | null
  includeArchived?: boolean
}

async function validateActivePursuit(
  client: SupabaseClient,
  userId: string,
  pursuitId: string
): Promise<void> {
  const { data, error } = await client
    .from('pursuits')
    .select('id')
    .eq('id', pursuitId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Todos can only be connected to an active pursuit.')
}

export async function getTodos(
  client: SupabaseClient,
  userId: string,
  options: GetTodosOptions = {}
): Promise<Todo[]> {
  let query = client
    .from('todos')
    .select('*')
    .eq('user_id', userId)

  if (!options.includeArchived && options.status !== 'archived') {
    query = query.neq('status', 'archived')
  }

  if (Array.isArray(options.status)) {
    query = query.in('status', options.status)
  } else if (options.status) {
    query = query.eq('status', options.status)
  }

  if (options.priority) {
    query = query.eq('priority', options.priority)
  }

  if (Object.prototype.hasOwnProperty.call(options, 'pursuitId')) {
    query = options.pursuitId === null
      ? query.is('pursuit_id', null)
      : query.eq('pursuit_id', options.pursuitId as string)
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error
  return data as Todo[]
}

export async function createTodo(
  client: SupabaseClient,
  userId: string,
  input: TodoInsert
): Promise<Todo> {
  const title = input.title.trim()
  if (!title) throw new Error('A todo needs a title.')

  if (input.pursuit_id) {
    await validateActivePursuit(client, userId, input.pursuit_id)
  }

  const { data, error } = await client
    .from('todos')
    .insert({
      user_id: userId,
      title,
      notes: input.notes?.trim() || null,
      status: input.status,
      priority: input.priority,
      due_date: input.due_date || null,
      pursuit_id: input.pursuit_id || null,
      source: input.source ?? 'manual',
    })
    .select()
    .single()

  if (error) throw error
  return data as Todo
}

export async function updateTodo(
  client: SupabaseClient,
  userId: string,
  todoId: string,
  input: TodoUpdate
): Promise<Todo> {
  if (input.title !== undefined && !input.title.trim()) {
    throw new Error('A todo needs a title.')
  }

  if (input.pursuit_id) {
    await validateActivePursuit(client, userId, input.pursuit_id)
  }

  const update: TodoUpdate = {
    ...input,
    ...(input.title !== undefined ? { title: input.title.trim() } : {}),
    ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
    ...(input.due_date !== undefined ? { due_date: input.due_date || null } : {}),
  }

  const { data, error } = await client
    .from('todos')
    .update(update)
    .eq('id', todoId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error
  return data as Todo
}
