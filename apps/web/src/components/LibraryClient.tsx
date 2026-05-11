'use client'

import { useState, useEffect, useCallback, useMemo, useRef, type ComponentType } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  getCaptures,
  starCapture,
  updateCaptureTitle,
  addCaptureToPursuit,
  removeCaptureFromPursuit,
  addTagToCapture,
  removeTagFromCapture,
  createTag,
} from '@ki/services'
import { MdKeyboardVoice, MdOutlineSearch } from 'react-icons/md'
import { FaPencil } from 'react-icons/fa6'
import { IoAttach } from 'react-icons/io5'
import type { Pursuit, Tag, CaptureWithEnrichment } from '@ki/types'

// ─── Local type ───────────────────────────────────────────────────────────────
// getCaptures joins capture_pursuits (pursuit_id only)
type CaptureRow = Omit<CaptureWithEnrichment, 'capture_pursuits'> & {
  capture_pursuits: { pursuit_id: string }[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  voice: MdKeyboardVoice,
  text: FaPencil,
  file: IoAttach,
  file_attached: IoAttach,
  manual: FaPencil,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3_600_000)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** e.g. SAT MAY 02, 2026 — wide caps Poppins, zero-padded day */
function formatLibraryDateLine(dateStr: string): string {
  const date = new Date(dateStr)
  const dow = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  const mon = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const day = String(date.getDate()).padStart(2, '0')
  const year = date.getFullYear()
  return `${dow} ${mon} ${day}, ${year}`
}

function formatLibraryTimeLine(dateStr: string): string {
  return new Date(dateStr)
    .toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .toUpperCase()
}

// ─── CaptureListItem ──────────────────────────────────────────────────────────

function CaptureListItem({
  capture,
  selected,
  starred,
  onSelect,
}: {
  capture: CaptureRow
  selected: boolean
  starred: boolean
  onSelect: () => void
}) {
  const title = capture.title ?? capture.body?.slice(0, 72) ?? 'Untitled'
  const Icon = SOURCE_ICONS[capture.source_type] ?? SOURCE_ICONS[capture.type] ?? FaPencil
  const isDistilled = capture.source_type === 'distilled'
  const summary = capture.enrichments?.summary

  return (
    <button
      onClick={onSelect}
      className={[
        'w-full text-left px-4 py-[12px] border-b border-charcoal/[0.06] dark:border-white/[0.05] transition-colors last:border-b-0',
        selected
          ? 'bg-terra/[0.07] dark:bg-terra/[0.10]'
          : 'hover:bg-charcoal/[0.03] dark:hover:bg-white/[0.03]',
      ].join(' ')}
    >
      <div className="flex gap-3">
        <div className="w-7 h-7 rounded-[8px] flex items-center justify-center text-[13px] shrink-0 bg-charcoal/5 dark:bg-white/5 mt-[1px]">
          {isDistilled ? '◈' : <Icon className="text-[14px]" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className={[
              'text-[13px] leading-snug font-medium truncate',
              selected ? 'text-terra' : 'text-charcoal dark:text-[#f0ede8]',
            ].join(' ')}>
              {title}
            </span>
            {starred && <span className="text-ray text-[12px] shrink-0 mt-[1px]">★</span>}
          </div>
          {summary && (
            <p className="font-serif text-[11px] font-light italic text-charcoal/40 dark:text-[#5c5a57] mt-[2px] line-clamp-1">
              {summary}
            </p>
          )}
          <p className="text-[10px] text-charcoal/30 dark:text-[#5c5a57] mt-[3px]">
            {relativeTime(capture.captured_at)}
          </p>
        </div>
      </div>
    </button>
  )
}

// ─── CaptureDetailPanel ───────────────────────────────────────────────────────

function CaptureDetailPanel({
  capture,
  pursuits,
  allTags,
  userId,
  starred,
  onStar,
  onTagCreated,
}: {
  capture: CaptureRow
  pursuits: Pursuit[]
  allTags: Tag[]
  userId: string
  starred: boolean
  onStar: () => void
  onTagCreated: (tag: Tag) => void
}) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Title editing
  const [titleDraft, setTitleDraft] = useState(capture.title ?? '')
  const [titleSaving, setTitleSaving] = useState(false)
  const [titleSaved, setTitleSaved] = useState(false)

  // Sync title when capture changes (different capture selected)
  useEffect(() => {
    setTitleDraft(capture.title ?? '')
  }, [capture.id, capture.title])

  // Tag input
  const [tagInputOpen, setTagInputOpen] = useState(false)
  const [tagQuery, setTagQuery] = useState('')
  const tagInputRef = useRef<HTMLInputElement>(null)

  // Pursuit add dropdown
  const [pursuitDropdownOpen, setPursuitDropdownOpen] = useState(false)

  const capturePursuitIds = new Set((capture.capture_pursuits ?? []).map(cp => cp.pursuit_id))
  const captureTags = capture.capture_tags ?? []
  const captureTagIds = new Set(captureTags.map(ct => ct.tag_id))

  const availablePursuits = pursuits.filter(p => !capturePursuitIds.has(p.id))
  const tagSuggestions = tagQuery.trim()
    ? allTags.filter(t => !captureTagIds.has(t.id) && t.name.includes(tagQuery.toLowerCase().trim()))
    : []

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['library-captures'] })

  const handleTitleBlur = async () => {
    const trimmed = titleDraft.trim()
    if (trimmed === (capture.title ?? '')) return
    setTitleSaving(true)
    try {
      await updateCaptureTitle(supabase, capture.id, trimmed)
      invalidate()
      setTitleSaved(true)
      setTimeout(() => setTitleSaved(false), 1500)
    } finally {
      setTitleSaving(false)
    }
  }

  const handleRemovePursuit = async (pursuitId: string) => {
    await removeCaptureFromPursuit(supabase, capture.id, pursuitId)
    invalidate()
  }

  const handleAddPursuit = async (pursuitId: string) => {
    setPursuitDropdownOpen(false)
    await addCaptureToPursuit(supabase, capture.id, pursuitId, userId)
    invalidate()
  }

  const handleRemoveTag = async (tagId: string) => {
    await removeTagFromCapture(supabase, capture.id, tagId)
    invalidate()
  }

  const handleAddTag = async (name: string) => {
    const trimmed = name.toLowerCase().trim()
    if (!trimmed) return
    setTagInputOpen(false)
    setTagQuery('')
    const { data: tag } = await createTag(supabase, userId, trimmed)
    if (!tag) return
    if (!allTags.find(t => t.id === tag.id)) {
      onTagCreated(tag as Tag)
    }
    await addTagToCapture(supabase, capture.id, tag.id, userId)
    invalidate()
  }

  const enrichment = capture.enrichments

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-7 py-5 max-w-3xl w-full">

        {/* Title + star, then timestamp */}
        <div className="mb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="relative flex-1 min-w-0">
              <input
                type="text"
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                placeholder={capture.body?.slice(0, 60) ?? 'Add a title…'}
                className="w-full bg-transparent border-b border-charcoal/10 dark:border-white/[0.08] focus:border-charcoal/25 dark:focus:border-white/[0.18] outline-none font-serif text-[24px] font-light text-charcoal dark:text-[#f0ede8] placeholder:text-charcoal/20 dark:placeholder:text-[#5c5a57] placeholder:italic pb-[6px] transition-colors"
              />
              {titleSaving && (
                <span className="absolute right-0 bottom-[8px] font-sans text-[10px] text-charcoal/30 dark:text-[#5c5a57]">saving…</span>
              )}
              {titleSaved && (
                <span className="absolute right-0 bottom-[8px] font-sans text-[10px] text-sage">saved</span>
              )}
            </div>
            <button
              type="button"
              onClick={onStar}
              className={[
                'shrink-0 text-[22px] transition-colors leading-none mt-[2px]',
                starred ? 'text-ray' : 'text-charcoal/20 dark:text-[#5c5a57] hover:text-ray',
              ].join(' ')}
              title={starred ? 'Unstar' : 'Star'}
            >
              {starred ? '★' : '☆'}
            </button>
          </div>
          <p className="font-sans text-[10px] font-medium text-charcoal/45 dark:text-[#9e9b96] mt-3">
            <span className="tracking-[0.18em]">{formatLibraryDateLine(capture.captured_at)}</span>
            <span className="mx-1.5 inline-block tracking-normal" aria-hidden>
              @
            </span>
            <span className="tracking-[0.18em]">{formatLibraryTimeLine(capture.captured_at)}</span>
          </p>
        </div>

        {/* Body */}
        {capture.body && (
          <div className="font-serif text-[14px] font-light text-charcoal/65 dark:text-[#9e9b96] leading-[1.85] mb-6 whitespace-pre-wrap">
            {capture.body}
          </div>
        )}

        {/* Ki insights */}
        {enrichment?.enrichment_status === 'complete' && (
          <div className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] px-5 py-4 mb-5">
            <div className="text-[9px] font-semibold text-charcoal/30 dark:text-[#5c5a57] uppercase tracking-[0.12em] mb-3">
              Key  Insights
            </div>

            {enrichment.summary && (
              <p className="font-serif text-[13px] font-light italic text-charcoal/60 dark:text-[#9e9b96] leading-relaxed mb-3">
                &ldquo;{enrichment.summary}&rdquo;
              </p>
            )}

            {enrichment.themes && enrichment.themes.length > 0 && (
              <div className="flex flex-wrap gap-[5px] mb-3">
                {enrichment.themes.map(t => (
                  <span
                    key={t}
                    className="text-[10px] px-2 py-[3px] rounded-full bg-pacific/10 text-pacific border border-pacific/20"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              {enrichment.sentiment && (
                <span className="font-sans text-[10px] text-charcoal/35 dark:text-[#5c5a57]">
                  {enrichment.sentiment}
                </span>
              )}
              {enrichment.energy_level && (
                <span className="font-sans text-[10px] text-charcoal/35 dark:text-[#5c5a57]">
                  {enrichment.energy_level} energy
                </span>
              )}
              {enrichment.mood_tags && enrichment.mood_tags.length > 0 && enrichment.mood_tags.map(m => (
                <span
                  key={m}
                  className="text-[10px] px-[8px] py-[2px] rounded-full bg-charcoal/5 dark:bg-white/5 text-charcoal/40 dark:text-[#5c5a57] border border-charcoal/8 dark:border-white/[0.06]"
                >
                  {m}
                </span>
              ))}
            </div>

            {enrichment.questions_raised && enrichment.questions_raised.length > 0 && (
              <div className="mt-3 pt-3 border-t border-charcoal/8 dark:border-white/[0.07]">
                <div className="text-[9px] font-semibold text-charcoal/30 dark:text-[#5c5a57] uppercase tracking-[0.1em] mb-2">
                  Questions raised
                </div>
                <ul className="space-y-[4px]">
                  {enrichment.questions_raised.map((q, i) => (
                    <li key={i} className="font-serif text-[12px] font-light italic text-charcoal/50 dark:text-[#5c5a57] leading-relaxed">
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {enrichment?.enrichment_status === 'pending' && (
          <div className="font-serif text-[12px] font-light italic text-charcoal/30 dark:text-[#5c5a57] mb-5">
            Enriching this capture…
          </div>
        )}

        {/* Pursuits */}
        <div className="mb-5">
          <div className="text-[9px] font-semibold text-charcoal/30 dark:text-[#5c5a57] uppercase tracking-[0.12em] mb-[10px]">
            Pursuits
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {Array.from(capturePursuitIds).map(pid => {
              const pursuit = pursuits.find(p => p.id === pid)
              if (!pursuit) return null
              return (
                <div
                  key={pid}
                  className="flex items-center gap-[6px] pl-[8px] pr-[6px] py-[4px] rounded-full border border-charcoal/12 dark:border-white/[0.08] bg-charcoal/[0.03] dark:bg-[#161514]"
                >
                  <span
                    className="w-[5px] h-[5px] rounded-full shrink-0"
                    style={{ backgroundColor: pursuit.color ?? '#9e9b96' }}
                  />
                  <span className="font-sans text-[11px] text-charcoal/60 dark:text-[#9e9b96]">{pursuit.name}</span>
                  <button
                    onClick={() => handleRemovePursuit(pid)}
                    className="text-charcoal/25 dark:text-[#5c5a57] hover:text-terra transition-colors text-[13px] leading-none ml-[1px]"
                  >
                    ×
                  </button>
                </div>
              )
            })}

            {availablePursuits.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setPursuitDropdownOpen(v => !v)}
                  className="font-sans text-[11px] text-charcoal/30 dark:text-[#5c5a57] hover:text-terra transition-colors px-[9px] py-[4px] rounded-full border border-dashed border-charcoal/12 dark:border-white/[0.07] hover:border-terra/30"
                >
                  + add
                </button>
                {pursuitDropdownOpen && (
                  <div className="absolute top-full left-0 mt-[6px] bg-cream dark:bg-[#1d1b1a] border border-charcoal/12 dark:border-white/[0.08] rounded-[10px] py-1 shadow-lg z-10 min-w-[160px]">
                    {availablePursuits.map(p => (
                      <button
                        key={p.id}
                        onClick={() => handleAddPursuit(p.id)}
                        className="w-full text-left flex items-center gap-2 px-3 py-[7px] font-sans text-[12px] text-charcoal/60 dark:text-[#9e9b96] hover:text-charcoal dark:hover:text-[#f0ede8] hover:bg-charcoal/[0.04] dark:hover:bg-white/[0.04] transition-colors"
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color ?? '#9e9b96' }} />
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {capturePursuitIds.size === 0 && availablePursuits.length === 0 && (
              <span className="font-sans text-[11px] text-charcoal/20 dark:text-[#5c5a57] italic">
                no pursuits yet
              </span>
            )}
          </div>
        </div>

        {/* Tags */}
        <div>
          <div className="text-[9px] font-semibold text-charcoal/30 dark:text-[#5c5a57] uppercase tracking-[0.12em] mb-[10px]">
            Tags
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {captureTags.map(ct => (
              <div
                key={ct.tag_id}
                className="flex items-center gap-[5px] pl-[10px] pr-[6px] py-[4px] rounded-full bg-charcoal/[0.04] dark:bg-white/[0.04] border border-charcoal/10 dark:border-white/[0.07]"
              >
                <span className="font-sans text-[11px] text-charcoal/55 dark:text-[#9e9b96]">
                  #{ct.tags?.name ?? ''}
                </span>
                <button
                  onClick={() => handleRemoveTag(ct.tag_id)}
                  className="text-charcoal/25 dark:text-[#5c5a57] hover:text-terra transition-colors text-[13px] leading-none"
                >
                  ×
                </button>
              </div>
            ))}

            {tagInputOpen ? (
              <div className="relative">
                <input
                  ref={tagInputRef}
                  value={tagQuery}
                  onChange={e => setTagQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && tagQuery.trim()) handleAddTag(tagQuery)
                    if (e.key === 'Escape') { setTagInputOpen(false); setTagQuery('') }
                  }}
                  onBlur={() => setTimeout(() => { setTagInputOpen(false); setTagQuery('') }, 150)}
                  placeholder="tag name"
                  autoFocus
                  className="w-[110px] bg-charcoal/5 dark:bg-white/5 border border-charcoal/15 dark:border-white/[0.10] rounded-full px-3 py-[4px] font-sans text-[11px] text-charcoal dark:text-[#f0ede8] placeholder:text-charcoal/30 outline-none focus:border-charcoal/25 dark:focus:border-white/[0.15] transition-colors"
                />
                {tagQuery.trim() && (
                  <div className="absolute top-full left-0 mt-[6px] bg-cream dark:bg-[#1d1b1a] border border-charcoal/12 dark:border-white/[0.08] rounded-[10px] py-1 shadow-lg z-10 min-w-[150px]">
                    {tagSuggestions.slice(0, 5).map(t => (
                      <button
                        key={t.id}
                        onMouseDown={() => handleAddTag(t.name)}
                        className="w-full text-left px-3 py-[6px] font-sans text-[12px] text-charcoal/60 dark:text-[#9e9b96] hover:text-charcoal dark:hover:text-[#f0ede8] hover:bg-charcoal/[0.04] dark:hover:bg-white/[0.04] transition-colors"
                      >
                        #{t.name}
                      </button>
                    ))}
                    {!tagSuggestions.find(t => t.name === tagQuery.toLowerCase().trim()) && (
                      <button
                        onMouseDown={() => handleAddTag(tagQuery)}
                        className="w-full text-left px-3 py-[6px] font-sans text-[12px] text-terra hover:bg-terra/[0.06] transition-colors"
                      >
                        + create &ldquo;{tagQuery.trim()}&rdquo;
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setTagInputOpen(true)}
                className="font-sans text-[11px] text-charcoal/30 dark:text-[#5c5a57] hover:text-terra transition-colors px-[9px] py-[4px] rounded-full border border-dashed border-charcoal/12 dark:border-white/[0.07] hover:border-terra/30"
              >
                + add tag
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function LibraryClient({
  userId,
  pursuits,
  initialTags,
  initialSelectedId,
}: {
  userId: string
  pursuits: Pursuit[]
  initialTags: Tag[]
  initialSelectedId?: string | null
}) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [inputValue, setInputValue] = useState('')
  const [search, setSearch] = useState('')
  const [pursuitFilter, setPursuitFilter] = useState<string | null>(null)
  const [tagFilters, setTagFilters] = useState<Set<string>>(new Set())
  const [starredOnly, setStarredOnly] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null)
  const [tags, setTags] = useState<Tag[]>(initialTags)
  const [localStarred, setLocalStarred] = useState<Map<string, boolean>>(new Map())

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => setSearch(inputValue.trim()), 300)
    return () => clearTimeout(t)
  }, [inputValue])

  // Keep selected capture in sync with deep-link query param.
  useEffect(() => {
    if (initialSelectedId) setSelectedId(initialSelectedId)
  }, [initialSelectedId])

  const fetchCaptures = useCallback(async () => {
    const { data, error } = await getCaptures(supabase, {
      search: search || undefined,
      limit: 60,
    })
    if (error) throw error
    return (data ?? []) as CaptureRow[]
  }, [search])

  const { data: captures, isLoading, isError } = useQuery({
    queryKey: ['library-captures', search],
    queryFn: fetchCaptures,
  })

  /** Tag ids that appear on at least one capture in the current list (hides DB orphans in filter chips) */
  const tagIdsInCaptures = useMemo(() => {
    const s = new Set<string>()
    for (const c of captures ?? []) {
      for (const ct of c.capture_tags ?? []) s.add(ct.tag_id)
    }
    return s
  }, [captures])

  const tagsForFilters = useMemo(
    () => tags.filter(t => tagIdsInCaptures.has(t.id)),
    [tags, tagIdsInCaptures],
  )

  // Drop filter selections for tags that no longer appear on any loaded capture
  useEffect(() => {
    setTagFilters(prev => {
      const next = new Set<string>()
      for (const id of prev) {
        if (tagIdsInCaptures.has(id)) next.add(id)
      }
      if (prev.size === next.size && [...prev].every(id => next.has(id))) return prev
      return next
    })
  }, [tagIdsInCaptures])

  // Client-side filtering
  const filtered = (captures ?? []).filter(c => {
    if (pursuitFilter && !(c.capture_pursuits ?? []).some(cp => cp.pursuit_id === pursuitFilter)) return false
    if (tagFilters.size > 0) {
      const ids = new Set((c.capture_tags ?? []).map(ct => ct.tag_id))
      for (const tid of tagFilters) {
        if (!ids.has(tid)) return false
      }
    }
    if (starredOnly) {
      const star = localStarred.has(c.id) ? localStarred.get(c.id)! : c.is_starred
      if (!star) return false
    }
    return true
  })

  const selectedCapture = filtered.find(c => c.id === selectedId) ?? null

  // Clear selection when it leaves the filtered list
  useEffect(() => {
    if (selectedId && filtered.length > 0 && !filtered.find(c => c.id === selectedId)) {
      setSelectedId(null)
    }
  }, [filtered.length, selectedId])

  const handleStar = async (capture: CaptureRow) => {
    const current = localStarred.has(capture.id) ? localStarred.get(capture.id)! : capture.is_starred
    const next = !current
    setLocalStarred(prev => new Map(prev).set(capture.id, next))
    try {
      await starCapture(supabase, capture.id, next)
      queryClient.invalidateQueries({ queryKey: ['library-captures'] })
    } catch {
      setLocalStarred(prev => new Map(prev).set(capture.id, current))
    }
  }

  const filterBtnClass = (active: boolean, color: 'terra' | 'ray' = 'terra') =>
    [
      'px-3 py-[5px] rounded-[8px] font-sans text-[11px] font-medium transition-all border whitespace-nowrap',
      active
        ? color === 'ray'
          ? 'border-ray text-ray bg-ray/10'
          : 'border-terra text-terra bg-terra/10'
        : 'border-charcoal/10 dark:border-white/[0.07] text-charcoal/45 dark:text-[#5c5a57] hover:border-charcoal/18 dark:hover:border-white/[0.12] hover:text-charcoal/65 dark:hover:text-[#9e9b96]',
    ].join(' ')

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── LEFT: capture list ──────────────────────────────────────────────── */}
      <div className="w-[360px] shrink-0 border-r border-charcoal/8 dark:border-white/[0.07] flex flex-col overflow-hidden bg-cream dark:bg-[#0f0e0e]">

        {/* Search + filters */}
        <div className="px-4 pt-4 pb-3 border-b border-charcoal/8 dark:border-white/[0.07] shrink-0 space-y-[10px]">

          {/* Search */}
          <div className="flex items-center gap-2 bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[10px] px-3 py-[7px] focus-within:border-charcoal/15 dark:focus-within:border-white/[0.13] transition-colors">
            <MdOutlineSearch className="text-charcoal/30 dark:text-[#5c5a57] text-[18px] shrink-0" />
            <input
              className="flex-1 bg-transparent border-none outline-none font-sans text-[13px] text-charcoal dark:text-[#f0ede8] placeholder:text-charcoal/30 dark:placeholder:text-[#5c5a57]"
              placeholder="Search captures…"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
            />
          </div>

          {/* Pursuit dropdown + starred */}
          <div className="flex items-center gap-[6px]">
            <select
              value={pursuitFilter ?? ''}
              onChange={e => setPursuitFilter(e.target.value || null)}
              className="flex-1 bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[8px] px-3 py-[6px] font-sans text-[11px] text-charcoal dark:text-[#f0ede8] outline-none cursor-pointer"
            >
              <option value="">All pursuits</option>
              {pursuits.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              onClick={() => setStarredOnly(v => !v)}
              className={filterBtnClass(starredOnly, 'ray')}
            >
              ★
            </button>
          </div>

          {/* Tag chips — only tags used on at least one capture in this list; multi-select AND */}
          {tagsForFilters.length > 0 && (
            <div className="flex items-center gap-[6px] flex-wrap">
              {tagsForFilters.map(t => {
                const active = tagFilters.has(t.id)
                return (
                  <button
                    key={t.id}
                    onClick={() => setTagFilters(prev => {
                      const next = new Set(prev)
                      active ? next.delete(t.id) : next.add(t.id)
                      return next
                    })}
                    className={[
                      'px-[9px] py-[4px] rounded-full font-sans text-[10px] font-medium transition-all border',
                      active
                        ? 'border-terra text-terra bg-terra/10'
                        : 'border-charcoal/10 dark:border-white/[0.07] text-charcoal/40 dark:text-[#5c5a57] hover:border-charcoal/18 dark:hover:border-white/[0.12] hover:text-charcoal/60 dark:hover:text-[#9e9b96]',
                    ].join(' ')}
                  >
                    #{t.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Capture list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <p className="font-serif text-[12px] italic text-charcoal/30 dark:text-[#5c5a57] text-center py-10">
              Loading…
            </p>
          )}
          {isError && (
            <p className="font-sans text-[12px] text-terra text-center py-10">
              Failed to load captures.
            </p>
          )}
          {!isLoading && !isError && filtered.length === 0 && (
            <p className="font-serif text-[12px] italic text-charcoal/30 dark:text-[#5c5a57] text-center py-10">
              {search ? 'No matches.' : 'No captures yet.'}
            </p>
          )}
          {filtered.map(c => {
            const starred = localStarred.has(c.id) ? localStarred.get(c.id)! : c.is_starred
            return (
              <CaptureListItem
                key={c.id}
                capture={c}
                selected={c.id === selectedId}
                starred={starred}
                onSelect={() => setSelectedId(c.id === selectedId ? null : c.id)}
              />
            )
          })}
        </div>

        {captures && captures.length === 60 && (
          <div className="px-4 py-2 border-t border-charcoal/8 dark:border-white/[0.07] shrink-0">
            <p className="font-sans text-[10px] text-charcoal/25 dark:text-[#5c5a57] text-center">
              Showing 60 most recent
            </p>
          </div>
        )}
      </div>

      {/* ── RIGHT: capture detail ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden bg-cream dark:bg-[#0f0e0e]">
        {selectedCapture ? (
          <CaptureDetailPanel
            key={selectedCapture.id}
            capture={selectedCapture}
            pursuits={pursuits}
            allTags={tags}
            userId={userId}
            starred={localStarred.has(selectedCapture.id) ? localStarred.get(selectedCapture.id)! : selectedCapture.is_starred}
            onStar={() => handleStar(selectedCapture)}
            onTagCreated={tag => setTags(prev => [...prev, tag])}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="font-serif text-[15px] font-light italic text-charcoal/25 dark:text-[#5c5a57]">
              Select a capture to view
            </p>
          </div>
        )}
      </div>

    </div>
  )
}
