import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/Sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="flex h-screen overflow-hidden bg-cream dark:bg-charcoal">
      <Sidebar userEmail={user?.email ?? null} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
