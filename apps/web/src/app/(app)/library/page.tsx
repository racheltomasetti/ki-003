import { createClient } from '@/lib/supabase/server'
import { getActivePursuits, getTags } from '@ki/services'
import { LibraryClient } from '@/components/LibraryClient'
import type { Pursuit, Tag } from '@ki/types'

export default async function LibraryPage({
  searchParams,
}: {
  searchParams?: { captureId?: string | string[] }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: pursuits }, { data: tags }] = await Promise.all([
    getActivePursuits(supabase, user.id),
    getTags(supabase, user.id),
  ])

  return (
    <LibraryClient
      userId={user.id}
      pursuits={(pursuits ?? []) as Pursuit[]}
      initialTags={(tags ?? []) as Tag[]}
      initialSelectedId={
        typeof searchParams?.captureId === 'string'
          ? searchParams.captureId
          : null
      }
    />
  )
}
