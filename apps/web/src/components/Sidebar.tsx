'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { Project, Profile } from '@ki/types'

interface SidebarProps {
  projects: Project[]
  profile: Profile | null
  userEmail: string | null
}

const NAV: { href: string; label: string; icon: string }[] = [
  { href: '/home', label: 'Home', icon: '⌂' },
  { href: '/library', label: 'Library', icon: '▤' },
  { href: '/explore', label: 'Explore', icon: '◎' },
]

export function Sidebar({ projects, profile, userEmail }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const displayName = profile?.display_name ?? userEmail?.split('@')[0] ?? 'You'
  const avatarLetter = displayName.charAt(0).toUpperCase()

  return (
    <aside className="w-[220px] h-screen flex flex-col shrink-0 bg-cream dark:bg-[#161514] border-r border-charcoal/10 dark:border-white/[0.07]">

      {/* Logo */}
      <div className="px-5 pt-5 pb-4 border-b border-charcoal/10 dark:border-white/[0.07]">
        <div className="font-serif text-[26px] font-light tracking-[-1px] leading-none text-charcoal dark:text-[#f0ede8]">Ki</div>
        <div className="font-serif text-[10px] text-charcoal/30 dark:text-[#5c5a57] italic mt-[3px]">in the pursuit of self</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-[10px]">

        {NAV.map(({ href, label, icon }) => {
          const active = href === '/home'
            ? pathname === '/home' || pathname === '/'
            : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center gap-[9px] px-5 py-[7px] text-[12.5px] border-l-2 transition-all duration-150',
                active
                  ? 'text-charcoal dark:text-[#f0ede8] bg-terra/10 border-terra font-medium'
                  : 'text-charcoal/50 dark:text-[#9e9b96] border-transparent hover:text-charcoal dark:hover:text-[#f0ede8] hover:bg-charcoal/[0.03] dark:hover:bg-white/[0.03]',
              ].join(' ')}
            >
              <span className={['w-[14px] text-center text-[13px]', active ? '' : 'opacity-70'].join(' ')}>
                {icon}
              </span>
              {label}
            </Link>
          )
        })}

        {/* Projects section */}
        <div className="px-5 mt-3 mb-[3px] text-[9px] font-semibold text-charcoal/30 dark:text-[#5c5a57] uppercase tracking-[0.1em]">
          Projects
        </div>

        {projects.map((project) => {
          const active = pathname.startsWith(`/projects/${project.id}`)
          const color = project.color ?? '#9e9b96'
          return (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className={[
                'flex items-center gap-[9px] px-5 py-[5px] text-[12px] border-l-2 transition-all duration-150',
                active
                  ? 'text-charcoal dark:text-[#f0ede8] border-l-2'
                  : 'text-charcoal/30 dark:text-[#5c5a57] border-transparent hover:text-charcoal/60 dark:hover:text-[#9e9b96]',
              ].join(' ')}
              style={active ? { borderLeftColor: color } : {}}
            >
              <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="truncate">{project.name}</span>
            </Link>
          )
        })}

        <Link
          href="/projects/new"
          className="flex items-center gap-2 px-5 py-[5px] text-[11px] text-charcoal/30 dark:text-[#5c5a57] mt-[2px] hover:text-terra dark:hover:text-terra transition-colors"
        >
          <span className="text-[14px]">+</span>
          new project
        </Link>

      </nav>

      {/* Footer — user card */}
      <div className="px-[14px] py-3 border-t border-charcoal/8 dark:border-white/[0.07]">
        <button
          onClick={() => router.push('/profile')}
          className="flex items-center gap-[10px] w-full px-2 py-[6px] rounded-[10px] hover:bg-charcoal/5 dark:hover:bg-[#1d1b1a] transition-colors cursor-pointer text-left"
        >
          <div className="w-7 h-7 rounded-full bg-terra/10 border border-terra flex items-center justify-center text-[11px] font-semibold text-terra shrink-0">
            {avatarLetter}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium text-charcoal dark:text-[#f0ede8] truncate">{displayName}</div>
            <div className="text-[10px] text-charcoal/35 dark:text-[#5c5a57] truncate">{userEmail ?? ''}</div>
          </div>
        </button>
      </div>

    </aside>
  )
}
