import { createClient } from '@/lib/supabase/server'
import { getActivePursuits, getTags } from '@ki/services'
import { LibraryClient } from '@/components/LibraryClient'
import type { Pursuit, Tag } from '@ki/types'

export default async function LibraryPage({
  searchParams,
}: {
  searchParams?: Promise<{ captureId?: string | string[] }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: pursuits }, { data: tags }, resolvedParams] = await Promise.all([
    getActivePursuits(supabase, user.id),
    getTags(supabase, user.id),
    searchParams ?? Promise.resolve({} as { captureId?: string | string[] }),
  ])

  return (
    <LibraryClient
      userId={user.id}
      pursuits={(pursuits ?? []) as Pursuit[]}
      initialTags={(tags ?? []) as Tag[]}
      initialSelectedId={
        typeof resolvedParams.captureId === 'string'
          ? resolvedParams.captureId
          : null
      }
    />
  )
}
