'use client'

import { useEffect, useState, type ComponentType } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { LuLibrary } from 'react-icons/lu'
import { HiMiniHome } from 'react-icons/hi2'
import { IoCompassOutline } from 'react-icons/io5'
import { MdChecklist, MdLightMode } from 'react-icons/md'
import { IoMoon } from "react-icons/io5";
import type { Pursuit, PursuitMode, Profile } from '@ki/types'

interface SidebarProps {
  pursuits: Pursuit[]
  pursuitCaptureCounts?: Record<string, number>
  profile: Profile | null
  userEmail: string | null
}

const NAV: { href: string; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { href: '/home', label: 'Home', Icon: HiMiniHome },
  { href: '/library', label: 'Corpus', Icon: LuLibrary },
  { href: '/explore', label: 'Explore', Icon: IoCompassOutline },
  { href: '/todos', label: 'Todos', Icon: MdChecklist },
]

const MODE_COLORS: Record<PursuitMode, string> = {
  building: '#9e2a2b',
  exploring: '#58a4b0',
  becoming: '#efcb68',
  figuring_out: '#67934d',
}

const MODE_LABELS: Record<PursuitMode, string> = {
  building: 'BUILDING',
  exploring: 'EXPLORING',
  becoming: 'BECOMING',
  figuring_out: 'FIGURING OUT',
}

