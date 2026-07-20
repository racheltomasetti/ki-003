'use client'

import { useState, useRef, useEffect, useMemo, Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getCaptures } from '@ki/services'
import type { CaptureWithEnrichment } from '@ki/types'
import { MdKeyboardVoice, MdOutlineSearch } from 'react-icons/md'
import { FaPencil } from 'react-icons/fa6'
import { IoAttach } from 'react-icons/io5'

// ─── Types ────────────────────────────────────────────────────────────────────

type CaptureRow = Omit<CaptureWithEnrichment, 'capture_pursuits'> & {
  capture_pursuits: { pursuit_id: string }[]
}

type SortCol = 'captured_at' | 'source_type' | 'is_starred' | 'sentiment' | 'energy_level' | 'capture_intent'
type SortDir = 'asc' | 'desc'

interface Citation {
  id: string
  title: string | null
  captured_at: string
  similarity?: number
}

interface Message {
  role: 'ki' | 'hero'
  content: string
  citations?: Citation[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PROMPT_CHIPS = [
  'what am I most focused on?',
  'what patterns do you see?',
  'what am I avoiding?',
]

const SOURCE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  voice: MdKeyboardVoice,
  text: FaPencil,
  file: IoAttach,
  file_attached: IoAttach,
  manual: FaPencil,
  distilled: FaPencil,
}

const SENTIMENT_ORDER: Record<string, number> = { positive: 0, neutral: 1, mixed: 2, negative: 3 }
const ENERGY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

const SENTIMENT_STYLES: Record<string, string> = {
  positive: 'bg-sage/10 text-sage border-sage/20',
  negative: 'bg-terra/10 text-terra border-terra/20',
  mixed: 'bg-ray/10 text-[#b8923a] border-ray/20',
  neutral: 'bg-charcoal/[0.04] dark:bg-white/[0.04] text-charcoal/40 dark:text-[#9e9b96] border-charcoal/8 dark:border-white/[0.06]',
}

const ENERGY_STYLES: Record<string, string> = {
  high: 'bg-terra/8 text-terra border-terra/15',
  medium: 'bg-pacific/10 text-pacific border-pacific/20',
  low: 'bg-charcoal/[0.04] dark:bg-white/[0.04] text-charcoal/35 dark:text-[#5c5a57] border-charcoal/8 dark:border-white/[0.06]',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function compareRows(a: CaptureRow, b: CaptureRow, col: SortCol, dir: SortDir): number {
  let result = 0
  switch (col) {
    case 'captured_at':
      result = new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime()
      break
    case 'source_type':
      result = (a.source_type ?? '').localeCompare(b.source_type ?? '')
      break
    case 'is_starred':
      result = (b.is_starred ? 1 : 0) - (a.is_starred ? 1 : 0)
      break
    case 'sentiment':
      result = (SENTIMENT_ORDER[a.enrichments?.sentiment ?? ''] ?? 99) -
               (SENTIMENT_ORDER[b.enrichments?.sentiment ?? ''] ?? 99)
      break
    case 'energy_level':
      result = (ENERGY_ORDER[a.enrichments?.energy_level ?? ''] ?? 99) -
               (ENERGY_ORDER[b.enrichments?.energy_level ?? ''] ?? 99)
      break
    case 'capture_intent':
      result = (a.enrichments?.capture_intent ?? '').localeCompare(b.enrichments?.capture_intent ?? '')
      break
  }
  return dir === 'asc' ? result : -result
}

// ─── Small components ─────────────────────────────────────────────────────────

function SentimentBadge({ value }: { value: string | null | undefined }) {
  if (!value) return null
  return (
    <span className={`inline-block font-sans text-[9px] px-[6px] py-[2px] rounded-full border capitalize whitespace-nowrap ${SENTIMENT_STYLES[value] ?? SENTIMENT_STYLES.neutral}`}>
      {value}
    </span>
  )
}

function EnergyBadge({ value }: { value: string | null | undefined }) {
  if (!value) return null
  return (
    <span className={`inline-block font-sans text-[9px] px-[6px] py-[2px] rounded-full border capitalize whitespace-nowrap ${ENERGY_STYLES[value] ?? ENERGY_STYLES.low}`}>
      {value}
    </span>
  )
}

// ─── Capture detail modal ─────────────────────────────────────────────────────

function CaptureModal({
  capture,
  onClose,
}: {
  capture: CaptureRow
  onClose: () => void
}) {
  const e = capture.enrichments

  useEffect(() => {
    const handler = (ev: KeyboardEvent) => { if (ev.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-charcoal/30 dark:bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-cream dark:bg-[#1a1917] border border-charcoal/10 dark:border-white/[0.08] rounded-[18px] shadow-2xl w-full max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col"
        onClick={ev => ev.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-charcoal/8 dark:border-white/[0.07] shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-serif text-[18px] font-light text-charcoal dark:text-[#f0ede8] leading-snug">
                {capture.title ?? capture.body?.slice(0, 80) ?? 'Untitled'}
              </h2>
              <p className="font-sans text-[10px] text-charcoal/35 dark:text-[#5c5a57] mt-1 tracking-[0.12em] uppercase">
                {formatDate(capture.captured_at)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center shrink-0 text-charcoal/30 dark:text-[#5c5a57] hover:text-charcoal dark:hover:text-[#f0ede8] transition-colors rounded-[8px] hover:bg-charcoal/5 dark:hover:bg-white/5 font-sans text-[18px] leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {capture.body && (
            <div className="font-serif text-[13px] font-light text-charcoal/65 dark:text-[#9e9b96] leading-[1.85] whitespace-pre-wrap">
              {capture.body}
            </div>
          )}

          {e?.enrichment_status === 'complete' && (
            <div className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[12px] overflow-hidden">

              {e.summary && (
                <div className="px-4 py-3 border-b border-charcoal/8 dark:border-white/[0.07]">
                  <div className="text-[9px] font-semibold text-charcoal/30 dark:text-[#5c5a57] uppercase tracking-[0.12em] mb-[6px]">Summary</div>
                  <p className="font-serif text-[12px] font-light italic text-charcoal/55 dark:text-[#9e9b96] leading-relaxed">{e.summary}</p>
                </div>
              )}

              {(e.sentiment || e.energy_level || e.capture_intent || e.time_of_day_cat) && (
                <div className="px-4 py-3 border-b border-charcoal/8 dark:border-white/[0.07] flex flex-wrap gap-4">
                  {e.sentiment && (
                    <div>
                      <div className="text-[9px] font-semibold text-charcoal/30 dark:text-[#5c5a57] uppercase tracking-[0.12em] mb-[5px]">Sentiment</div>
                      <SentimentBadge value={e.sentiment} />
                    </div>
                  )}
                  {e.energy_level && (
                    <div>
                      <div className="text-[9px] font-semibold text-charcoal/30 dark:text-[#5c5a57] uppercase tracking-[0.12em] mb-[5px]">Energy</div>
                      <EnergyBadge value={e.energy_level} />
                    </div>
                  )}
                  {e.capture_intent && (
                    <div>
                      <div className="text-[9px] font-semibold text-charcoal/30 dark:text-[#5c5a57] uppercase tracking-[0.12em] mb-[5px]">Intent</div>
                      <span className="font-sans text-[10px] text-charcoal/45 dark:text-[#9e9b96] capitalize">{e.capture_intent}</span>
                    </div>
                  )}
                  {e.time_of_day_cat && (
                    <div>
                      <div className="text-[9px] font-semibold text-charcoal/30 dark:text-[#5c5a57] uppercase tracking-[0.12em] mb-[5px]">Time</div>
                      <span className="font-sans text-[10px] text-charcoal/45 dark:text-[#9e9b96] capitalize">{e.time_of_day_cat}</span>
                    </div>
                  )}
                </div>
              )}

              {e.themes && e.themes.length > 0 && (
                <div className="px-4 py-3 border-b border-charcoal/8 dark:border-white/[0.07]">
                  <div className="text-[9px] font-semibold text-charcoal/30 dark:text-[#5c5a57] uppercase tracking-[0.12em] mb-[6px]">Themes</div>
                  <div className="flex flex-wrap gap-[5px]">
                    {e.themes.map(t => (
                      <span key={t} className="font-sans text-[10px] px-2 py-[3px] rounded-full bg-pacific/10 text-pacific border border-pacific/20">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {e.questions_raised && e.questions_raised.length > 0 && (
                <div className="px-4 py-3">
                  <div className="text-[9px] font-semibold text-charcoal/30 dark:text-[#5c5a57] uppercase tracking-[0.12em] mb-[6px]">Questions raised</div>
                  <ul className="space-y-[4px]">
                    {e.questions_raised.map((q, i) => (
                      <li key={i} className="font-serif text-[11px] font-light italic text-charcoal/50 dark:text-[#5c5a57] leading-relaxed">{q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {e?.enrichment_status === 'pending' && (
            <p className="font-serif text-[12px] font-light italic text-charcoal/30 dark:text-[#5c5a57]">Enriching this capture…</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const supabase = createClient()

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: captures, isLoading } = useQuery({
    queryKey: ['explore-captures'],
    queryFn: async () => {
      const { data, error } = await getCaptures(supabase, { limit: 200 })
      if (error) throw error
      return (data ?? []) as CaptureRow[]
    },
  })

  // ── Table state ────────────────────────────────────────────────────────────
  const [sortCol, setSortCol] = useState<SortCol>('captured_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<string | null>(null)
  const [sentimentFilter, setSentimentFilter] = useState<string | null>(null)
  const [energyFilter, setEnergyFilter] = useState<string | null>(null)
  const [starredOnly, setStarredOnly] = useState(false)
  const [selectedCapture, setSelectedCapture] = useState<CaptureRow | null>(null)
  const [highlightedIds, setHighlightedIds] = useState<Set<string> | null>(null)

  // ── Chat state ─────────────────────────────────────────────────────────────
  const [chatOpen, setChatOpen] = useState(true)
  const [messages, setMessages] = useState<Message[]>([{
    role: 'ki',
    content: 'Your full corpus is loaded. Ask me anything about what you have been thinking, what patterns I notice, or what you seem most uncertain about.',
  }])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [apiHistory, setApiHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Sort ───────────────────────────────────────────────────────────────────
  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir(col === 'captured_at' ? 'desc' : 'asc')
    }
  }

  // ── Filtered + sorted rows ─────────────────────────────────────────────────
  const displayCaptures = useMemo(() => {
    let rows = captures ?? []

    if (highlightedIds) {
      rows = rows.filter(c => highlightedIds.has(c.id))
    } else {
      if (search) {
        const q = search.toLowerCase()
        rows = rows.filter(c =>
          (c.title ?? '').toLowerCase().includes(q) ||
          (c.body ?? '').toLowerCase().includes(q) ||
          (c.enrichments?.summary ?? '').toLowerCase().includes(q) ||
          (c.enrichments?.themes ?? []).some(t => t.toLowerCase().includes(q))
        )
      }
      if (sourceFilter) rows = rows.filter(c => c.source_type === sourceFilter)
      if (sentimentFilter) rows = rows.filter(c => c.enrichments?.sentiment === sentimentFilter)
      if (energyFilter) rows = rows.filter(c => c.enrichments?.energy_level === energyFilter)
      if (starredOnly) rows = rows.filter(c => c.is_starred)
    }

    return [...rows].sort((a, b) => compareRows(a, b, sortCol, sortDir))
  }, [captures, highlightedIds, search, sourceFilter, sentimentFilter, energyFilter, starredOnly, sortCol, sortDir])

  // ── Chat send ──────────────────────────────────────────────────────────────
  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    setMessages(prev => [...prev, { role: 'hero', content: trimmed }])
    setInput('')
    setSending(true)
    setHighlightedIds(null)

    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    try {
      const { data, error } = await supabase.functions.invoke('chat-with-ki', {
        body: { message: trimmed, history: apiHistory },
      })
      if (error) throw error

      const responseText: string = data.response ?? 'Something went wrong.'
      const citations: Citation[] = data.citations ?? []

      setMessages(prev => [...prev, { role: 'ki', content: responseText, citations }])
      setApiHistory(prev => [
        ...prev,
        { role: 'user', content: trimmed },
        { role: 'assistant', content: responseText },
      ])

      if (citations.length > 0) {
        setHighlightedIds(new Set(citations.map(c => c.id)))
      }
    } catch {
      setMessages(prev => [...prev, { role: 'ki', content: 'Something went wrong. Please try again.' }])
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 70)}px`
  }

  // ── Sort header helper ─────────────────────────────────────────────────────
  const colHeader = (col: SortCol, label: string) => (
    <button
      onClick={() => handleSort(col)}
      className="flex items-center gap-1 font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-charcoal/35 dark:text-[#5c5a57] hover:text-charcoal/60 dark:hover:text-[#9e9b96] transition-colors whitespace-nowrap"
    >
      {label}
      <span className={sortCol === col ? 'text-terra' : 'text-charcoal/20 dark:text-white/[0.15]'}>
        {sortCol === col ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
      </span>
    </button>
  )

  const totalCount = captures?.length ?? 0

  // ── Filter pill helper ─────────────────────────────────────────────────────
  const filterPill = (
    label: string,
    active: boolean,
    onClick: () => void,
    activeClass = 'border-terra text-terra bg-terra/10',
  ) => (
    <button
      onClick={onClick}
      className={[
        'font-sans text-[10px] px-[8px] py-[3px] rounded-full border transition-all capitalize whitespace-nowrap',
        active
          ? activeClass
          : 'border-charcoal/8 dark:border-white/[0.07] text-charcoal/35 dark:text-[#5c5a57] hover:border-charcoal/15 dark:hover:border-white/[0.12] hover:text-charcoal/55 dark:hover:text-[#9e9b96]',
      ].join(' ')}
    >
      {label}
    </button>
  )

  return (
    <div className="flex h-full overflow-hidden bg-cream dark:bg-[#0f0e0e]">

      {/* ── TABLE AREA ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-5 pb-3 border-b border-charcoal/8 dark:border-white/[0.07] shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-[18px] font-light text-charcoal dark:text-[#f0ede8]">Your corpus</span>
              {totalCount > 0 && (
                <span className="font-sans text-[11px] text-charcoal/30 dark:text-[#5c5a57]">{totalCount} captures</span>
              )}
            </div>
            <button
              onClick={() => setChatOpen(v => !v)}
              className={[
                'font-sans text-[11px] px-3 py-[5px] rounded-[8px] border transition-all',
                chatOpen
                  ? 'border-charcoal/10 dark:border-white/[0.07] text-charcoal/35 dark:text-[#5c5a57] hover:text-charcoal/55 dark:hover:text-[#9e9b96]'
                  : 'border-pacific/30 text-pacific bg-pacific/8 hover:bg-pacific/12',
              ].join(' ')}
            >
              {chatOpen ? 'hide chat' : 'chat with Ki'}
            </button>
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap gap-[6px] items-center">
            <div className="flex items-center gap-2 bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[8px] px-2 py-[4px] focus-within:border-charcoal/15 dark:focus-within:border-white/[0.13] transition-colors shrink-0">
              <MdOutlineSearch className="text-charcoal/25 dark:text-[#5c5a57] text-[14px] shrink-0" />
              <input
                className="bg-transparent border-none outline-none font-sans text-[11px] text-charcoal dark:text-[#f0ede8] placeholder:text-charcoal/25 dark:placeholder:text-[#5c5a57] w-[130px]"
                placeholder="Search corpus…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="h-4 w-px bg-charcoal/8 dark:bg-white/[0.06] shrink-0" />

            {(['voice', 'text', 'file', 'manual'] as const).map(s => (
              <Fragment key={s}>
                {filterPill(s, sourceFilter === s, () => setSourceFilter(sourceFilter === s ? null : s))}
              </Fragment>
            ))}

            <div className="h-4 w-px bg-charcoal/8 dark:bg-white/[0.06] shrink-0" />

            {(['positive', 'neutral', 'mixed', 'negative'] as const).map(s => (
              <Fragment key={s}>
                {filterPill(
                  s,
                  sentimentFilter === s,
                  () => setSentimentFilter(sentimentFilter === s ? null : s),
                  SENTIMENT_STYLES[s],
                )}
              </Fragment>
            ))}

            <div className="h-4 w-px bg-charcoal/8 dark:bg-white/[0.06] shrink-0" />

            {(['high', 'medium', 'low'] as const).map(e => (
              <Fragment key={e}>
                {filterPill(
                  e,
                  energyFilter === e,
                  () => setEnergyFilter(energyFilter === e ? null : e),
                  ENERGY_STYLES[e],
                )}
              </Fragment>
            ))}

            <div className="h-4 w-px bg-charcoal/8 dark:bg-white/[0.06] shrink-0" />

            {filterPill(
              '★ starred',
              starredOnly,
              () => setStarredOnly(v => !v),
              'border-ray text-[#b8923a] bg-ray/10',
            )}
          </div>
        </div>

        {/* Citation highlight banner */}
        {highlightedIds && (
          <div className="px-6 py-[7px] bg-pacific/8 border-b border-pacific/15 dark:border-pacific/20 shrink-0 flex items-center justify-between">
            <span className="font-sans text-[11px] text-pacific">
              Showing {highlightedIds.size} capture{highlightedIds.size !== 1 ? 's' : ''} referenced by Ki
            </span>
            <button
              onClick={() => setHighlightedIds(null)}
              className="font-sans text-[10px] text-pacific/60 hover:text-pacific transition-colors"
            >
              ← show all
            </button>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <p className="font-serif text-[12px] italic text-charcoal/30 dark:text-[#5c5a57] text-center py-16">
              Loading your corpus…
            </p>
          ) : displayCaptures.length === 0 ? (
            <p className="font-serif text-[12px] italic text-charcoal/25 dark:text-[#5c5a57] text-center py-16">
              {highlightedIds ? 'No matching captures found.' : 'No captures yet.'}
            </p>
          ) : (
            <table className="w-full border-collapse min-w-[720px]">
              <thead>
                <tr className="border-b border-charcoal/8 dark:border-white/[0.07]">
                  <th className="sticky top-0 bg-cream dark:bg-[#0f0e0e] z-10 text-left px-6 py-[10px] w-[120px] border-b border-charcoal/8 dark:border-white/[0.07]">
                    {colHeader('captured_at', 'Date')}
                  </th>
                  <th className="sticky top-0 bg-cream dark:bg-[#0f0e0e] z-10 text-left px-3 py-[10px] border-b border-charcoal/8 dark:border-white/[0.07]">
                    <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-charcoal/35 dark:text-[#5c5a57]">Capture</span>
                  </th>
                  <th className="sticky top-0 bg-cream dark:bg-[#0f0e0e] z-10 text-left px-3 py-[10px] w-[46px] border-b border-charcoal/8 dark:border-white/[0.07]">
                    {colHeader('source_type', 'Src')}
                  </th>
                  <th className="sticky top-0 bg-cream dark:bg-[#0f0e0e] z-10 text-left px-3 py-[10px] w-[32px] border-b border-charcoal/8 dark:border-white/[0.07]">
                    {colHeader('is_starred', '★')}
                  </th>
                  <th className="sticky top-0 bg-cream dark:bg-[#0f0e0e] z-10 text-left px-3 py-[10px] w-[92px] border-b border-charcoal/8 dark:border-white/[0.07]">
                    {colHeader('sentiment', 'Sentiment')}
                  </th>
                  <th className="sticky top-0 bg-cream dark:bg-[#0f0e0e] z-10 text-left px-3 py-[10px] w-[78px] border-b border-charcoal/8 dark:border-white/[0.07]">
                    {colHeader('energy_level', 'Energy')}
                  </th>
                  <th className="sticky top-0 bg-cream dark:bg-[#0f0e0e] z-10 text-left px-3 py-[10px] w-[100px] border-b border-charcoal/8 dark:border-white/[0.07]">
                    {colHeader('capture_intent', 'Intent')}
                  </th>
                  <th className="sticky top-0 bg-cream dark:bg-[#0f0e0e] z-10 text-left px-3 py-[10px] pr-6 w-[160px] border-b border-charcoal/8 dark:border-white/[0.07]">
                    <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-charcoal/35 dark:text-[#5c5a57]">Themes</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayCaptures.map(c => {
                  const e = c.enrichments
                  const title = c.title ?? c.body?.slice(0, 80) ?? 'Untitled'
                  const SrcIcon = SOURCE_ICONS[c.source_type] ?? FaPencil
                  const themes = e?.themes?.slice(0, 3) ?? []

                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCapture(c)}
                      className="border-b border-charcoal/[0.05] dark:border-white/[0.04] hover:bg-charcoal/[0.025] dark:hover:bg-white/[0.025] cursor-pointer transition-colors group"
                    >
                      <td className="px-6 py-[10px] whitespace-nowrap align-top pt-[12px]">
                        <span className="font-sans text-[10px] text-charcoal/35 dark:text-[#5c5a57]">
                          {formatDate(c.captured_at)}
                        </span>
                      </td>
                      <td className="px-3 py-[10px] min-w-0 max-w-0">
                        <div className="min-w-0">
                          <p className="font-sans text-[12px] text-charcoal dark:text-[#f0ede8] truncate group-hover:text-terra transition-colors">
                            {title}
                          </p>
                          {e?.summary && (
                            <p className="font-serif text-[10px] font-light italic text-charcoal/35 dark:text-[#5c5a57] truncate mt-[2px]">
                              {e.summary}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-[10px] align-top pt-[13px]">
                        <SrcIcon className="text-[13px] text-charcoal/20 dark:text-[#5c5a57]" />
                      </td>
                      <td className="px-3 py-[10px] align-top pt-[13px]">
                        {c.is_starred && <span className="text-ray text-[12px]">★</span>}
                      </td>
                      <td className="px-3 py-[10px] align-top pt-[12px]">
                        <SentimentBadge value={e?.sentiment} />
                      </td>
                      <td className="px-3 py-[10px] align-top pt-[12px]">
                        <EnergyBadge value={e?.energy_level} />
                      </td>
                      <td className="px-3 py-[10px] align-top pt-[12px]">
                        {e?.capture_intent && (
                          <span className="font-sans text-[10px] text-charcoal/40 dark:text-[#9e9b96] capitalize">
                            {e.capture_intent}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-[10px] pr-6 align-top pt-[11px]">
                        <div className="flex flex-wrap gap-[3px]">
                          {themes.map(t => (
                            <span
                              key={t}
                              className="font-sans text-[9px] px-[5px] py-[1px] rounded-full bg-pacific/8 text-pacific border border-pacific/15"
                            >
                              {t}
                            </span>
                          ))}
                          {(e?.themes?.length ?? 0) > 3 && (
                            <span className="font-sans text-[9px] text-charcoal/25 dark:text-[#5c5a57]">
                              +{(e?.themes?.length ?? 0) - 3}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── CHAT PANEL ──────────────────────────────────────────────────────── */}
      {chatOpen && (
        <div className="w-[360px] shrink-0 border-l border-charcoal/8 dark:border-white/[0.07] bg-charcoal/[0.02] dark:bg-[#161514] flex flex-col">

          {/* Header */}
          <div className="px-4 py-[13px] border-b border-charcoal/8 dark:border-white/[0.07] flex items-center justify-between shrink-0">
            <div>
              <div className="font-sans text-[13px] font-medium text-charcoal dark:text-[#f0ede8]">Chat with Ki</div>
              <div className="font-sans text-[11px] text-charcoal/40 dark:text-[#5c5a57] mt-[1px]">full corpus in context</div>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className="w-6 h-6 flex items-center justify-center text-charcoal/30 dark:text-[#5c5a57] hover:text-charcoal dark:hover:text-[#f0ede8] transition-colors rounded-[6px] hover:bg-charcoal/5 dark:hover:bg-white/5 font-sans text-[18px] leading-none"
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-[9px]">
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'ki' ? 'self-start max-w-full' : 'self-end max-w-[85%]'}>
                {m.role === 'ki' ? (
                  <>
                    <div className="bg-charcoal/[0.04] dark:bg-[#1d1b1a] border border-charcoal/8 dark:border-white/[0.07] rounded-[12px] rounded-tl-[2px] px-3 py-[9px] text-[12px] text-charcoal dark:text-[#f0ede8] leading-relaxed whitespace-pre-wrap">
                      {m.content}
                    </div>
                    {m.citations && m.citations.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-[5px] px-[2px]">
                        {m.citations.map(c => (
                          <button
                            key={c.id}
                            onClick={() => {
                              const cap = (captures ?? []).find(r => r.id === c.id)
                              if (cap) setSelectedCapture(cap)
                            }}
                            className="inline-flex items-center gap-1 text-[10px] px-2 py-[2px] rounded-full border border-charcoal/10 dark:border-white/[0.08] text-charcoal/45 dark:text-[#5c5a57] bg-charcoal/[0.02] dark:bg-white/[0.03] hover:border-pacific/30 hover:text-pacific transition-colors cursor-pointer"
                          >
                            <span className="w-[4px] h-[4px] rounded-full bg-pacific shrink-0" />
                            {c.title ?? new Date(c.captured_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="text-[10px] text-charcoal/35 dark:text-[#5c5a57] mt-[3px] px-[3px]">Ki</div>
                  </>
                ) : (
                  <div className="bg-terra/10 border border-terra/20 rounded-[12px] rounded-tr-[2px] px-3 py-[9px] text-[12px] text-charcoal dark:text-[#f0ede8] leading-relaxed whitespace-pre-wrap">
                    {m.content}
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div className="self-start">
                <div className="bg-charcoal/[0.04] dark:bg-[#1d1b1a] border border-charcoal/8 dark:border-white/[0.07] rounded-[12px] rounded-tl-[2px] px-3 py-[9px]">
                  <div className="flex gap-1 items-center">
                    <span className="w-[5px] h-[5px] rounded-full bg-charcoal/30 dark:bg-[#5c5a57] animate-bounce [animation-delay:0ms]" />
                    <span className="w-[5px] h-[5px] rounded-full bg-charcoal/30 dark:bg-[#5c5a57] animate-bounce [animation-delay:150ms]" />
                    <span className="w-[5px] h-[5px] rounded-full bg-charcoal/30 dark:bg-[#5c5a57] animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-[10px] border-t border-charcoal/8 dark:border-white/[0.07] shrink-0">
            <div className="flex gap-[5px] flex-wrap mb-[7px]">
              {PROMPT_CHIPS.map(chip => (
                <button
                  key={chip}
                  onClick={() => send(chip)}
                  disabled={sending}
                  className="font-sans text-[10px] px-[9px] py-[3px] border border-charcoal/8 dark:border-white/[0.07] rounded-full text-charcoal/40 dark:text-[#5c5a57] bg-transparent cursor-pointer hover:border-terra hover:text-terra hover:bg-terra/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {chip}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-[7px] bg-charcoal/[0.04] dark:bg-[#1d1b1a] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] px-[9px] py-[7px] focus-within:border-charcoal/15 dark:focus-within:border-white/[0.13] transition-colors">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={autoResize}
                onKeyDown={handleKeyDown}
                disabled={sending}
                className="flex-1 bg-transparent border-none outline-none font-sans text-[12px] text-charcoal dark:text-[#f0ede8] resize-none min-h-5 max-h-[70px] leading-[1.5] placeholder:text-charcoal/30 dark:placeholder:text-[#5c5a57] placeholder:italic disabled:opacity-50"
                placeholder="Ask Ki anything across all captures…"
                rows={1}
              />
              <button
                onClick={() => send(input)}
                disabled={sending || !input.trim()}
                className="w-[26px] h-[26px] rounded-[7px] bg-terra border-none text-white font-sans text-[12px] cursor-pointer flex items-center justify-center shrink-0 hover:bg-[#b83333] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ↑
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CAPTURE DETAIL MODAL ──────────────────────────────────────────── */}
      {selectedCapture && (
        <CaptureModal
          capture={selectedCapture}
          onClose={() => setSelectedCapture(null)}
        />
      )}
    </div>
  )
}
