import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/library')

  return (
    <div className="min-h-screen bg-cream dark:bg-[#0f0e0e] flex items-center justify-center">
      <Link
        href="/sign-in"
        aria-label="Sign in to Ki"
        className="relative h-14 w-[52px] opacity-90 hover:opacity-100 transition-opacity"
      >
        <Image
          src="/logo-light.png"
          alt="Ki"
          width={320}
          height={96}
          priority
          className="block dark:hidden h-full w-full object-contain"
        />
        <Image
          src="/logo-dark.png"
          alt="Ki"
          width={320}
          height={96}
          priority
          className="hidden dark:block h-full w-full object-contain"
        />
      </Link>
    </div>
  )
}