export function Sidebar({
  pursuits,
  pursuitCaptureCounts = {},
  profile,
  userEmail,
}: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const displayName = profile?.display_name ?? userEmail?.split('@')[0] ?? 'You'
  const avatarLetter = displayName.charAt(0).toUpperCase()
  const isDark = mounted && resolvedTheme === 'dark'

  return (
    <aside
      className={[
        'h-screen flex flex-col shrink-0 overflow-hidden',
        'bg-cream dark:bg-[#161514] border-r border-charcoal/10 dark:border-white/[0.07]',
        'transition-[width] duration-200 ease-in-out',
        collapsed ? 'w-[60px]' : 'w-[220px]',
      ].join(' ')}
    >

      {/* Logo — acts as collapse/expand toggle */}
      <div
        className={[
          'pt-5 pb-4 border-b border-charcoal/10 dark:border-white/[0.07] shrink-0',
          collapsed ? 'flex justify-center px-2' : 'flex justify-start px-5',
        ].join(' ')}
      >
        <button
          onClick={() => setCollapsed(v => !v)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="relative h-8 w-[30px] shrink-0 opacity-80 hover:opacity-100 transition-opacity"
        >
          <Image
            src="/logo-light.png"
            alt="Ki"
            width={320}
            height={96}
            priority
            className="dark:hidden block h-full w-full object-contain"
          />
          <Image
            src="/logo-dark.png"
            alt="Ki"
            width={320}
            height={96}
            priority
            className="hidden dark:block h-full w-full object-contain"
          />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-[10px]">

        <div className={collapsed ? 'flex flex-col items-center gap-0.5 px-2' : 'mx-3.5 flex flex-col gap-0.5'}>
          {NAV.map(({ href, label, Icon }) => {
            const active = href === '/home'
              ? pathname === '/home' || pathname === '/'
              : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={[
                  'rounded-[10px] transition-all duration-150',
                  collapsed
                    ? 'flex items-center justify-center w-9 h-9'
                    : 'flex items-center h-9 px-2.5 text-[13.5px] text-left border-l-2',
                  active
                    ? collapsed
                      ? 'bg-charcoal/[0.06] dark:bg-white/[0.06]'
                      : 'text-charcoal dark:text-[#f0ede8] bg-charcoal/[0.06] dark:bg-white/[0.06] border-terra font-medium'
                    : collapsed
                      ? 'text-charcoal/50 dark:text-[#9e9b96] hover:text-charcoal dark:hover:text-[#f0ede8] hover:bg-charcoal/[0.03] dark:hover:bg-white/[0.03]'
                      : 'text-charcoal/50 dark:text-[#9e9b96] border-transparent hover:text-charcoal dark:hover:text-[#f0ede8] hover:bg-charcoal/[0.03] dark:hover:bg-white/[0.03]',
                ].join(' ')}
              >
                {collapsed
                  ? (
                    <span className={active ? 'text-terra' : 'opacity-70'}>
                      <Icon className="text-[18px]" />
                    </span>
                  )
                  : label
                }
              </Link>
            )
          })}
        </div>

        {/* Pursuits section */}
        <div className={['mt-4', !collapsed ? 'mx-3.5 pt-1' : 'flex justify-center mb-[11px]'].join(' ')}>
          {!collapsed
            ? <span className="block text-[9px] font-semibold text-charcoal/30 dark:text-[#5c5a57] uppercase tracking-[0.1em] mb-2">Pursuits</span>
            : <span className="block w-4 border-t border-charcoal/15 dark:border-white/[0.08]" />
          }
        </div>

        <div className={collapsed ? '' : 'mx-3.5 flex flex-col gap-2'}>
          {pursuits.map((pursuit) => {
            const active = pathname.startsWith(`/pursuits/${pursuit.id}`)
            const color = pursuit.color ?? '#9e2a2b'
            const mode = pursuit.pursuit_mode
            const modeColor = mode ? MODE_COLORS[mode] : null
            const modeLabel = mode ? MODE_LABELS[mode] : null
            const captureCount = pursuitCaptureCounts[pursuit.id] ?? 0

            if (collapsed) {
              return (
                <Link
                  key={pursuit.id}
                  href={`/pursuits/${pursuit.id}`}
                  title={pursuit.name}
                  className="flex items-center justify-center py-[5px]"
                >
                  <span
                    className={[
                      'w-[6px] h-[6px] rounded-full shrink-0 ring-offset-1 dark:ring-offset-[#161514]',
                      active ? 'ring-1 ring-terra/60' : '',
                    ].join(' ')}
                    style={{ backgroundColor: color }}
                  />
                </Link>
              )
            }

            return (
              <Link
                key={pursuit.id}
                href={`/pursuits/${pursuit.id}`}
                className={[
                  'block rounded-[10px] px-2.5 py-2 transition-all duration-150',
                  'border',
                  active
                    ? 'bg-terra/[0.07] dark:bg-terra/10 border-terra/45 dark:border-terra/50'
                    : 'bg-transparent border-charcoal/10 dark:border-white/[0.08] hover:border-charcoal/18 dark:hover:border-white/[0.14] hover:bg-charcoal/[0.03] dark:hover:bg-white/[0.03]',
                ].join(' ')}
              >
                <div className="flex items-start gap-1.5 min-w-0">
                  <span
                    className="w-[6px] h-[6px] rounded-full shrink-0 mt-[5px]"
                    style={{ backgroundColor: color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-serif text-[13px] font-light text-charcoal dark:text-[#f0ede8] truncate leading-tight min-w-0 flex-1 text-left">
                        {pursuit.name}
                      </span>
                      {modeLabel && modeColor && (
                        <span
                          className="shrink-0 ml-auto text-[8px] font-semibold px-1.5 py-[2px] rounded-full uppercase tracking-[0.06em] border leading-none"
                          style={{ borderColor: `${modeColor}66`, color: modeColor }}
                        >
                          {modeLabel}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-sans text-[10px] text-charcoal/35 dark:text-[#5c5a57] leading-none text-left">
                      {captureCount} capture{captureCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </Link>
            )
          })}

          {!collapsed && pursuits.length < 3 && (
            <Link
              href="/pursuits/new"
              className={[
                'flex items-center justify-center rounded-[10px] px-2.5 py-2.5',
                'border border-dashed border-charcoal/15 dark:border-white/[0.1]',
                'font-sans text-[11px] text-charcoal/35 dark:text-[#5c5a57]',
                'hover:border-terra/40 hover:text-terra transition-colors',
              ].join(' ')}
            >
              + new pursuit
            </Link>
          )}
        </div>

      </nav>

      {/* Footer — profile + theme */}
      <div className="px-[14px] py-3 border-t border-charcoal/8 dark:border-white/[0.07] shrink-0">
        {collapsed ? (
          <button
            onClick={() => router.push('/profile')}
            title={displayName}
            className="w-full flex items-center justify-center py-[6px] rounded-[10px] hover:bg-charcoal/5 dark:hover:bg-[#1d1b1a] transition-colors cursor-pointer"
          >
            <div className="w-7 h-7 rounded-full bg-terra/10 border border-terra flex items-center justify-center text-[11px] font-semibold text-terra shrink-0">
              {avatarLetter}
            </div>
          </button>
        ) : (
          <div className="flex items-center gap-2 px-1.5 py-[6px] rounded-[10px] hover:bg-charcoal/5 dark:hover:bg-[#1d1b1a] transition-colors">
            <button
              onClick={() => router.push('/profile')}
              className="min-w-0 flex-1 flex items-center gap-[10px] text-left cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full bg-terra/10 border border-terra flex items-center justify-center text-[11px] font-semibold text-terra shrink-0">
                {avatarLetter}
              </div>
              <span className="text-[12px] font-medium text-charcoal dark:text-[#f0ede8] truncate">
                {displayName}
              </span>
            </button>

            <button
              type="button"
              role="switch"
              aria-checked={isDark}
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className={[
                'relative shrink-0 w-[46px] h-[24px] rounded-full cursor-pointer transition-colors',
                'border border-charcoal/10 dark:border-white/[0.1]',
                'bg-charcoal/[0.06] dark:bg-white/[0.08]',
              ].join(' ')}
            >
              <span className="absolute inset-0 flex items-center justify-between px-[5px] pointer-events-none">
                <MdLightMode
                  className={[
                    'text-[11px] transition-colors',
                    mounted && !isDark ? 'text-terra' : 'text-charcoal/30 dark:text-[#5c5a57]',
                  ].join(' ')}
                />
                <IoMoon
                  className={[
                    'text-[11px] transition-colors',
                    mounted && isDark ? 'text-terra' : 'text-charcoal/30 dark:text-[#5c5a57]',
                  ].join(' ')}
                />
              </span>
              <span
                className={[
                  'absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-cream dark:bg-[#2a2826]',
                  'border border-charcoal/10 dark:border-white/[0.12] shadow-sm',
                  'transition-transform duration-200 ease-out',
                  mounted && isDark ? 'translate-x-[22px]' : 'translate-x-0',
                ].join(' ')}
              />
            </button>
          </div>
        )}
      </div>

    </aside>
  )
}
