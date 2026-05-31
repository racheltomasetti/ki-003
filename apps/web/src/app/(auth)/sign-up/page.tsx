'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({ email: email.trim(), password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="w-full max-w-sm">
        <h1 className="font-serif text-3xl text-charcoal dark:text-cream font-bold mb-4">
          Check your email.
        </h1>
        <p className="font-sans text-sm text-charcoal/60 dark:text-cream/60 leading-relaxed">
          We sent a confirmation link to{' '}
          <span className="text-charcoal dark:text-cream">{email}</span>.
          <br /><br />
          Open it and you're in.
        </p>
        <Link
          href="/sign-in"
          className="inline-block font-sans text-sm text-pacific hover:opacity-80 transition-opacity mt-10"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      <p className="text-center text-xl text-charcoal/50 dark:text-cream/50 font-serif mb-6">welcome to ki</p>

      <form onSubmit={handleSignUp} className="flex flex-col gap-3">
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

        <input
          type="password"
          placeholder="confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
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
