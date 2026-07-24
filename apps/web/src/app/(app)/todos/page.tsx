import { TodosClient } from '@/components/TodosClient'
import { createClient } from '@/lib/supabase/server'
import { getActivePursuits, getTodos } from '@ki/services'
import type { Pursuit } from '@ki/types'

export default async function TodosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [todos, { data: pursuits }] = await Promise.all([
    getTodos(supabase, user.id, { includeArchived: true }),
    getActivePursuits(supabase, user.id),
  ])

  return (
    <TodosClient
      userId={user.id}
      initialTodos={todos}
      pursuits={(pursuits ?? []) as Pursuit[]}
    />
  )
}
