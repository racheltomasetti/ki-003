'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getCaptures } from '@ki/services'
import type { CaptureWithEnrichment } from '@ki/types'

// ─── Capture card ─────────────────────────────────────────────────────────────

function CaptureCard({ capture }: { capture: CaptureWithEnrichment }) {
  const enrichment = capture.enrichments
  const title = capture.title ?? capture.body?.slice(0, 72) ?? 'Untitled'
  const bodyPreview = capture.body ?? ''
  const date = new Date(capture.captured_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <article className="group px-6 py-5 border-b border-charcoal/8 dark:border-cream/8 hover:bg-charcoal/3 dark:hover:bg-cream/3 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="font-serif text-base font-bold text-charcoal dark:text-cream leading-snug mb-1 line-clamp-1">
            {title}
          </h3>

          {/* Enrichment summary — shown when available */}
          {enrichment?.enrichment_status === 'complete' && enrichment.summary ? (
            <p className="font-sans text-sm text-charcoal/60 dark:text-cream/60 leading-relaxed line-clamp-2 mb-3">
              {enrichment.summary}
            </p>
          ) : (
            <p className="font-serif text-sm text-charcoal/50 dark:text-cream/50 leading-relaxed line-clamp-2 mb-3">
              {bodyPreview}
            </p>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Type badge */}
            <span className="font-sans text-xs text-charcoal/40 dark:text-cream/40 uppercase tracking-wider">
              {capture.type}
            </span>

            {/* Date */}
            <span className="font-sans text-xs text-charcoal/35 dark:text-cream/35">{date}</span>

            {/* Themes */}
            {enrichment?.themes?.slice(0, 3).map((theme) => (
              <span
                key={theme}
                className="font-sans text-xs px-2 py-0.5 rounded-full bg-pacific/15 text-pacific"
              >
                {theme}
              </span>
            ))}
          </div>
        </div>

        {/* Star */}
        {capture.is_starred && (
          <svg
            className="w-4 h-4 text-ray shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        )}
      </div>
    </article>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const [inputValue, setInputValue] = useState('')
  const [search, setSearch] = useState('')

  // Debounce search 300ms
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

  return (
    <div className="max-w-3xl mx-auto py-10 px-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-charcoal dark:text-cream mb-1">Library</h1>
        <p className="font-sans text-sm text-charcoal/45 dark:text-cream/45">
          Everything you've captured.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal/35 dark:text-cream/35"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          placeholder="Search captures…"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-charcoal/5 dark:bg-cream/5 font-sans text-sm text-charcoal dark:text-cream placeholder:text-charcoal/35 dark:placeholder:text-cream/35 focus:outline-none focus:ring-2 focus:ring-pacific/40"
        />
      </div>

      {/* Results */}
      {isLoading && (
        <div className="font-sans text-sm text-charcoal/40 dark:text-cream/40 py-12 text-center">
          Loading…
        </div>
      )}

      {isError && (
        <div className="font-sans text-sm text-terra py-12 text-center">
          Failed to load captures.
        </div>
      )}

      {!isLoading && !isError && captures?.length === 0 && (
        <div className="font-sans text-sm text-charcoal/40 dark:text-cream/40 py-12 text-center">
          {search ? 'No captures match that search.' : 'No captures yet.'}
        </div>
      )}

      {captures && captures.length > 0 && (
        <div className="rounded-xl border border-charcoal/10 dark:border-cream/10 overflow-hidden">
          {captures.map((capture) => (
            <CaptureCard key={capture.id} capture={capture} />
          ))}
        </div>
      )}

      {captures && captures.length === 60 && (
        <p className="font-sans text-xs text-charcoal/35 dark:text-cream/35 text-center mt-6">
          Showing the 60 most recent captures.
        </p>
      )}
    </div>
  )
}
