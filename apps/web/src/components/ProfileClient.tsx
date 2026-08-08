'use client'

import { useState, useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { applyAccentColor } from '@/lib/accent'
import { createClient } from '@/lib/supabase/client'
import {
  updateMemoryDocument,
  enableMenstrualTracking,
  getCurrentCycleInfo,
  getPeriodLogs,
  getPeriodInstances,
  logPeriodDay,
  logPeriodRange,
  updatePeriodInstance,
  deletePeriodRange,
} from '@ki/services'
import { resolveCyclePhase, getLocalYYYYMMDD, type PeriodInstance } from '@ki/utils'
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

// ─── Sub-nav ──────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
  { key: 'profile',      label: 'Profile' },
  { key: 'settings',     label: 'Settings' },
  { key: 'integrations', label: 'Integrations' },
]

function formatSaved(iso: string) {
  const d = new Date(iso)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const h24 = d.getHours()
  const h12 = h24 % 12 || 12
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ampm = h24 < 12 ? 'AM' : 'PM'
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} @ ${String(h12).padStart(2, '0')}:${mm} ${ampm}`
}

// ─── Memory agent chat (side panel) ───────────────────────────────────────────

interface MemoryChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

function MemoryAgentPanel({
  draft,
  onDraftUpdate,
  onClose,
}: {
  draft: string
  onDraftUpdate: (next: string) => void
  onClose: () => void
}) {
  const supabase = createClient()
  const [messages, setMessages] = useState<MemoryChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  const send = async (raw: string) => {
    const content = raw.trim()
    if (!content || sending) return

    const userMsg: MemoryChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content,
    }
    const history = messages.map(m => ({ role: m.role, content: m.content }))
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setSending(true)

    try {
      const { data, error } = await supabase.functions.invoke('memory-agent', {
        body: {
          message: content,
          conversation_history: history,
          current_document: draft,
        },
      })

      if (error) throw error

      const agentData = data as {
        response?: string
        draft?: string
        summary?: string
      }

      if (typeof agentData.draft === 'string' && agentData.draft.trim()) {
        onDraftUpdate(agentData.draft)
      }

      setMessages(prev => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: agentData.response?.trim()
            || agentData.summary
            || 'Updated your draft — review it in the editor.',
        },
      ])
    } catch (err) {
      console.error('memory-agent error:', err)
      setMessages(prev => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: 'Something went wrong. Please try again.',
        },
      ])
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  return (
    <aside className="w-[360px] shrink-0 h-full flex flex-col border-l border-charcoal/8 dark:border-white/[0.07] bg-cream dark:bg-[#161514]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-charcoal/8 dark:border-white/[0.07] shrink-0">
        <div>
          <div className="font-sans text-[12px] font-medium text-charcoal dark:text-[#f0ede8]">
            Build with Ki
          </div>
          <div className="font-sans text-[10px] text-charcoal/40 dark:text-[#5c5a57] mt-0.5">
            Grounded in your captures · edits the draft live
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="font-sans text-[11px] text-charcoal/40 dark:text-[#5c5a57] hover:text-charcoal dark:hover:text-[#f0ede8] transition-colors"
        >
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
        {messages.length === 0 && !sending && (
          <p className="px-1 font-serif text-[13px] font-light italic text-charcoal/45 dark:text-[#9e9b96] leading-relaxed">
            Tell Ki who you are, what you&apos;re carrying, or how you want this document to read. It will write into the editor as you go — Save when it feels right.
          </p>
        )}

        {messages.map(m => (
          <div
            key={m.id}
            className={m.role === 'user' ? 'self-end max-w-[90%]' : 'self-start max-w-[95%]'}
          >
            <div
              className={[
                'px-3 py-2 rounded-xl font-sans text-[12px] leading-relaxed whitespace-pre-wrap',
                m.role === 'user'
                  ? 'bg-accent text-on-accent rounded-br-sm'
                  : 'bg-charcoal/[0.05] dark:bg-white/[0.05] border border-charcoal/8 dark:border-white/7 text-charcoal dark:text-[#f0ede8] rounded-bl-sm',
              ].join(' ')}
            >
              {m.content}
            </div>
          </div>
        ))}

        {sending && (
          <div className="self-start px-3 py-2.5 rounded-xl rounded-bl-sm bg-charcoal/[0.05] dark:bg-white/[0.05] border border-charcoal/8 dark:border-white/7">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-charcoal/30 dark:bg-white/30 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-charcoal/30 dark:bg-white/30 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-charcoal/30 dark:bg-white/30 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="shrink-0 px-3 py-3 border-t border-charcoal/8 dark:border-white/[0.07]">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {[
            'Help me start this document',
            'What do my captures say about me?',
            'Tighten what I have so far',
          ].map(chip => (
            <button
              key={chip}
              type="button"
              disabled={sending}
              onClick={() => void send(chip)}
              className="font-sans text-[10px] px-2 py-1 rounded-full border border-charcoal/12 dark:border-white/8 text-charcoal/45 dark:text-[#5c5a57] hover:border-accent/40 hover:text-accent transition-colors disabled:opacity-40"
            >
              {chip}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2 bg-charcoal/[0.03] dark:bg-[#1d1b1a] border border-charcoal/8 dark:border-white/[0.07] rounded-[12px] px-2.5 py-2 focus-within:border-charcoal/15 dark:focus-within:border-white/15">
          <textarea
            ref={inputRef}
            value={input}
            disabled={sending}
            rows={2}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send(input)
              }
            }}
            placeholder="Talk to Ki about your memory document…"
            className="flex-1 bg-transparent border-none outline-none resize-none font-sans text-[12px] text-charcoal dark:text-[#f0ede8] placeholder:text-charcoal/30 dark:placeholder:text-[#5c5a57] leading-relaxed disabled:opacity-50"
          />
          <button
            type="button"
            disabled={sending || !input.trim()}
            onClick={() => void send(input)}
            className="shrink-0 font-sans text-[11px] font-medium text-accent disabled:opacity-35 hover:opacity-80 transition-opacity"
          >
            Send
          </button>
        </div>
      </div>
    </aside>
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
  const [draft, setDraft] = useState(profile?.memory_document ?? '')
  const [lastSaved, setLastSaved] = useState<string | null>(
    profile?.memory_updated_at ?? null
  )
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 280)}px`
  }, [draft])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value)
    setDirty(true)
  }

  const handleAgentDraft = (next: string) => {
    setDraft(next)
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) {
      setSaving(false)
      return
    }

    const { error } = await updateMemoryDocument(supabase, userId, draft.trim())
    if (!error) {
      setDraft(draft.trim())
      setLastSaved(new Date().toISOString())
      setDirty(false)
    }
    setSaving(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      void handleSave()
    }
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex-1 overflow-y-auto px-7 py-[26px]">
        <div className="max-w-[620px]">

          {/* User header */}
          <div className="flex items-center gap-[14px] mb-[26px]">
            <div className="w-[50px] h-[50px] rounded-full bg-accent/10 border border-accent flex items-center justify-center text-[18px] font-semibold text-accent shrink-0">
              {avatarLetter}
            </div>
            <div>
              <div className="font-serif text-[20px] font-light text-charcoal dark:text-[#f0ede8]">{displayName}</div>
              <div className="font-sans text-[12px] text-charcoal/40 dark:text-[#5c5a57] mt-[2px]">{userEmail}</div>
            </div>
          </div>

          {/* Memory document header */}
          <div className="flex items-baseline justify-between gap-3 mb-[10px]">
            <div className="font-sans text-[11px] font-medium text-charcoal/55 dark:text-[#9e9b96] uppercase tracking-[0.08em]">
              Memory document
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {lastSaved && (
                <div className="font-sans text-[10px] text-charcoal/30 dark:text-[#5c5a57]">
                  Saved {formatSaved(lastSaved)}
                </div>
              )}
              <button
                type="button"
                onClick={() => setPanelOpen(v => !v)}
                className={[
                  'font-sans text-[11px] font-medium transition-colors',
                  panelOpen
                    ? 'text-accent'
                    : 'text-charcoal/45 dark:text-[#9e9b96] hover:text-accent',
                ].join(' ')}
              >
                {panelOpen ? 'Hide Ki' : 'Build with Ki'}
              </button>
            </div>
          </div>
          <p className="font-sans text-[12px] text-charcoal/40 dark:text-[#5c5a57] mb-4 leading-relaxed">
            Ki reads this before every conversation. Write it as markdown — or open Build with Ki and shape it from your captures. Save when it feels right.
          </p>

          <div className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] overflow-hidden">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Start writing your memory document…"
              rows={12}
              className="w-full min-h-[280px] px-4 py-[14px] font-serif text-[13px] font-light text-charcoal dark:text-[#f0ede8] bg-transparent resize-none outline-none placeholder-charcoal/25 dark:placeholder-[#5c5a57] leading-[1.8]"
            />
            <div className="flex items-center gap-3 px-4 py-3 border-t border-charcoal/8 dark:border-white/[0.07]">
              <button
                onClick={() => void handleSave()}
                disabled={saving || !dirty}
                className="font-sans text-[11px] font-medium text-accent hover:opacity-80 transition-opacity disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              {dirty && (
                <span className="font-sans text-[10px] text-charcoal/35 dark:text-[#5c5a57]">
                  Unsaved changes
                </span>
              )}
              <span className="ml-auto font-sans text-[10px] text-charcoal/25 dark:text-[#5c5a57]">
                Markdown · ⌘↵ to save
              </span>
            </div>
          </div>

        </div>
      </div>

      {panelOpen && (
        <MemoryAgentPanel
          draft={draft}
          onDraftUpdate={handleAgentDraft}
          onClose={() => setPanelOpen(false)}
        />
      )}
    </div>
  )
}

