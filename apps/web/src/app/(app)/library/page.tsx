import { createClient } from '@/lib/supabase/server'

export default async function LibraryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="font-serif text-3xl font-bold text-charcoal dark:text-cream">Library</h1>
      <p className="font-sans text-sm text-charcoal/50 dark:text-cream/50 mt-2">
        Signed in as {user?.email}. Captures coming in Checkpoint B.
      </p>
    </main>
  )
}
