'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { FaRegCompass } from 'react-icons/fa'
import { LuLibrary } from 'react-icons/lu'
import { createClient } from '@/lib/supabase/client'

interface SidebarProps {
  userEmail: string | null
}

function LibraryIcon({ className }: { className?: string }) {
  return <LuLibrary className={className} />
}

function ProjectsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  )
}

function ExploreIcon({ className }: { className?: string }) {
  return <FaRegCompass className={className} />
}

const navItems = [
  { href: '/library', label: 'Library', Icon: LibraryIcon },
  { href: '/projects', label: 'Projects', Icon: ProjectsIcon },
  { href: '/explore', label: 'Explore', Icon: ExploreIcon },
]

export function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/sign-in')
    router.refresh()
  }

  return (
    <aside className="w-[220px] h-screen flex flex-col shrink-0 border-r border-charcoal/10 dark:border-cream/10 bg-cream dark:bg-charcoal">
      {/* Wordmark */}
      <div className="px-6 pt-7 pb-6">
        <span className="font-serif text-2xl font-bold text-charcoal dark:text-cream tracking-tight">
          Ki
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center gap-3 px-3 py-2.5 rounded-lg font-sans text-sm font-medium transition-colors',
                active
                  ? 'bg-terra/10 text-terra'
                  : 'text-charcoal/55 dark:text-cream/55 hover:text-charcoal dark:hover:text-cream hover:bg-charcoal/5 dark:hover:bg-cream/5',
              ].join(' ')}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User / sign out */}
      <div className="px-6 py-5 border-t border-charcoal/10 dark:border-cream/10">
        <p className="font-sans text-xs text-charcoal/45 dark:text-cream/45 truncate mb-2.5">
          {userEmail}
        </p>
        <button
          onClick={handleSignOut}
          className="font-sans text-xs text-charcoal/40 dark:text-cream/40 hover:text-terra dark:hover:text-terra transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
