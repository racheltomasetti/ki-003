import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/library')

  return <div className="min-h-screen bg-cream dark:bg-[#0f0e0e]" />
}
