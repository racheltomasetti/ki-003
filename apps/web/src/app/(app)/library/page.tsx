import { createClient } from '@/lib/supabase/server'
import { getProjects, getTags } from '@ki/services'
import { LibraryClient } from '@/components/LibraryClient'
import type { Project, Tag } from '@ki/types'

export default async function LibraryPage({
  searchParams,
}: {
  searchParams?: { captureId?: string | string[] }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: projects }, { data: tags }] = await Promise.all([
    getProjects(supabase, user.id),
    getTags(supabase, user.id),
  ])

  return (
    <LibraryClient
      userId={user.id}
      projects={(projects ?? []) as Project[]}
      initialTags={(tags ?? []) as Tag[]}
      initialSelectedId={
        typeof searchParams?.captureId === 'string'
          ? searchParams.captureId
          : null
      }
    />
  )
}