// ─── Settings tab ─────────────────────────────────────────────────────────────

// ─── Re-enrich card ──────────────────────────────────────────────────────────
// Loops the re-enrich Edge Function page by page until the cursor runs out.
// Safe to re-run: captures are immutable — only enrichments are rewritten.

interface ReEnrichPage {
  processed: number
  enriched: number
  failed: number
  next_cursor: string | null
  total: number
}

function ReEnrichCard() {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<{ enriched: number; failed: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runReEnrich = async () => {
    setRunning(true)
    setError(null)
    setResult(null)
    const supabase = createClient()
    let cursor: string | null = null
    let done = 0
    let enriched = 0
    let failed = 0
    try {
      do {
        const { data, error: fnError } = await supabase.functions.invoke('re-enrich', {
          body: { limit: 10, cursor },
        })
        if (fnError) throw fnError
        const page = data as ReEnrichPage
        done += page.processed
        enriched += page.enriched
        failed += page.failed
        cursor = page.next_cursor
        setProgress({ done, total: page.total })
      } while (cursor)
      setResult({ enriched, failed })
    } catch (err) {
      console.error('re-enrich error:', err)
      setError('Re-enrichment stopped early. Run it again — finished captures keep their fresh enrichment.')
    } finally {
      setRunning(false)
      setProgress(null)
    }
  }

  return (
    <div className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] px-5 py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-sans text-[13px] font-medium text-charcoal dark:text-[#f0ede8] mb-[3px]">Re-enrich corpus</div>
          <div className="font-sans text-[11px] text-charcoal/40 dark:text-[#5c5a57] leading-relaxed">
            Re-runs the enrichment pipeline over every capture — themes, sentiment, energy, intent, and
            pursuit connections extracted fresh. Your captures themselves are never altered.
          </div>
        </div>
        <button
          onClick={runReEnrich}
          disabled={running}
          className={[
            'shrink-0 px-4 py-[7px] rounded-[10px] font-sans text-[11.5px] font-medium transition-all',
            running
              ? 'bg-charcoal/10 dark:bg-white/[0.08] text-charcoal/40 dark:text-[#9e9b96] cursor-default'
              : 'bg-accent text-on-accent hover:opacity-90 cursor-pointer shadow-sm',
          ].join(' ')}
        >
          {running
            ? progress
              ? `Enriching ${progress.done}/${progress.total}…`
              : 'Enriching…'
            : 'Re-enrich all captures'}
        </button>
      </div>
      {result && (
        <div className="mt-3 font-sans text-[11px] text-sage">
          Re-enriched {result.enriched} capture{result.enriched === 1 ? '' : 's'}
          {result.failed > 0 && (
            <span className="text-terra"> · {result.failed} failed — run again to retry</span>
          )}
        </div>
      )}
      {error && (
        <div className="mt-3 font-sans text-[11px] text-terra">{error}</div>
      )}
    </div>
  )
}

// ─── Cycle card ──────────────────────────────────────────────────────────────
// No standalone cycle surface (per docs/active/cycle-tracker.md) — this card
// and the sidebar indicator are the whole UI. Opt in, log a period, backdate
// one that already happened. Everything else is derived by Postgres.

function CycleOptIn({ userId, onEnabled }: { userId: string; onEnabled: () => void }) {
  const [avgCycleLength, setAvgCycleLength] = useState(28)
  const [avgPeriodLength, setAvgPeriodLength] = useState(5)
  const [saving, setSaving] = useState(false)

  const handleEnable = async () => {
    setSaving(true)
    const supabase = createClient()
    try {
      await enableMenstrualTracking(supabase, userId, avgCycleLength, avgPeriodLength)
      onEnabled()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] px-5 py-4">
      <div className="font-sans text-[13px] font-medium text-charcoal dark:text-[#f0ede8] mb-[3px]">Connect your cycle</div>
      <div className="font-sans text-[11px] text-charcoal/40 dark:text-[#5c5a57] leading-relaxed mb-4">
        Every capture gets stamped with your cycle day — a layer underneath everything you capture, not a
        separate tracker. These are just a starting point; Ki refines them from your real cycles over time.
      </div>
      <div className="flex items-end gap-4 mb-4">
        <label className="flex flex-col gap-1">
          <span className="font-sans text-[10px] text-charcoal/40 dark:text-[#5c5a57] uppercase tracking-[0.06em]">Avg cycle length</span>
          <input
            type="number"
            min={15}
            max={60}
            value={avgCycleLength}
            onChange={e => setAvgCycleLength(Number(e.target.value))}
            className="w-20 bg-charcoal/[0.04] dark:bg-white/[0.04] border border-charcoal/8 dark:border-white/[0.07] rounded-[8px] px-2.5 py-1.5 font-sans text-[12px] text-charcoal dark:text-[#f0ede8] outline-none focus:border-accent/40"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-sans text-[10px] text-charcoal/40 dark:text-[#5c5a57] uppercase tracking-[0.06em]">Avg period length</span>
          <input
            type="number"
            min={1}
            max={14}
            value={avgPeriodLength}
            onChange={e => setAvgPeriodLength(Number(e.target.value))}
            className="w-20 bg-charcoal/[0.04] dark:bg-white/[0.04] border border-charcoal/8 dark:border-white/[0.07] rounded-[8px] px-2.5 py-1.5 font-sans text-[12px] text-charcoal dark:text-[#f0ede8] outline-none focus:border-accent/40"
          />
        </label>
      </div>
      <button
        onClick={handleEnable}
        disabled={saving}
        className="px-4 py-[7px] rounded-[10px] font-sans text-[11.5px] font-medium bg-accent text-on-accent hover:opacity-90 cursor-pointer shadow-sm disabled:opacity-50"
      >
        {saving ? 'Connecting…' : 'Start tracking'}
      </button>
    </div>
  )
}

function formatInstanceDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function PeriodInstanceRow({
  instance,
  onSave,
  onDelete,
}: {
  instance: PeriodInstance
  onSave: (oldRange: PeriodInstance, newRange: { startDate: string; endDate: string }) => Promise<void>
  onDelete: (instance: PeriodInstance) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [start, setStart] = useState(instance.startDate)
  const [end, setEnd] = useState(instance.endDate)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  const handleSave = async () => {
    setBusy(true)
    try {
      await onSave(instance, { startDate: start, endDate: end })
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      return
    }
    setBusy(true)
    try {
      await onDelete(instance)
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <div className="flex items-end gap-2 py-1.5">
        <label className="flex flex-col gap-1">
          <span className="font-sans text-[9px] text-charcoal/35 dark:text-[#5c5a57]">Start</span>
          <input
            type="date"
            value={start}
            onChange={e => setStart(e.target.value)}
            className="bg-charcoal/[0.04] dark:bg-white/[0.04] border border-charcoal/8 dark:border-white/[0.07] rounded-[8px] px-2 py-1 font-sans text-[11px] text-charcoal dark:text-[#f0ede8] outline-none focus:border-accent/40"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-sans text-[9px] text-charcoal/35 dark:text-[#5c5a57]">End</span>
          <input
            type="date"
            value={end}
            onChange={e => setEnd(e.target.value)}
            className="bg-charcoal/[0.04] dark:bg-white/[0.04] border border-charcoal/8 dark:border-white/[0.07] rounded-[8px] px-2 py-1 font-sans text-[11px] text-charcoal dark:text-[#f0ede8] outline-none focus:border-accent/40"
          />
        </label>
        <button
          onClick={handleSave}
          disabled={busy}
          className="px-2.5 py-1 rounded-[7px] font-sans text-[10.5px] font-medium bg-accent text-on-accent hover:opacity-90 cursor-pointer disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={() => setEditing(false)}
          disabled={busy}
          className="px-2.5 py-1 rounded-[7px] font-sans text-[10.5px] text-charcoal/45 dark:text-[#5c5a57] hover:text-charcoal dark:hover:text-[#f0ede8] cursor-pointer"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between py-1.5 group">
      <span className="font-sans text-[12px] text-charcoal/70 dark:text-[#9e9b96]">
        {formatInstanceDate(instance.startDate)} – {formatInstanceDate(instance.endDate)}
        <span className="text-charcoal/35 dark:text-[#5c5a57]"> · {instance.dayCount}d</span>
      </span>
      <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setEditing(true)}
          className="font-sans text-[10.5px] text-charcoal/45 dark:text-[#5c5a57] hover:text-accent cursor-pointer"
        >
          Edit
        </button>
        <button
          onClick={handleDelete}
          disabled={busy}
          className={[
            'font-sans text-[10.5px] cursor-pointer',
            deleteConfirm ? 'text-terra font-medium' : 'text-charcoal/45 dark:text-[#5c5a57] hover:text-terra',
          ].join(' ')}
        >
          {deleteConfirm ? 'Confirm' : 'Delete'}
        </button>
      </div>
    </div>
  )
}

function CycleTracking({ profile }: { profile: Profile }) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [logging, setLogging] = useState(false)

  const cycleInfoKey = ['cycle-info', profile.id]
  const logsKey = ['period-logs', profile.id]
  const instancesKey = ['period-instances', profile.id]

  const { data: cycleInfo } = useQuery({
    queryKey: cycleInfoKey,
    queryFn: () => getCurrentCycleInfo(supabase, profile.id),
  })
  const { data: logs = [] } = useQuery({
    queryKey: logsKey,
    queryFn: () => getPeriodLogs(supabase, profile.id, 10),
  })
  const { data: instances = [] } = useQuery({
    queryKey: instancesKey,
    queryFn: () => getPeriodInstances(supabase, profile.id),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: cycleInfoKey })
    queryClient.invalidateQueries({ queryKey: logsKey })
    queryClient.invalidateQueries({ queryKey: instancesKey })
  }

  const handleUpdateInstance = async (
    oldRange: PeriodInstance,
    newRange: { startDate: string; endDate: string },
  ) => {
    await updatePeriodInstance(supabase, profile.id, oldRange, newRange)
    invalidate()
  }

  const handleDeleteInstance = async (instance: PeriodInstance) => {
    await deletePeriodRange(supabase, profile.id, instance.startDate, instance.endDate)
    invalidate()
  }

  const today = getLocalYYYYMMDD()
  const loggedToday = logs.some(l => l.date === today)

  const handleLogToday = async () => {
    setLogging(true)
    try {
      await logPeriodDay(supabase, profile.id)
      invalidate()
    } finally {
      setLogging(false)
    }
  }

  const handleLogRange = async () => {
    if (!rangeStart || !rangeEnd) return
    setLogging(true)
    try {
      await logPeriodRange(supabase, profile.id, rangeStart, rangeEnd)
      setRangeStart('')
      setRangeEnd('')
      invalidate()
    } finally {
      setLogging(false)
    }
  }

  const phaseInfo = cycleInfo?.cycleDay
    ? resolveCyclePhase(cycleInfo.cycleDay, {
        averageCycleLength: profile.average_cycle_length,
        averagePeriodLength: profile.average_period_length,
      })
    : null

  return (
    <div className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] px-5 py-4">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <div className="font-sans text-[13px] font-medium text-charcoal dark:text-[#f0ede8] mb-[3px]">
            {phaseInfo ? `Day ${cycleInfo!.cycleDay} · ${phaseInfo.label}` : 'No period logged yet'}
          </div>
          <div className="font-sans text-[11px] text-charcoal/40 dark:text-[#5c5a57]">
            Avg cycle {profile.average_cycle_length ?? '—'} days · Avg period {profile.average_period_length ?? '—'} days
          </div>
        </div>
        <button
          onClick={handleLogToday}
          disabled={logging || loggedToday}
          className={[
            'shrink-0 px-4 py-[7px] rounded-[10px] font-sans text-[11.5px] font-medium transition-all',
            loggedToday
              ? 'bg-sage/10 text-sage cursor-default'
              : 'bg-accent text-on-accent hover:opacity-90 cursor-pointer shadow-sm disabled:opacity-50',
          ].join(' ')}
        >
          {loggedToday ? 'Logged today ✓' : logging ? 'Logging…' : 'Log period today'}
        </button>
      </div>

      <div className="border-t border-charcoal/8 dark:border-white/[0.07] pt-4">
        <div className="font-sans text-[10px] text-charcoal/40 dark:text-[#5c5a57] uppercase tracking-[0.06em] mb-2">
          Log a past period
        </div>
        <div className="flex items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-sans text-[10px] text-charcoal/35 dark:text-[#5c5a57]">Start</span>
            <input
              type="date"
              value={rangeStart}
              onChange={e => setRangeStart(e.target.value)}
              className="bg-charcoal/[0.04] dark:bg-white/[0.04] border border-charcoal/8 dark:border-white/[0.07] rounded-[8px] px-2.5 py-1.5 font-sans text-[12px] text-charcoal dark:text-[#f0ede8] outline-none focus:border-accent/40"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-sans text-[10px] text-charcoal/35 dark:text-[#5c5a57]">End</span>
            <input
              type="date"
              value={rangeEnd}
              onChange={e => setRangeEnd(e.target.value)}
              className="bg-charcoal/[0.04] dark:bg-white/[0.04] border border-charcoal/8 dark:border-white/[0.07] rounded-[8px] px-2.5 py-1.5 font-sans text-[12px] text-charcoal dark:text-[#f0ede8] outline-none focus:border-accent/40"
            />
          </label>
          <button
            onClick={handleLogRange}
            disabled={logging || !rangeStart || !rangeEnd}
            className="px-3.5 py-[7px] rounded-[10px] font-sans text-[11.5px] font-medium bg-charcoal/[0.06] dark:bg-white/[0.08] text-charcoal dark:text-[#f0ede8] hover:bg-charcoal/10 dark:hover:bg-white/[0.12] cursor-pointer disabled:opacity-40"
          >
            Log
          </button>
        </div>
      </div>

      {instances.length > 0 && (
        <div className="mt-4 pt-4 border-t border-charcoal/8 dark:border-white/[0.07]">
          <div className="font-sans text-[10px] text-charcoal/40 dark:text-[#5c5a57] uppercase tracking-[0.06em] mb-1">
            Period logs
          </div>
          <div className="flex flex-col divide-y divide-charcoal/[0.05] dark:divide-white/[0.04]">
            {instances.map(instance => (
              <PeriodInstanceRow
                key={instance.startDate}
                instance={instance}
                onSave={handleUpdateInstance}
                onDelete={handleDeleteInstance}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CycleCard({ profile }: { profile: Profile }) {
  const router = useRouter()
  const [justEnabled, setJustEnabled] = useState(false)

  if (profile.cycle_type !== 'menstrual' && !justEnabled) {
    return (
      <CycleOptIn
        userId={profile.id}
        onEnabled={() => {
          setJustEnabled(true)
          router.refresh()
        }}
      />
    )
  }

  return <CycleTracking profile={profile} />
}

function SettingsTab({
  mounted,
  accentColor,
  onAccentChange,
  profile,
}: {
  mounted: boolean
  accentColor: string
  onAccentChange: (color: string) => void
  profile: Profile | null
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
                        ? 'bg-accent text-on-accent shadow-sm'
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
              Sets the accent for buttons, active states, and highlights. Brand colors like terra stay fixed.
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

      {/* Cycle */}
      {profile && (
        <div className="mb-[30px]">
          <div className="font-sans text-[11px] font-medium text-charcoal/55 dark:text-[#9e9b96] uppercase tracking-[0.08em] mb-4">
            Cycle
          </div>
          <CycleCard profile={profile} />
        </div>
      )}

      {/* Corpus */}
      <div>
        <div className="font-sans text-[11px] font-medium text-charcoal/55 dark:text-[#9e9b96] uppercase tracking-[0.08em] mb-4">
          Corpus
        </div>
        <ReEnrichCard />
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
    applyAccentColor(color)
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
        <div className="h-[68px] box-border px-5 border-b border-charcoal/10 dark:border-white/[0.07] shrink-0 flex items-center">
          <div className="font-sans text-[9px] font-semibold text-charcoal/30 dark:text-[#5c5a57] uppercase tracking-[0.1em] leading-none">
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
                  ? 'text-charcoal dark:text-[#f0ede8] bg-accent/10 border-accent font-medium'
                  : 'text-charcoal/50 dark:text-[#9e9b96] border-transparent hover:text-charcoal dark:hover:text-[#f0ede8] hover:bg-charcoal/[0.03] dark:hover:bg-white/[0.03]',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="h-[64px] box-border px-[14px] border-t border-charcoal/8 dark:border-white/[0.07] shrink-0 flex items-center">
          <button
            onClick={handleSignOut}
            className="w-full text-left px-1.5 py-[6px] font-sans text-[11px] text-charcoal/35 dark:text-[#5c5a57] hover:text-accent transition-colors rounded-[10px] hover:bg-charcoal/[0.03] dark:hover:bg-white/[0.03]"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={tab === 'profile' ? 'flex-1 min-h-0 overflow-hidden' : 'flex-1 overflow-y-auto'}>
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
            profile={profile}
          />
        )}
        {tab === 'integrations' && <IntegrationsTab />}
      </div>

    </div>
  )
}
