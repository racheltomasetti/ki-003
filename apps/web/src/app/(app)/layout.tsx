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

  return (
    <div className="flex h-screen overflow-hidden bg-cream dark:bg-[#0f0e0e]">
      <Sidebar
        pursuits={(pursuits ?? []) as Pursuit[]}
        profile={profile as Profile | null}
        userEmail={user?.email ?? null}
      />
      <main className="flex-1 overflow-hidden bg-cream dark:bg-[#0f0e0e] flex flex-col">
        {children}
      </main>
    </div>
  )
}
