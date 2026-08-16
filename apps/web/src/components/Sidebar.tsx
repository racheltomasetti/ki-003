'use client'

import { useEffect, useState, type ComponentType } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useQuery } from '@tanstack/react-query'
import { LuLibrary } from 'react-icons/lu'
import { HiMiniHome } from 'react-icons/hi2'
import { IoCompassOutline } from 'react-icons/io5'
import { MdChecklist, MdLightMode, MdOutlineInsights, MdOutlineAutoAwesome } from 'react-icons/md'
import { IoMoon } from "react-icons/io5";
import { getCurrentCycleInfo } from '@ki/services'
import { createClient } from '@/lib/supabase/client'
import type { Pursuit, PursuitMode, Profile } from '@ki/types'

// ─── Cycle day badge ────────────────────────────────────────────────────────
// Footer only, next to the avatar — just "Day N", no phase. Nothing if not
// tracking, nothing if tracking but no period logged yet.

function CycleDayBadge({ profile }: { profile: Profile }) {
  const supabase = createClient()
  const { data } = useQuery({
    queryKey: ['cycle-info', profile.id],
    queryFn: () => getCurrentCycleInfo(supabase, profile.id),
    enabled: profile.cycle_type === 'menstrual',
    staleTime: 5 * 60_000,
  })

  if (!data?.cycleDay) return null

  return (
    <Link
      href="/profile"
      title={`Day ${data.cycleDay} of your cycle`}
      className="shrink-0 whitespace-nowrap inline-flex items-center justify-center h-[1.5rem] rounded-full border border-accent/25 bg-accent/10 px-2.5 font-sans text-[0.625rem] font-medium text-accent hover:bg-accent/15 transition-colors"
    >
      Day {data.cycleDay}
    </Link>
  )
}

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
  { href: '/create', label: 'Create', Icon: MdOutlineAutoAwesome },
  { href: '/patterns', label: 'Patterns', Icon: MdOutlineInsights },
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
        collapsed ? 'w-15' : 'w-[13.75rem]',
      ].join(' ')}
    >

      {/* Logo — acts as collapse/expand toggle */}
      <div
        className={[
          'h-[4.25rem] box-border border-b border-charcoal/10 dark:border-white/[0.07] shrink-0 flex items-center',
          collapsed ? 'justify-center px-2' : 'justify-start px-5',
        ].join(' ')}
      >
        <button
          onClick={() => setCollapsed(v => !v)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="relative h-8 w-[1.875rem] shrink-0 opacity-80 hover:opacity-100 transition-opacity"
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

        {!collapsed && (
          <div className="flex-1 min-w-0 flex justify-start ml-3">
            <span className="font-serif text-[0.975rem] font-light text-charcoal dark:text-[#f0ede8] truncate">
              Ki
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-[0.625rem]">

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
                  'rounded-[0.625rem] transition-all duration-150',
                  collapsed
                    ? 'flex items-center justify-center size-9'
                    : 'relative overflow-hidden flex items-center h-9 px-2.5 text-[0.84375rem] text-left',
                  active
                    ? collapsed
                      ? 'bg-charcoal/[0.06] dark:bg-white/[0.06]'
                      : 'text-charcoal dark:text-[#f0ede8] bg-charcoal/[0.06] dark:bg-white/[0.06] font-medium before:absolute before:inset-y-0 before:left-0 before:w-[3.5px] before:bg-accent before:content-[""]'
                    : collapsed
                      ? 'text-charcoal/50 dark:text-[#9e9b96] hover:text-charcoal dark:hover:text-[#f0ede8] hover:bg-charcoal/[0.03] dark:hover:bg-white/[0.03]'
                      : 'text-charcoal/50 dark:text-[#9e9b96] hover:text-charcoal dark:hover:text-[#f0ede8] hover:bg-charcoal/[0.03] dark:hover:bg-white/[0.03]',
                ].join(' ')}
              >
                <span className={active ? 'text-accent' : 'opacity-70'}>
                  <Icon className="block size-[1.125rem]" />
                </span>
                {!collapsed && (
                  <span className="ml-2.5 truncate">{label}</span>
                )}
              </Link>
            )
          })}
        </div>

        {/* Pursuits section */}
        <div className={['mt-4', !collapsed ? 'mx-3.5 pt-1' : 'flex justify-center mb-[0.6875rem]'].join(' ')}>
          {!collapsed
            ? <span className="block text-[0.5625rem] font-semibold text-charcoal/30 dark:text-[#5c5a57] uppercase tracking-[0.1em] mb-2">in pursuit of</span>
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
                  className="flex items-center justify-center py-[0.3125rem]"
                >
                  <span
                    className={[
                      'size-[0.375rem] rounded-full shrink-0 ring-offset-1 dark:ring-offset-[#161514]',
                      active ? 'ring-1 ring-accent/60' : '',
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
                  'block rounded-[0.625rem] px-2.5 py-2 transition-all duration-150',
                  'border',
                  active
                    ? 'bg-accent/[0.07] dark:bg-accent/10 border-accent/45 dark:border-accent/50'
                    : 'bg-transparent border-charcoal/10 dark:border-white/[0.08] hover:border-charcoal/18 dark:hover:border-white/[0.14] hover:bg-charcoal/[0.03] dark:hover:bg-white/[0.03]',
                ].join(' ')}
              >
                <div className="flex items-start gap-1.5 min-w-0">
                  <span
                    className="size-[0.375rem] rounded-full shrink-0 mt-[0.3125rem]"
                    style={{ backgroundColor: color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-serif text-[0.8125rem] font-light text-charcoal dark:text-[#f0ede8] truncate leading-tight min-w-0 flex-1 text-left">
                        {pursuit.name}
                      </span>
                      {modeLabel && modeColor && (
                        <span
                          className="shrink-0 ml-auto text-[0.5rem] font-semibold px-1.5 py-[0.125rem] rounded-full uppercase tracking-[0.06em] border leading-none"
                          style={{ borderColor: `${modeColor}66`, color: modeColor }}
                        >
                          {modeLabel}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-sans text-[0.625rem] text-charcoal/35 dark:text-[#5c5a57] leading-none text-left">
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
                'flex items-center justify-center rounded-[0.625rem] px-2.5 py-2.5',
                'border border-dashed border-charcoal/15 dark:border-white/[0.1]',
                'font-sans text-[0.6875rem] text-charcoal/35 dark:text-[#5c5a57]',
                'hover:border-accent/40 hover:text-accent transition-colors',
              ].join(' ')}
            >
              + new pursuit
            </Link>
          )}
        </div>

      </nav>

      {/* Footer — profile + theme */}
      <div className="h-[4rem] box-border px-[0.875rem] border-t border-charcoal/8 dark:border-white/[0.07] shrink-0 flex items-center">
        {collapsed ? (
          <button
            onClick={() => router.push('/profile')}
            title={displayName}
            className="w-full flex items-center justify-center py-[0.375rem] rounded-[0.625rem] hover:bg-charcoal/5 dark:hover:bg-[#1d1b1a] transition-colors cursor-pointer"
          >
            <div className="w-7 h-7 rounded-full bg-accent/10 border border-accent flex items-center justify-center text-[0.6875rem] font-semibold text-accent shrink-0">
              {avatarLetter}
            </div>
          </button>
        ) : (
          <div className="w-full flex items-center gap-2 px-1.5 py-[0.375rem] rounded-[0.625rem] hover:bg-charcoal/5 dark:hover:bg-[#1d1b1a] transition-colors">
            <button
              onClick={() => router.push('/profile')}
              title={displayName}
              className="shrink-0 cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full bg-accent/10 border border-accent flex items-center justify-center text-[0.6875rem] font-semibold text-accent shrink-0">
                {avatarLetter}
              </div>
            </button>

            {profile && (
              <div className="flex-1 min-w-0 flex justify-center">
                <CycleDayBadge profile={profile} />
              </div>
            )}

            <button
              type="button"
              role="switch"
              aria-checked={isDark}
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className={[
                'relative ml-auto shrink-0 w-[2.875rem] h-[1.5rem] rounded-full cursor-pointer transition-colors',
                'border border-charcoal/10 dark:border-white/[0.1]',
                'bg-charcoal/[0.06] dark:bg-white/[0.08]',
              ].join(' ')}
            >
              <span className="absolute inset-0 flex items-center justify-between px-[0.3125rem] pointer-events-none">
                <MdLightMode
                  className={[
                    'text-[0.6875rem] transition-colors',
                    mounted && !isDark ? 'text-accent' : 'text-charcoal/30 dark:text-[#5c5a57]',
                  ].join(' ')}
                />
                <IoMoon
                  className={[
                    'text-[0.6875rem] transition-colors',
                    mounted && isDark ? 'text-accent' : 'text-charcoal/30 dark:text-[#5c5a57]',
                  ].join(' ')}
                />
              </span>
              <span
                className={[
                  'absolute top-[0.125rem] left-[0.125rem] size-[1.125rem] rounded-full bg-cream dark:bg-[#2a2826]',
                  'border border-charcoal/10 dark:border-white/[0.12] shadow-sm',
                  'transition-transform duration-200 ease-out',
                  mounted && isDark ? 'translate-x-[1.375rem]' : 'translate-x-0',
                ].join(' ')}
              />
            </button>
          </div>
        )}
      </div>

    </aside>
  )
}
