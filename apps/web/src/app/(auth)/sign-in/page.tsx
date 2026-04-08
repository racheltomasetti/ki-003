'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
      {/* Wordmark */}
      <div className="mb-12">
        <h1 className="font-serif text-5xl text-charcoal dark:text-cream font-bold">Ki</h1>
        <p className="font-sans text-sm text-charcoal/50 dark:text-cream/50 mt-1">
          A living extension of your mind.
        </p>
      </div>

      <form onSubmit={handleSignIn} className="flex flex-col gap-3">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-xl border border-charcoal/15 dark:border-cream/15 bg-black/[0.03] dark:bg-white/[0.06] text-charcoal dark:text-cream placeholder-charcoal/35 dark:placeholder-cream/35 font-sans text-sm outline-none focus:border-pacific dark:focus:border-pacific transition-colors"
        />

        <input
          type="password"
          placeholder="Password"
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
          className="w-full bg-terra text-cream font-sans font-semibold text-sm py-3 rounded-xl mt-1 hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="font-sans text-sm text-charcoal/50 dark:text-cream/50 text-center mt-8">
        No account?{' '}
        <Link href="/sign-up" className="text-pacific hover:opacity-80 transition-opacity">
          Sign up
        </Link>
      </p>
    </div>
  )
}
