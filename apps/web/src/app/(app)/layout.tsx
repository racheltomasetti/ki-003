import { createClient } from '@/lib/supabase/server'
import { getActivePursuits, getProfile } from '@ki/services'
import { Sidebar } from '@/components/Sidebar'
import type { Pursuit, Profile } from '@ki/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: pursuits }, profile] = await Promise.all([
    user ? getActivePursuits(supabase, user.id) : Promise.resolve({ data: [] }),
    user ? getProfile(supabase, user.id) : Promise.resolve(null),
  ])

  const pursuitList = (pursuits ?? []) as Pursuit[]
  const pursuitCaptureCounts: Record<string, number> = {}

  if (user && pursuitList.length > 0) {
    const { data: links } = await supabase
      .from('capture_pursuits')
      .select('pursuit_id')
      .in('pursuit_id', pursuitList.map(p => p.id))

    for (const row of links ?? []) {
      const id = row.pursuit_id as string
      pursuitCaptureCounts[id] = (pursuitCaptureCounts[id] ?? 0) + 1
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-cream dark:bg-[#0f0e0e]">
      <Sidebar
        pursuits={pursuitList}
        pursuitCaptureCounts={pursuitCaptureCounts}
        profile={profile as Profile | null}
        userEmail={user?.email ?? null}
      />
      <main className="flex-1 overflow-hidden bg-cream dark:bg-[#0f0e0e] flex flex-col">
        {children}
      </main>
    </div>
  )
}
