'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getCaptures } from '@ki/services'
import type { CaptureWithEnrichment } from '@ki/types'

type Filter = 'all' | 'voice' | 'text' | 'starred'

const SOURCE_ICONS: Record<string, string> = {
  voice: '🎙',
  text: '✎',
  file: '📎',
  distilled: '◈',
  manual: '✎',
}

function CaptureRow({ capture }: { capture: CaptureWithEnrichment }) {
  const enrichment = capture.enrichments
  const title = capture.title ?? capture.body?.slice(0, 72) ?? 'Untitled'
  const summary = enrichment?.summary
  const tags = capture.capture_tags?.slice(0, 3) ?? []
  const icon = SOURCE_ICONS[capture.source_type] ?? SOURCE_ICONS[capture.type] ?? '✎'

  const age = (() => {
    const diff = Date.now() - new Date(capture.captured_at).getTime()
    const hours = Math.floor(diff / 3_600_000)
    if (hours < 1) return 'just now'
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days === 1) return 'yesterday'
    if (days < 7) return `${days}d ago`
    return new Date(capture.captured_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })()

  const statusLabel =
    enrichment?.enrichment_status === 'complete'
      ? 'enriched'
      : enrichment?.enrichment_status === 'pending'
        ? 'processing...'
        : null

  return (
    <div className="flex gap-3 py-[14px] border-b border-charcoal/8 dark:border-white/[0.07] cursor-pointer group last:border-b-0">
      {/* Type icon */}
      <div className="w-8 h-8 rounded-[10px] bg-charcoal/[0.05] dark:bg-[#1d1b1a] border border-charcoal/8 dark:border-white/[0.07] flex items-center justify-center text-[13px] shrink-0 mt-[2px]">
        {icon}
      </div>

      <div className="flex-1 min-w-0">
        {/* Title + star */}
        <div className="flex items-start justify-between gap-2">
          <div className="text-[13px] text-charcoal dark:text-[#f0ede8] group-hover:text-terra transition-colors leading-snug">
            {title}
          </div>
          {capture.is_starred && (
            <span className="text-ray shrink-0 text-[14px] mt-[1px]">★</span>
          )}
        </div>

        {/* Enrichment summary */}
        {summary && (
          <div className="font-serif text-[12px] font-light italic text-charcoal/40 dark:text-[#5c5a57] leading-relaxed line-clamp-1 mt-[3px] mb-[5px]">
            "{summary}"
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex gap-1 flex-wrap mb-[5px]">
            {tags.map((ct) => (
              <span
                key={ct.tag_id}
                className="text-[10px] px-2 py-[2px] rounded-full bg-charcoal/[0.05] dark:bg-[#1d1b1a] text-charcoal/40 dark:text-[#5c5a57] border border-charcoal/10 dark:border-white/[0.07]"
              >
                {ct.tags?.name ?? ''}
              </span>
            ))}
          </div>
        )}

        {/* Meta */}
        <div className="text-[10px] text-charcoal/35 dark:text-[#5c5a57] mt-1">
          {capture.type} · {age}
          {statusLabel && ` · ${statusLabel}`}
        </div>
      </div>
    </div>
  )
}

export default function LibraryPage() {
  const [inputValue, setInputValue] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    const timer = setTimeout(() => setSearch(inputValue.trim()), 300)
    return () => clearTimeout(timer)
  }, [inputValue])

  const fetchCaptures = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await getCaptures(supabase, {
      search: search || undefined,
      limit: 60,
    })
    if (error) throw error
    return (data ?? []) as CaptureWithEnrichment[]
  }, [search])

  const { data: captures, isLoading, isError } = useQuery({
    queryKey: ['captures', search],
    queryFn: fetchCaptures,
  })

  const filtered = captures?.filter((c) => {
    if (filter === 'voice') return c.type === 'voice'
    if (filter === 'text') return c.type === 'text'
    if (filter === 'starred') return c.is_starred
    return true
  })

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'all' },
    { key: 'voice', label: 'voice' },
    { key: 'text', label: 'text' },
    { key: 'starred', label: 'starred ★' },
  ]

  return (
    <div className="flex-1 h-full overflow-y-auto">
      <div className="px-6 py-6 max-w-[780px] mx-auto">

        {/* Search + filters */}
        <div className="flex items-center gap-[10px] mb-5">
          <div className="flex-1 flex items-center gap-2 bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[10px] px-[14px] py-2 focus-within:border-charcoal/15 dark:focus-within:border-white/[0.13] transition-colors">
            <span className="text-charcoal/30 dark:text-[#5c5a57] text-[13px]">🔍</span>
            <input
              className="flex-1 bg-transparent border-none outline-none text-[13px] text-charcoal dark:text-[#f0ede8] placeholder:text-charcoal/30 dark:placeholder:text-[#5c5a57]"
              placeholder="Search by meaning, not just keywords..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
          </div>

          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={[
                'px-[14px] py-[7px] border rounded-[10px] text-[12px] cursor-pointer font-sans transition-all whitespace-nowrap',
                filter === key
                  ? 'border-terra text-terra bg-terra/10'
                  : 'border-charcoal/8 dark:border-white/[0.07] text-charcoal/40 dark:text-[#5c5a57] bg-charcoal/[0.03] dark:bg-[#161514] hover:border-charcoal/15 dark:hover:border-white/[0.13] hover:text-charcoal/60 dark:hover:text-[#9e9b96]',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        {/* States */}
        {isLoading && (
          <div className="text-[12px] text-charcoal/35 dark:text-[#5c5a57] py-12 text-center font-serif italic">
            Loading...
          </div>
        )}

        {isError && (
          <div className="text-[12px] text-terra py-12 text-center">
            Failed to load captures.
          </div>
        )}

        {!isLoading && !isError && filtered?.length === 0 && (
          <div className="text-[12px] text-charcoal/35 dark:text-[#5c5a57] py-12 text-center font-serif italic">
            {search ? 'No captures match that search.' : 'No captures yet.'}
          </div>
        )}

        {/* Capture list */}
        {filtered && filtered.length > 0 && (
          <div>
            {filtered.map((capture) => (
              <CaptureRow key={capture.id} capture={capture} />
            ))}
          </div>
        )}

        {captures && captures.length === 60 && (
          <p className="text-[11px] text-charcoal/35 dark:text-[#5c5a57] text-center mt-6">
            Showing the 60 most recent captures.
          </p>
        )}

      </div>
    </div>
  )
}
