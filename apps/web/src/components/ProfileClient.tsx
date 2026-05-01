'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@ki/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'profile' | 'settings' | 'integrations'

// ─── Accent colors ────────────────────────────────────────────────────────────

const ACCENT_COLORS = [
  { label: 'Terra',   value: '#9e2a2b' },
  { label: 'Ray',     value: '#efcb68' },
  { label: 'Pacific', value: '#58a4b0' },
  { label: 'Sage',    value: '#67934d' },
]

// ─── Memory card titles ───────────────────────────────────────────────────────

const MEMORY_CARDS = [
  'Who you are',
  "What you're building toward",
  "What you're processing",
  'Your patterns',
  'Recurring themes',
]

// ─── Sub-nav ──────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
  { key: 'profile',      label: 'Profile' },
  { key: 'settings',     label: 'Settings' },
  { key: 'integrations', label: 'Integrations' },
]

// ─── Profile tab ─────────────────────────────────────────────────────────────

function ProfileTab({
  profile,
  userEmail,
  displayName,
  avatarLetter,
}: {
  profile: Profile | null
  userEmail: string
  displayName: string
  avatarLetter: string
}) {
  return (
    <div className="px-7 py-[26px] max-w-[620px]">

      {/* User header */}
      <div className="flex items-center gap-[14px] mb-[26px]">
        <div className="w-[50px] h-[50px] rounded-full bg-terra/10 border border-terra flex items-center justify-center text-[18px] font-semibold text-terra shrink-0">
          {avatarLetter}
        </div>
        <div>
          <div className="font-serif text-[20px] font-light text-charcoal dark:text-[#f0ede8]">{displayName}</div>
          <div className="text-[12px] text-charcoal/40 dark:text-[#5c5a57] mt-[2px]">{userEmail}</div>
        </div>
      </div>

      <div className="text-[11px] font-medium text-charcoal/55 dark:text-[#9e9b96] uppercase tracking-[0.08em] mb-[10px]">
        Memory document
      </div>
      <p className="text-[12px] text-charcoal/40 dark:text-[#5c5a57] mb-4 leading-relaxed">
        Ki reads this before every conversation. It is the foundational layer of context — who you are, what you are building toward, and how you think.
      </p>

      {profile?.memory_document ? (
        <div className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-[13px] border-b border-charcoal/8 dark:border-white/[0.07]">
            <div className="text-[13px] font-medium text-charcoal dark:text-[#f0ede8]">Memory document</div>
            <button className="text-[11px] text-charcoal/35 dark:text-[#5c5a57] hover:text-terra transition-colors cursor-pointer">
              edit
            </button>
          </div>
          <div className="px-4 py-[13px] font-serif text-[13px] font-light text-charcoal/60 dark:text-[#9e9b96] leading-[1.8] whitespace-pre-wrap">
            {profile.memory_document}
          </div>
        </div>
      ) : (
        <div className="space-y-[10px]">
          {MEMORY_CARDS.map((title) => (
            <div
              key={title}
              className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-[13px] border-b border-charcoal/8 dark:border-white/[0.07]">
                <div className="text-[13px] font-medium text-charcoal dark:text-[#f0ede8]">{title}</div>
                <button className="text-[11px] text-charcoal/35 dark:text-[#5c5a57] hover:text-terra transition-colors cursor-pointer">
                  edit
                </button>
              </div>
              <div className="px-4 py-[13px] font-serif text-[13px] font-light italic text-charcoal/35 dark:text-[#5c5a57] leading-[1.8]">
                Not set yet.
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}

// ─── Settings tab ─────────────────────────────────────────────────────────────

function SettingsTab({
  mounted,
  accentColor,
  onAccentChange,
}: {
  mounted: boolean
  accentColor: string
  onAccentChange: (color: string) => void
}) {
  const { theme, setTheme } = useTheme()

  const THEME_OPTIONS: { key: string; label: string }[] = [
    { key: 'system', label: 'System' },
    { key: 'light',  label: 'Light' },
    { key: 'dark',   label: 'Dark' },
  ]

  return (
    <div className="px-7 py-[26px] max-w-[560px]">

      {/* Appearance */}
      <div className="mb-[30px]">
        <div className="text-[11px] font-medium text-charcoal/55 dark:text-[#9e9b96] uppercase tracking-[0.08em] mb-4">
          Appearance
        </div>

        {/* Theme */}
        <div className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] px-5 py-4 mb-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-medium text-charcoal dark:text-[#f0ede8] mb-[3px]">Theme</div>
              <div className="text-[11px] text-charcoal/40 dark:text-[#5c5a57]">Choose light, dark, or follow your system</div>
            </div>
            {mounted && (
              <div className="flex items-center gap-1 bg-charcoal/5 dark:bg-[#1d1b1a] border border-charcoal/8 dark:border-white/[0.07] rounded-[10px] p-[3px]">
                {THEME_OPTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setTheme(key)}
                    className={[
                      'px-3 py-[5px] rounded-[8px] text-[11px] font-medium cursor-pointer transition-all',
                      theme === key
                        ? 'bg-terra text-white shadow-sm'
                        : 'text-charcoal/50 dark:text-[#9e9b96] hover:text-charcoal dark:hover:text-[#f0ede8]',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Accent color */}
        <div className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] px-5 py-4">
          <div className="mb-4">
            <div className="text-[13px] font-medium text-charcoal dark:text-[#f0ede8] mb-[3px]">Accent color</div>
            <div className="text-[11px] text-charcoal/40 dark:text-[#5c5a57]">
              Sets the primary color across the entire interface — active states, buttons, highlights
            </div>
          </div>
          <div className="flex items-center gap-4">
            {ACCENT_COLORS.map(({ label, value }) => {
              const selected = accentColor === value
              return (
                <button
                  key={value}
                  onClick={() => onAccentChange(value)}
                  className="flex flex-col items-center gap-2 cursor-pointer group"
                  title={label}
                >
                  <div
                    className="w-9 h-9 rounded-full transition-all duration-150"
                    style={{
                      backgroundColor: value,
                      boxShadow: selected
                        ? `0 0 0 2px var(--color-background, white), 0 0 0 4px ${value}`
                        : 'none',
                      transform: selected ? 'scale(1.1)' : 'scale(1)',
                    }}
                  />
                  <span
                    className="text-[10px] font-medium transition-colors"
                    style={{ color: selected ? value : undefined }}
                  >
                    {!selected && <span className="text-charcoal/35 dark:text-[#5c5a57]">{label}</span>}
                    {selected && label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

    </div>
  )
}

// ─── Integrations tab ────────────────────────────────────────────────────────

function IntegrationsTab() {
  return (
    <div className="px-7 py-[26px] max-w-[560px]">
      <div className="text-[11px] font-medium text-charcoal/55 dark:text-[#9e9b96] uppercase tracking-[0.08em] mb-4">
        Integrations
      </div>
      <div className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] px-5 py-8 text-center">
        <p className="font-serif text-[14px] font-light text-charcoal/40 dark:text-[#5c5a57] mb-2">Coming soon</p>
        <p className="text-[12px] text-charcoal/30 dark:text-[#5c5a57] leading-relaxed">
          Oura ring, Apple Health, and more.<br />Your biometrics as context for Ki.
        </p>
      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

interface ProfileClientProps {
  profile: Profile | null
  userEmail: string
  displayName: string
}

export function ProfileClient({ profile, userEmail, displayName }: ProfileClientProps) {
  const [tab, setTab] = useState<Tab>('profile')
  const [accentColor, setAccentColor] = useState('#9e2a2b')
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const avatarLetter = displayName.charAt(0).toUpperCase()

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('ki-accent-color')
    if (saved) {
      setAccentColor(saved)
    }
  }, [])

  const handleAccentChange = (color: string) => {
    setAccentColor(color)
    document.documentElement.style.setProperty('--color-terra', color)
    localStorage.setItem('ki-accent-color', color)
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/sign-in')
    router.refresh()
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* Sub-nav */}
      <div className="w-[180px] shrink-0 border-r border-charcoal/8 dark:border-white/[0.07] flex flex-col bg-charcoal/[0.01] dark:bg-[#0f0e0e]">
        <div className="px-5 pt-5 pb-2">
          <div className="text-[9px] font-semibold text-charcoal/30 dark:text-[#5c5a57] uppercase tracking-[0.1em]">
            Account
          </div>
        </div>

        <nav className="flex-1 py-1">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={[
                'w-full text-left flex items-center px-5 py-[7px] text-[12.5px] border-l-2 transition-all duration-150',
                tab === key
                  ? 'text-charcoal dark:text-[#f0ede8] bg-terra/10 border-terra font-medium'
                  : 'text-charcoal/50 dark:text-[#9e9b96] border-transparent hover:text-charcoal dark:hover:text-[#f0ede8] hover:bg-charcoal/[0.03] dark:hover:bg-white/[0.03]',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="px-[14px] py-4 border-t border-charcoal/8 dark:border-white/[0.07] space-y-1">
          <button
            onClick={handleSignOut}
            className="w-full text-left px-2 py-[5px] text-[11px] text-charcoal/35 dark:text-[#5c5a57] hover:text-terra transition-colors rounded-lg hover:bg-charcoal/[0.03] dark:hover:bg-white/[0.03]"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'profile' && (
          <ProfileTab
            profile={profile}
            userEmail={userEmail}
            displayName={displayName}
            avatarLetter={avatarLetter}
          />
        )}
        {tab === 'settings' && (
          <SettingsTab
            mounted={mounted}
            accentColor={accentColor}
            onAccentChange={handleAccentChange}
          />
        )}
        {tab === 'integrations' && <IntegrationsTab />}
      </div>

    </div>
  )
}
