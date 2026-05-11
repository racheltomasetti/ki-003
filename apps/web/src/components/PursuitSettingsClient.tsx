'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { updatePursuit, archivePursuit, deletePursuit } from '@ki/services'
import type { Pursuit, PursuitMode } from '@ki/types'

type Tab = 'details' | 'appearance' | 'management'

const TABS: { key: Tab; label: string }[] = [
  { key: 'details',      label: 'Details' },
  { key: 'appearance',   label: 'Appearance' },
  { key: 'management',   label: 'Management' },
]

const ACCENT_COLORS = [
  { label: 'Terra',   value: '#9e2a2b' },
  { label: 'Ray',     value: '#efcb68' },
  { label: 'Pacific', value: '#58a4b0' },
  { label: 'Sage',    value: '#67934d' },
]

const MODE_OPTIONS: { value: PursuitMode; label: string }[] = [
  { value: 'building',     label: 'Building' },
  { value: 'researching',  label: 'Researching' },
  { value: 'figuring_out', label: 'Figuring out' },
  { value: 'creating',     label: 'Creating' },
]

// ─── Details tab (name, brief fields, mode) ───────────────────────────────────

function DetailsTab({ pursuit }: { pursuit: Pursuit }) {
  const supabase = createClient()

  type DraftKey = 'name' | 'what' | 'why' | 'success_looks_like' | 'open_question'
  type Draft = Record<DraftKey, string> & { pursuit_mode: PursuitMode | '' }

  const initialRef = useRef<Draft>({
    name: pursuit.name,
    what: pursuit.what ?? '',
    why: pursuit.why ?? '',
    success_looks_like: pursuit.success_looks_like ?? '',
    open_question: pursuit.open_question ?? '',
    pursuit_mode: pursuit.pursuit_mode ?? '',
  })

  const [draft, setDraft] = useState<Draft>({ ...initialRef.current })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const dirty = JSON.stringify(draft) !== JSON.stringify(initialRef.current)

  const handleSave = async () => {
    if (!draft.name.trim() || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      await updatePursuit(supabase, pursuit.id, {
        name: draft.name.trim(),
        what: draft.what.trim() || null,
        why: draft.why.trim() || null,
        success_looks_like: draft.success_looks_like.trim() || null,
        open_question: draft.open_question.trim() || null,
        pursuit_mode: draft.pursuit_mode || null,
      })
      initialRef.current = { ...draft, name: draft.name.trim() }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setSaveError('Something went wrong. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const FIELDS: { key: DraftKey; label: string; hint?: string; type: 'input' | 'textarea' }[] = [
    { key: 'name',             label: 'Pursuit name',                      type: 'input' },
    { key: 'what',             label: 'What are you building?',            type: 'textarea' },
    { key: 'why',              label: 'Why are you building this?',        type: 'textarea' },
    { key: 'success_looks_like', label: 'What does success look like?',   type: 'textarea', hint: 'Be concrete — what would you see, feel, or ship?' },
    { key: 'open_question',    label: "What's the biggest open question?", type: 'textarea', hint: 'The thing keeping you up at night.' },
  ]

  const inputClass = 'w-full bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/10 dark:border-white/[0.08] rounded-[10px] px-4 py-[9px] font-serif text-[14px] text-charcoal dark:text-[#f0ede8] placeholder:text-charcoal/25 dark:placeholder:text-[#5c5a57] outline-none focus:border-charcoal/20 dark:focus:border-white/[0.15] transition-colors'

  return (
    <div className="px-7 py-[26px] max-w-[620px]">
      <div className="text-[11px] font-medium text-charcoal/55 dark:text-[#9e9b96] uppercase tracking-[0.08em] mb-5">
        Pursuit details
      </div>

      <div className="space-y-5 mb-7">
        {FIELDS.map(({ key, label, hint, type }) => (
          <div key={key}>
            <label className="flex items-center gap-1 text-[11px] font-medium text-charcoal/50 dark:text-[#5c5a57] uppercase tracking-[0.07em] mb-[6px]">
              {label}
              {key === 'name' && <span className="text-terra normal-case tracking-normal">*</span>}
            </label>
            {hint && (
              <p className="text-[11px] text-charcoal/35 dark:text-[#5c5a57] mb-[6px] leading-relaxed">{hint}</p>
            )}
            {type === 'input' ? (
              <input
                type="text"
                value={draft[key]}
                onChange={e => setDraft(prev => ({ ...prev, [key]: e.target.value }))}
                className={inputClass}
              />
            ) : (
              <textarea
                value={draft[key]}
                onChange={e => setDraft(prev => ({ ...prev, [key]: e.target.value }))}
                rows={3}
                className={`${inputClass} resize-none leading-relaxed`}
              />
            )}
          </div>
        ))}

        {/* Pursuit mode */}
        <div>
          <label className="block text-[11px] font-medium text-charcoal/50 dark:text-[#5c5a57] uppercase tracking-[0.07em] mb-[8px]">
            Pursuit mode
          </label>
          <div className="flex flex-wrap gap-2">
            {MODE_OPTIONS.map(({ value, label }) => {
              const selected = draft.pursuit_mode === value
              return (
                <button
                  key={value}
                  onClick={() => setDraft(prev => ({
                    ...prev,
                    pursuit_mode: selected ? '' : value,
                  }))}
                  className={[
                    'px-4 py-[7px] rounded-[10px] border font-sans text-[12px] font-medium transition-all',
                    selected
                      ? 'bg-terra border-terra text-cream'
                      : 'border-charcoal/12 dark:border-white/[0.08] text-charcoal/55 dark:text-[#9e9b96] hover:border-charcoal/20 dark:hover:border-white/[0.13] hover:text-charcoal dark:hover:text-[#f0ede8]',
                  ].join(' ')}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!dirty || !draft.name.trim() || saving}
          className={[
            'px-5 py-[9px] rounded-[10px] font-sans text-[13px] font-semibold transition-all',
            dirty && draft.name.trim() && !saving
              ? 'bg-terra text-cream hover:bg-terra/90'
              : 'bg-charcoal/8 dark:bg-white/5 text-charcoal/25 dark:text-[#5c5a57] cursor-not-allowed',
          ].join(' ')}
        >
          {saving ? 'saving…' : 'save changes'}
        </button>
        {saved && <span className="font-sans text-[12px] text-sage">saved</span>}
        {saveError && <span className="font-sans text-[12px] text-terra">{saveError}</span>}
      </div>
    </div>
  )
}

// ─── Appearance tab ───────────────────────────────────────────────────────────

function AppearanceTab({ pursuit }: { pursuit: Pursuit }) {
  const supabase = createClient()
  const [color, setColor] = useState(pursuit.color ?? '#9e2a2b')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleColorChange = async (value: string) => {
    if (value === color || saving) return
    setColor(value)
    setSaving(true)
    try {
      await updatePursuit(supabase, pursuit.id, { color: value })
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch {
      setColor(color)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-7 py-[26px] max-w-[560px]">
      <div className="text-[11px] font-medium text-charcoal/55 dark:text-[#9e9b96] uppercase tracking-[0.08em] mb-5">
        Appearance
      </div>

      <div className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] px-5 py-5">
        <div className="mb-5">
          <div className="text-[13px] font-medium text-charcoal dark:text-[#f0ede8] mb-[4px]">Pursuit color</div>
          <div className="text-[11px] text-charcoal/40 dark:text-[#5c5a57] leading-relaxed">
            Shows as the color dot across the app — sidebar, home widget, pursuit header.
          </div>
        </div>

        <div className="flex items-center gap-5">
          {ACCENT_COLORS.map(({ label, value }) => {
            const selected = color === value
            return (
              <button
                key={value}
                onClick={() => handleColorChange(value)}
                disabled={saving}
                className="flex flex-col items-center gap-2 cursor-pointer disabled:cursor-wait"
                title={label}
              >
                <div
                  className="w-9 h-9 rounded-full transition-all duration-150"
                  style={{
                    backgroundColor: value,
                    boxShadow: selected
                      ? `0 0 0 2px var(--color-cream, #f6f1e6), 0 0 0 4px ${value}`
                      : 'none',
                    transform: selected ? 'scale(1.12)' : 'scale(1)',
                  }}
                />
                <span
                  className="font-sans text-[10px] font-medium transition-colors"
                  style={{ color: selected ? value : undefined }}
                >
                  {selected
                    ? label
                    : <span className="text-charcoal/35 dark:text-[#5c5a57]">{label}</span>
                  }
                </span>
              </button>
            )
          })}
        </div>

        {saved && (
          <p className="font-sans text-[11px] text-sage mt-4">color saved</p>
        )}
      </div>
    </div>
  )
}

// ─── Management tab (archive / delete) ────────────────────────────────────────

function ManagementTab({ pursuit }: { pursuit: Pursuit }) {
  const supabase = createClient()
  const router = useRouter()

  const [archiveConfirm, setArchiveConfirm] = useState(false)
  const [archiving, setArchiving] = useState(false)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleArchive = async () => {
    if (archiving) return
    setArchiving(true)
    try {
      await archivePursuit(supabase, pursuit.id)
      router.push('/home')
    } catch {
      setArchiving(false)
      setArchiveConfirm(false)
    }
  }

  const handleDelete = async () => {
    if (deleting || deleteInput !== pursuit.name) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deletePursuit(supabase, pursuit.id)
      router.push('/home')
    } catch {
      setDeleteError('Something went wrong. Try again.')
      setDeleting(false)
    }
  }

  return (
    <div className="px-7 py-[26px] max-w-[560px]">
      <div className="text-[11px] font-medium text-charcoal/55 dark:text-[#9e9b96] uppercase tracking-[0.08em] mb-5">
        Management
      </div>

      {/* Archive */}
      <div className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] px-5 py-5 mb-4">
        <div className="mb-4">
          <div className="text-[13px] font-medium text-charcoal dark:text-[#f0ede8] mb-[4px]">Archive pursuit</div>
          <div className="text-[11px] text-charcoal/40 dark:text-[#5c5a57] leading-relaxed">
            Frees up a slot for a new pursuit. Your captures, brief, and conversations are all preserved.
            Access archived pursuits from your profile.
          </div>
        </div>

        {archiveConfirm ? (
          <div className="flex items-center gap-3">
            <span className="font-sans text-[12px] text-charcoal/50 dark:text-[#9e9b96]">
              Archive <span className="font-medium text-charcoal dark:text-[#f0ede8]">{pursuit.name}</span>?
            </span>
            <button
              onClick={handleArchive}
              disabled={archiving}
              className="px-4 py-[6px] rounded-[8px] bg-ray/20 text-charcoal dark:text-[#f0ede8] font-sans text-[12px] font-medium hover:bg-ray/30 transition-colors disabled:opacity-50"
            >
              {archiving ? 'archiving…' : 'confirm archive'}
            </button>
            <button
              onClick={() => setArchiveConfirm(false)}
              className="font-sans text-[12px] text-charcoal/35 dark:text-[#5c5a57] hover:text-charcoal dark:hover:text-[#9e9b96] transition-colors"
            >
              cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setArchiveConfirm(true)}
            className="px-4 py-[7px] rounded-[10px] border border-charcoal/12 dark:border-white/[0.08] font-sans text-[12px] font-medium text-charcoal/60 dark:text-[#9e9b96] hover:border-charcoal/20 dark:hover:border-white/[0.15] hover:text-charcoal dark:hover:text-[#f0ede8] transition-all"
          >
            Archive pursuit
          </button>
        )}
      </div>

      {/* Delete */}
      <div className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] px-5 py-5">
        <div className="mb-4">
          <div className="text-[13px] font-medium text-charcoal dark:text-[#f0ede8] mb-[4px]">Delete permanently</div>
          <div className="text-[11px] text-charcoal/40 dark:text-[#5c5a57] leading-relaxed">
            This cannot be undone. All pursuit conversations and artifacts will be deleted.
            Captures assigned to this pursuit will not be affected.
          </div>
        </div>

        {deleteOpen ? (
          <div className="space-y-3">
            <label className="block font-sans text-[11px] text-charcoal/50 dark:text-[#5c5a57]">
              Type <span className="font-medium text-charcoal dark:text-[#f0ede8]">{pursuit.name}</span> to confirm
            </label>
            <input
              type="text"
              value={deleteInput}
              onChange={e => setDeleteInput(e.target.value)}
              placeholder={pursuit.name}
              className="w-full bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/10 dark:border-white/[0.08] rounded-[10px] px-4 py-[9px] font-sans text-[13px] text-charcoal dark:text-[#f0ede8] placeholder:text-charcoal/20 dark:placeholder:text-[#5c5a57] outline-none focus:border-charcoal/20 dark:focus:border-white/[0.15] transition-colors"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={handleDelete}
                disabled={deleteInput !== pursuit.name || deleting}
                className={[
                  'px-4 py-[7px] rounded-[10px] font-sans text-[12px] font-semibold transition-all',
                  deleteInput === pursuit.name && !deleting
                    ? 'bg-terra text-cream hover:bg-terra/90'
                    : 'bg-charcoal/8 dark:bg-white/5 text-charcoal/25 dark:text-[#5c5a57] cursor-not-allowed',
                ].join(' ')}
              >
                {deleting ? 'deleting…' : 'Delete pursuit'}
              </button>
              <button
                onClick={() => { setDeleteOpen(false); setDeleteInput(''); setDeleteError(null) }}
                className="font-sans text-[12px] text-charcoal/35 dark:text-[#5c5a57] hover:text-charcoal dark:hover:text-[#9e9b96] transition-colors"
              >
                cancel
              </button>
            </div>
            {deleteError && (
              <p className="font-sans text-[11px] text-terra">{deleteError}</p>
            )}
          </div>
        ) : (
          <button
            onClick={() => setDeleteOpen(true)}
            className="px-4 py-[7px] rounded-[10px] border border-charcoal/12 dark:border-white/[0.08] font-sans text-[12px] font-medium text-charcoal/60 dark:text-[#9e9b96] hover:border-charcoal/20 dark:hover:border-white/[0.15] hover:text-charcoal dark:hover:text-[#f0ede8] transition-all"
          >
            Delete pursuit
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function PursuitSettingsClient({ pursuit }: { pursuit: Pursuit }) {
  const [tab, setTab] = useState<Tab>('details')

  return (
    <div className="flex h-full overflow-hidden">

      {/* Sub-nav */}
      <div className="w-[180px] shrink-0 border-r border-charcoal/8 dark:border-white/[0.07] flex flex-col bg-charcoal/[0.01] dark:bg-[#0f0e0e]">

        <div className="px-5 pt-5 pb-2">
          <Link
            href={`/pursuits/${pursuit.id}`}
            className="inline-flex items-center justify-center text-charcoal/35 dark:text-[#5c5a57] hover:text-charcoal dark:hover:text-[#9e9b96] transition-colors mb-[14px]"
            aria-label="Back to pursuit"
          >
            <svg className="size-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <div className="text-[9px] font-semibold text-charcoal/30 dark:text-[#5c5a57] uppercase tracking-[0.1em]">
            Pursuit settings
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

      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'details'    && <DetailsTab    pursuit={pursuit} />}
        {tab === 'appearance' && <AppearanceTab pursuit={pursuit} />}
        {tab === 'management' && <ManagementTab pursuit={pursuit} />}
      </div>

    </div>
  )
}
