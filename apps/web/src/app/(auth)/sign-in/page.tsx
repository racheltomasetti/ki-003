'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/library')
    router.refresh()
  }

  return (
    <div className="w-full max-w-sm">
      <p className="text-center text-xl font-serif text-charcoal/50 dark:text-cream/50 mb-6">welcome back</p>

      <form onSubmit={handleSignIn} className="flex flex-col gap-3">
        <input
          type="email"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-xl border border-charcoal/15 dark:border-cream/15 bg-black/[0.03] dark:bg-white/[0.06] text-charcoal dark:text-cream placeholder-charcoal/35 dark:placeholder-cream/35 font-sans text-sm outline-none focus:border-pacific dark:focus:border-pacific transition-colors"
        />

        <input
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-xl border border-charcoal/15 dark:border-cream/15 bg-black/[0.03] dark:bg-white/[0.06] text-charcoal dark:text-cream placeholder-charcoal/35 dark:placeholder-cream/35 font-sans text-sm outline-none focus:border-pacific dark:focus:border-pacific transition-colors"
        />

        {error && (
          <p className="text-terra text-sm font-sans">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center py-3 mt-1 hover:opacity-60 active:opacity-40 transition-opacity disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
        >
          <div className="relative h-12 w-[45px]">
            <Image src="/logo-light.png" alt="Ki" width={320} height={96} priority className="dark:hidden block h-full w-full object-contain" />
            <Image src="/logo-dark.png" alt="Ki" width={320} height={96} priority className="hidden dark:block h-full w-full object-contain" />
          </div>
        </button>
      </form>
    </div>
  )
}
