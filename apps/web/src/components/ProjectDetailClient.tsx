'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { IoCopyOutline } from 'react-icons/io5'
import { createClient } from '@/lib/supabase/client'
import { updateProject } from '@ki/services'
import type { Project, CaptureWithEnrichment } from '@ki/types'

// ─── Capture row ──────────────────────────────────────────────────────────────

function CaptureRow({ capture }: { capture: CaptureWithEnrichment }) {
  const title = capture.title ?? capture.body?.slice(0, 72) ?? 'Untitled'
  const enrichment = capture.enrichments
  const date = new Date(capture.captured_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  return (
    <article className="px-5 py-4 border-b border-charcoal/8 dark:border-cream/8 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h4 className="font-serif text-sm font-bold text-charcoal dark:text-cream leading-snug mb-0.5 line-clamp-1">
            {title}
          </h4>
          {enrichment?.enrichment_status === 'complete' && enrichment.summary && (
            <p className="font-sans text-xs text-charcoal/55 dark:text-cream/55 leading-relaxed line-clamp-2">
              {enrichment.summary}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {capture.is_starred && (
            <svg className="w-3.5 h-3.5 text-ray" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          )}
          <span className="font-sans text-xs text-charcoal/35 dark:text-cream/35">{date}</span>
        </div>
      </div>
    </article>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  project: Project
  captures: CaptureWithEnrichment[]
}

export function ProjectDetailClient({ project, captures }: Props) {
  const color = project.color ?? '#58a4b0'

  // ── Name editing ──────────────────────────────────────────────────────────
  const [name, setName] = useState(project.name)
  const [editingName, setEditingName] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus()
  }, [editingName])

  const commitName = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setName(project.name)
      setEditingName(false)
      return
    }
    if (trimmed === project.name) {
      setEditingName(false)
      return
    }
    setSavingName(true)
    const supabase = createClient()
    await updateProject(supabase, project.id, { name: trimmed })
    setSavingName(false)
    setEditingName(false)
  }

  const onNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitName()
    if (e.key === 'Escape') {
      setName(project.name)
      setEditingName(false)
    }
  }

  // ── Brief editing ─────────────────────────────────────────────────────────
  const [brief, setBrief] = useState(project.brief ?? '')
  const [editingBrief, setEditingBrief] = useState(false)
  const [savingBrief, setSavingBrief] = useState(false)
  const [copied, setCopied] = useState(false)
  const briefTextareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editingBrief) {
      const el = briefTextareaRef.current
      if (el) {
        el.focus()
        el.setSelectionRange(el.value.length, el.value.length)
        el.style.height = 'auto'
        el.style.height = `${el.scrollHeight}px`
      }
    }
  }, [editingBrief])

  // Auto-resize textarea as content changes
  const onBriefChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBrief(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${e.target.scrollHeight}px`
  }

  const commitBrief = async () => {
    const trimmed = brief.trim()
    const original = project.brief ?? ''
    if (trimmed === original) {
      setEditingBrief(false)
      return
    }
    setSavingBrief(true)
    const supabase = createClient()
    await updateProject(supabase, project.id, { brief: trimmed || null })
    setSavingBrief(false)
    setEditingBrief(false)
  }

  const onBriefKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') commitBrief()
    if (e.key === 'Escape') {
      setBrief(project.brief ?? '')
      setEditingBrief(false)
    }
  }

  const copyBrief = async () => {
    if (!brief) return
    await navigator.clipboard.writeText(brief)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const hasBrief = brief.trim().length > 0

  // ── Brief collapse ────────────────────────────────────────────────────────
  const [briefOpen, setBriefOpen] = useState(true)

  return (
    <div className="max-w-3xl mx-auto py-10 px-6">

      {/* Back */}
      <Link
        href="/projects"
        className="inline-flex text-charcoal/35 dark:text-cream/35 hover:text-charcoal dark:hover:text-cream transition-colors mb-6"
        title="Back to projects"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
      </Link>

      {/* Project header */}
      <div className="mb-8">
        <div className="flex items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />

            {/* Editable name */}
            {editingName ? (
              <input
                ref={nameInputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={commitName}
                onKeyDown={onNameKeyDown}
                disabled={savingName}
                className="font-serif text-3xl font-bold text-charcoal dark:text-cream bg-transparent border-b-2 border-terra/50 focus:border-terra outline-none w-full leading-tight"
              />
            ) : (
              <h1
                onClick={() => setEditingName(true)}
                title="Click to edit"
                className="font-serif text-3xl font-bold text-charcoal dark:text-cream cursor-text hover:text-terra transition-colors leading-tight"
              >
                {name}
              </h1>
            )}
          </div>

          {/* Open Canvas */}
          <Link
            href={`/projects/${project.id}/canvas`}
            className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-terra/40 text-terra font-sans text-sm font-medium hover:bg-terra/8 transition-colors"
          >
            Canvas
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>

        {project.description && (
          <p className="font-sans text-sm text-charcoal/55 dark:text-cream/55 leading-relaxed ml-6">
            {project.description}
          </p>
        )}
      </div>

      {/* Brief */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-sans text-xs font-semibold text-charcoal/50 dark:text-cream/50 uppercase tracking-wider">
            Project Brief
          </h2>
          <div className="flex items-center gap-3">
            {savingBrief && (
              <span className="font-sans text-xs text-charcoal/35 dark:text-cream/35">Saving…</span>
            )}
            <button
              onClick={() => setBriefOpen((o) => !o)}
              className="text-charcoal/35 dark:text-cream/35 hover:text-charcoal dark:hover:text-cream transition-colors"
              title={briefOpen ? 'Collapse' : 'Expand'}
            >
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${briefOpen ? 'rotate-0' : '-rotate-90'}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          </div>
        </div>

        {/* Brief box — grid trick for smooth height animation */}
        <div className={`grid transition-all duration-200 ease-in-out ${briefOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
        <div className="group relative rounded-xl bg-charcoal/[0.04] dark:bg-cream/[0.04] border border-charcoal/8 dark:border-cream/8 overflow-hidden">

          {/* Top-right: hint + copy button — always in the same flex row so they stay vertically centered */}
          {!editingBrief && (
            <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
              <span className="font-sans text-xs text-charcoal/25 dark:text-cream/25 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                double-click to edit
              </span>
              {hasBrief && (
                <button
                  onClick={copyBrief}
                  title="Copy brief"
                  className={[
                    'p-1.5 rounded-lg border transition-colors',
                    copied
                      ? 'border-sage/40 text-sage'
                      : 'border-charcoal/15 dark:border-cream/15 text-charcoal/35 dark:text-cream/35 hover:border-charcoal/30 dark:hover:border-cream/30 hover:text-charcoal dark:hover:text-cream',
                  ].join(' ')}
                >
                  {copied ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    <IoCopyOutline className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
          )}

          {editingBrief ? (
            <div className="p-5 pr-12">
              <textarea
                ref={briefTextareaRef}
                value={brief}
                onChange={onBriefChange}
                onBlur={commitBrief}
                onKeyDown={onBriefKeyDown}
                disabled={savingBrief}
                className="w-full font-serif text-sm text-charcoal dark:text-cream bg-transparent resize-none focus:outline-none leading-relaxed placeholder:text-charcoal/30 dark:placeholder:text-cream/30 min-h-[6rem]"
                placeholder="Write a brief for this project…"
              />
              <p className="font-sans text-xs text-charcoal/30 dark:text-cream/30 mt-3">
                ⌘↵ to save · Esc to cancel
              </p>
            </div>
          ) : (
            <div
              onDoubleClick={() => setEditingBrief(true)}
              className="group p-5 cursor-text min-h-[4rem] pr-12"
            >
              {hasBrief ? (
                <p className="font-serif text-sm text-charcoal dark:text-cream leading-relaxed whitespace-pre-wrap">
                  {brief}
                </p>
              ) : (
                <p className="font-serif text-sm text-charcoal/30 dark:text-cream/30 leading-relaxed italic">
                  No brief yet — double-click to add one.
                </p>
              )}
            </div>
          )}
        </div>
        </div>
        </div>
      </section>

      {/* Captures */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-sans text-xs font-semibold text-charcoal/50 dark:text-cream/50 uppercase tracking-wider">
            Captures
          </h2>
          <span className="font-sans text-xs text-charcoal/35 dark:text-cream/35">
            {captures.length} {captures.length === 1 ? 'capture' : 'captures'}
          </span>
        </div>

        {captures.length === 0 ? (
          <div className="font-sans text-sm text-charcoal/40 dark:text-cream/40 py-10 text-center">
            No captures in this project yet.
          </div>
        ) : (
          <div className="rounded-xl border border-charcoal/10 dark:border-cream/10 overflow-hidden">
            {captures.map((capture) => (
              <CaptureRow key={capture.id} capture={capture} />
            ))}
          </div>
        )}
      </section>

    </div>
  )
}
