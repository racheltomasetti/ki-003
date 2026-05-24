'use client'

import { useState, useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { updateMemoryDocument } from '@ki/services'
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

// ─── Memory document sections ─────────────────────────────────────────────────
// Order and keys are stable — they determine parse/serialize order.

const MEMORY_SECTIONS = [
  {
    key: 'who_you_are',
    title: 'Who you are',
    subtitle: 'How do you see yourself? How do you think and move through the world? Not demographics — the operating system underneath everything.',
    placeholder: 'How do you process experience, make decisions, relate to building and becoming…',
  },
  {
    key: 'building_or_becoming',
    title: 'What you are building or becoming',
    subtitle: 'Both externally and internally — the project, the work, and the version of yourself you are moving toward.',
    placeholder: 'The software, the business, the creative work. And the mindset, the habit, the identity shift…',
  },
  {
    key: 'carrying_right_now',
    title: 'What you are carrying right now',
    subtitle: 'The questions most alive for you. Pursuits, curiosities, things you keep returning to. No structure imposed.',
    placeholder: 'What you\'re thinking about, exploring, or trying to figure out…',
  },
  {
    key: 'tried_and_lacking',
    title: 'What you have tried and found lacking',
    subtitle: 'Tools, systems, or approaches that haven\'t worked for you — and why. Tells Ki what not to be.',
    placeholder: 'Journaling apps, productivity systems, note-taking tools, approaches to thinking…',
  },
  {
    key: 'what_you_want_from_ki',
    title: 'What you want from Ki',
    subtitle: 'What drew you here? What would make this feel worth returning to? A felt sense, not a feature request.',
    placeholder: 'What\'s missing. What kind of thinking partner you need…',
  },
] as const

type SectionKey = typeof MEMORY_SECTIONS[number]['key']

// ─── Memory document serialization ───────────────────────────────────────────
// Format: "## Section Title\nContent\n\n## Next Section\nContent"

function parseMemoryDocument(doc: string | null): Record<SectionKey, string> {
  const result = {} as Record<SectionKey, string>
  for (const section of MEMORY_SECTIONS) {
    result[section.key] = ''
  }

  if (!doc) return result

  for (let i = 0; i < MEMORY_SECTIONS.length; i++) {
    const section = MEMORY_SECTIONS[i]
    const header = `## ${section.title}\n`
    const start = doc.indexOf(header)
    if (start === -1) continue

    const contentStart = start + header.length

    // Find the next section header
    let contentEnd = doc.length
    for (let j = i + 1; j < MEMORY_SECTIONS.length; j++) {
      const nextHeader = `## ${MEMORY_SECTIONS[j].title}\n`
      const nextStart = doc.indexOf(nextHeader, contentStart)
      if (nextStart !== -1) {
        contentEnd = nextStart
        break
      }
    }

    result[section.key] = doc.slice(contentStart, contentEnd).trim()
  }

  return result
}

function serializeMemoryDocument(sections: Record<SectionKey, string>): string {
  return MEMORY_SECTIONS
    .map(s => `## ${s.title}\n${sections[s.key] ?? ''}`)
    .join('\n\n')
    .trim()
}

// ─── Sub-nav ──────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
  { key: 'profile',      label: 'Profile' },
  { key: 'settings',     label: 'Settings' },
  { key: 'integrations', label: 'Integrations' },
]

// ─── Memory card ──────────────────────────────────────────────────────────────

function MemoryCard({
  title,
  subtitle,
  placeholder,
  value,
  onSave,
}: {
  title: string
  subtitle: string
  placeholder: string
  value: string
  onSave: (val: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync external value changes (e.g. after a successful save from another card)
  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  // Auto-focus + resize on open
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [editing])

  const handleEdit = () => {
    setDraft(value)
    setEditing(true)
  }

  const handleCancel = () => {
    setDraft(value)
    setEditing(false)
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave(draft.trim())
    setSaving(false)
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') handleCancel()
    // Cmd+Enter or Ctrl+Enter to save
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    }
  }

  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${e.target.scrollHeight}px`
  }

  const isEmpty = !value

  return (
    <div className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-[13px] border-b border-charcoal/8 dark:border-white/[0.07]">
        <div className="font-sans text-[13px] font-medium text-charcoal dark:text-[#f0ede8]">{title}</div>
        {!editing && (
          <button
            onClick={handleEdit}
            className="font-sans text-[11px] text-charcoal/35 dark:text-[#5c5a57] hover:text-terra transition-colors cursor-pointer"
          >
            {isEmpty ? 'add' : 'edit'}
          </button>
        )}
      </div>

      {/* Card body */}
      <div className="px-4 py-[13px]">
        {editing ? (
          <div className="flex flex-col gap-3">
            <p className="font-sans text-[11px] text-charcoal/40 dark:text-[#5c5a57] leading-relaxed">
              {subtitle}
            </p>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={autoResize}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={4}
              className="w-full font-serif text-[13px] font-light text-charcoal dark:text-[#f0ede8] bg-transparent resize-none outline-none placeholder-charcoal/25 dark:placeholder-[#5c5a57] leading-[1.8]"
            />
            <div className="flex items-center gap-3 pt-1 border-t border-charcoal/8 dark:border-white/[0.07]">
              <button
                onClick={handleSave}
                disabled={saving}
                className="font-sans text-[11px] font-medium text-terra hover:opacity-80 transition-opacity disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="font-sans text-[11px] text-charcoal/35 dark:text-[#5c5a57] hover:text-charcoal dark:hover:text-[#f0ede8] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <span className="ml-auto font-sans text-[10px] text-charcoal/25 dark:text-[#5c5a57]">
                ⌘↵ to save
              </span>
            </div>
          </div>
        ) : isEmpty ? (
          <p className="font-serif text-[13px] font-light italic text-charcoal/30 dark:text-[#5c5a57] leading-[1.8]">
            Not set yet.
          </p>
        ) : (
          <p className="font-serif text-[13px] font-light text-charcoal/70 dark:text-[#9e9b96] leading-[1.8] whitespace-pre-wrap">
            {value}
          </p>
        )}
      </div>
    </div>
  )
}

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
  const supabase = createClient()
  const [sections, setSections] = useState<Record<SectionKey, string>>(
    () => parseMemoryDocument(profile?.memory_document ?? null)
  )
  const [lastSaved, setLastSaved] = useState<string | null>(
    profile?.memory_updated_at ?? null
  )

  const handleSaveSection = async (key: SectionKey, value: string) => {
    const updated = { ...sections, [key]: value }
    setSections(updated)

    const doc = serializeMemoryDocument(updated)
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) return

    const { error } = await updateMemoryDocument(supabase, userId, doc)
    if (!error) {
      setLastSaved(new Date().toISOString())
    }
  }

  const formatSaved = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="px-7 py-[26px] max-w-[620px]">

      {/* User header */}
      <div className="flex items-center gap-[14px] mb-[26px]">
        <div className="w-[50px] h-[50px] rounded-full bg-terra/10 border border-terra flex items-center justify-center text-[18px] font-semibold text-terra shrink-0">
          {avatarLetter}
        </div>
        <div>
          <div className="font-serif text-[20px] font-light text-charcoal dark:text-[#f0ede8]">{displayName}</div>
          <div className="font-sans text-[12px] text-charcoal/40 dark:text-[#5c5a57] mt-[2px]">{userEmail}</div>
        </div>
      </div>

      {/* Memory document header */}
      <div className="flex items-baseline justify-between mb-[10px]">
        <div className="font-sans text-[11px] font-medium text-charcoal/55 dark:text-[#9e9b96] uppercase tracking-[0.08em]">
          Memory document
        </div>
        {lastSaved && (
          <div className="font-sans text-[10px] text-charcoal/30 dark:text-[#5c5a57]">
            Saved {formatSaved(lastSaved)}
          </div>
        )}
      </div>
      <p className="font-sans text-[12px] text-charcoal/40 dark:text-[#5c5a57] mb-4 leading-relaxed">
        Ki reads this before every conversation. Fill it in over time — it does not need to be complete on day one.
      </p>

      {/* Section cards */}
      <div className="space-y-[10px]">
        {MEMORY_SECTIONS.map((s) => (
          <MemoryCard
            key={s.key}
            title={s.title}
            subtitle={s.subtitle}
            placeholder={s.placeholder}
            value={sections[s.key]}
            onSave={(val) => handleSaveSection(s.key, val)}
          />
        ))}
      </div>

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
        <div className="font-sans text-[11px] font-medium text-charcoal/55 dark:text-[#9e9b96] uppercase tracking-[0.08em] mb-4">
          Appearance
        </div>

        {/* Theme */}
        <div className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] px-5 py-4 mb-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-sans text-[13px] font-medium text-charcoal dark:text-[#f0ede8] mb-[3px]">Theme</div>
              <div className="font-sans text-[11px] text-charcoal/40 dark:text-[#5c5a57]">Choose light, dark, or follow your system</div>
            </div>
            {mounted && (
              <div className="flex items-center gap-1 bg-charcoal/5 dark:bg-[#1d1b1a] border border-charcoal/8 dark:border-white/[0.07] rounded-[10px] p-[3px]">
                {THEME_OPTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setTheme(key)}
                    className={[
                      'px-3 py-[5px] rounded-[8px] font-sans text-[11px] font-medium cursor-pointer transition-all',
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
            <div className="font-sans text-[13px] font-medium text-charcoal dark:text-[#f0ede8] mb-[3px]">Accent color</div>
            <div className="font-sans text-[11px] text-charcoal/40 dark:text-[#5c5a57]">
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
                    className="font-sans text-[10px] font-medium transition-colors"
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
      <div className="font-sans text-[11px] font-medium text-charcoal/55 dark:text-[#9e9b96] uppercase tracking-[0.08em] mb-4">
        Integrations
      </div>
      <div className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] px-5 py-8 text-center">
        <p className="font-serif text-[14px] font-light text-charcoal/40 dark:text-[#5c5a57] mb-2">Coming soon</p>
        <p className="font-sans text-[12px] text-charcoal/30 dark:text-[#5c5a57] leading-relaxed">
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
          <div className="font-sans text-[9px] font-semibold text-charcoal/30 dark:text-[#5c5a57] uppercase tracking-[0.1em]">
            Account
          </div>
        </div>

        <nav className="flex-1 py-1">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={[
                'w-full text-left flex items-center px-5 py-[7px] font-sans text-[12.5px] border-l-2 transition-all duration-150',
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
            className="w-full text-left px-2 py-[5px] font-sans text-[11px] text-charcoal/35 dark:text-[#5c5a57] hover:text-terra transition-colors rounded-lg hover:bg-charcoal/[0.03] dark:hover:bg-white/[0.03]"
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
