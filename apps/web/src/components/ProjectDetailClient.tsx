'use client'

import { useState, useRef, useEffect } from 'react'
import type { Project, CaptureWithEnrichment, ProjectConversation } from '@ki/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHrs = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHrs < 24) return `${diffHrs}h ago`
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fullTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

// ─── Left panel: Captures ─────────────────────────────────────────────────────

function CapturesPanel({
  captures,
  highlightedId,
  onHighlight,
}: {
  captures: CaptureWithEnrichment[]
  highlightedId: string | null
  onHighlight: (id: string) => void
}) {
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? captures.filter(c =>
        (c.title ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (c.body ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : captures

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-charcoal/8 dark:border-white/7 flex-shrink-0">
        <span className="font-sans text-xs font-medium text-charcoal/60 dark:text-[#9e9b96]">
          Captures
          <span className="ml-1.5 text-charcoal/35 dark:text-[#5c5a57]">({captures.length})</span>
        </span>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-charcoal/8 dark:border-white/7 flex-shrink-0">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="search captures…"
          className="w-full bg-charcoal/5 dark:bg-white/5 rounded-lg px-3 py-1.5 font-sans text-xs text-charcoal dark:text-[#f0ede8] placeholder:text-charcoal/30 dark:placeholder:text-[#5c5a57] outline-none border border-transparent focus:border-charcoal/15 dark:focus:border-white/10 transition-colors"
        />
      </div>

      {/* Capture list */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {filtered.length === 0 ? (
          <p className="font-sans text-xs text-charcoal/35 dark:text-[#5c5a57] text-center py-10 px-4 leading-relaxed">
            {captures.length === 0
              ? 'No captures yet. Record a thought on mobile to get started.'
              : 'No captures match your search.'}
          </p>
        ) : (
          filtered.map(c => {
            const lit = c.id === highlightedId
            const label = c.title ?? (c.body ?? '').slice(0, 48) ?? 'Untitled'
            const meta = [
              c.source_type === 'voice' ? 'voice' : c.source_type === 'file' ? 'file' : 'text',
              relativeTime(c.captured_at),
              c.is_starred ? '★' : null,
            ].filter(Boolean).join(' · ')

            return (
              <button
                key={c.id}
                onClick={() => onHighlight(c.id)}
                className={[
                  'w-full text-left px-3 py-2.5 rounded-lg mb-1 transition-all duration-200 border',
                  lit
                    ? 'border-terra/40 bg-terra/8 dark:bg-terra/10 animate-pulse-glow'
                    : 'border-transparent bg-charcoal/[0.03] dark:bg-white/[0.04] hover:border-charcoal/10 dark:hover:border-white/10',
                ].join(' ')}
              >
                <p className={[
                  'font-sans text-xs font-medium leading-snug truncate mb-0.5',
                  lit ? 'text-terra' : 'text-charcoal dark:text-[#f0ede8]',
                ].join(' ')}>
                  {label}
                </p>
                <p className="font-sans text-[10px] text-charcoal/40 dark:text-[#5c5a57]">{meta}</p>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── Center top: Thought distiller ───────────────────────────────────────────

function ThoughtDistiller({
  content,
  onChange,
  onCopy,
  onSave,
  copied,
  refCaptures,
  onOpenPanel,
  panelOpen,
}: {
  content: string
  onChange: (v: string) => void
  onCopy: () => void
  onSave: () => void
  copied: boolean
  refCaptures: CaptureWithEnrichment[]
  onOpenPanel: () => void
  panelOpen: boolean
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 240)}px`
  }

  return (
    <div className="flex-shrink-0 border-b border-charcoal/8 dark:border-white/7 px-5 py-4 bg-cream dark:bg-[#0f0e0e]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {!panelOpen && (
            <button
              onClick={onOpenPanel}
              className="flex items-center justify-center w-5 h-5 rounded border border-charcoal/15 dark:border-white/10 text-charcoal/40 dark:text-[#5c5a57] hover:text-charcoal dark:hover:text-[#9e9b96] transition-colors text-[10px]"
              title="Show captures"
            >
              ▸
            </button>
          )}
          <span className="font-sans text-[10px] font-semibold text-charcoal/45 dark:text-[#5c5a57] uppercase tracking-widest">
            Thought distiller
          </span>
        </div>
        <button
          onClick={() => onChange('')}
          className="font-sans text-xs text-charcoal/35 dark:text-[#5c5a57] hover:text-charcoal dark:hover:text-[#9e9b96] transition-colors px-2 py-1 rounded border border-charcoal/10 dark:border-white/7 hover:border-charcoal/20 dark:hover:border-white/13"
        >
          clear
        </button>
      </div>

      {/* Referenced capture chips */}
      {refCaptures.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {refCaptures.map(c => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-sans bg-terra/10 text-terra border border-terra/25"
            >
              <span className="w-1 h-1 rounded-full bg-terra flex-shrink-0" />
              {c.title ?? c.body?.slice(0, 32) ?? 'capture'}
            </span>
          ))}
        </div>
      )}

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleChange}
        placeholder="Talk to Ki in the chat → Ki will help you shape a distilled thought from your captures. When it feels right, save it or copy it."
        rows={4}
        className="w-full bg-charcoal/[0.04] dark:bg-white/[0.05] border border-charcoal/8 dark:border-white/7 rounded-lg px-4 py-3 font-serif text-sm text-charcoal dark:text-[#f0ede8] placeholder:text-charcoal/25 dark:placeholder:text-[#5c5a57] placeholder:italic resize-none outline-none focus:border-charcoal/20 dark:focus:border-white/13 leading-relaxed transition-colors"
        style={{ minHeight: '96px', maxHeight: '240px' }}
      />

      {/* Footer */}
      <div className="flex items-center justify-between mt-2.5">
        <span className="font-sans text-[10px] italic text-charcoal/30 dark:text-[#5c5a57]">
          {refCaptures.length > 0
            ? `Ki shaped this from ${refCaptures.length} capture${refCaptures.length !== 1 ? 's' : ''}`
            : 'empty — start a conversation with Ki →'}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onSave}
            disabled={!content.trim()}
            className={[
              'font-sans text-xs font-medium px-3 py-1.5 rounded-lg border transition-all',
              content.trim()
                ? 'border-charcoal/20 dark:border-white/13 text-charcoal/60 dark:text-[#9e9b96] hover:border-charcoal/35 dark:hover:border-white/20 hover:text-charcoal dark:hover:text-[#f0ede8]'
                : 'border-charcoal/8 dark:border-white/5 text-charcoal/25 dark:text-[#5c5a57] cursor-not-allowed',
            ].join(' ')}
          >
            save to Ki
          </button>
          <button
            onClick={onCopy}
            disabled={!content.trim()}
            className={[
              'flex items-center gap-1.5 font-sans text-xs font-semibold px-4 py-1.5 rounded-lg transition-all',
              content.trim()
                ? copied
                  ? 'bg-sage text-cream'
                  : 'bg-terra text-cream hover:bg-terra/90'
                : 'bg-charcoal/8 dark:bg-white/5 text-charcoal/25 dark:text-[#5c5a57] cursor-not-allowed',
            ].join(' ')}
          >
            {copied ? '✓ copied' : <>copy <span className="text-[11px]">⎘</span></>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Center bottom: Output history ───────────────────────────────────────────

function OutputHistory({ distilled }: { distilled: CaptureWithEnrichment[] }) {
  return (
    <div className="flex-1 overflow-y-auto px-5 py-5">
      <div className="flex items-center justify-between mb-5">
        <span className="font-sans text-[10px] font-semibold text-charcoal/35 dark:text-[#5c5a57] uppercase tracking-widest">
          Output history
        </span>
        <span className="font-sans text-[10px] text-charcoal/25 dark:text-[#5c5a57]">
          every save recorded automatically
        </span>
      </div>

      {distilled.length === 0 ? (
        <div className="text-center py-12">
          <p className="font-serif text-base font-light text-charcoal/45 dark:text-[#9e9b96] mb-2">
            No outputs yet
          </p>
          <p className="font-sans text-xs text-charcoal/30 dark:text-[#5c5a57] leading-relaxed max-w-xs mx-auto">
            Talk to Ki, shape a distilled thought, save it here. Every save builds the record of how your thinking evolved on this project.
          </p>
        </div>
      ) : (
        <div className="relative">
          {distilled.map((c, i) => (
            <div key={c.id} className="relative pl-5 mb-5">
              {/* Timeline line */}
              {i < distilled.length - 1 && (
                <div className="absolute left-[5px] top-3 bottom-[-20px] w-px bg-charcoal/10 dark:bg-white/7" />
              )}
              {/* Dot */}
              <div className="absolute left-0 top-[5px] w-[11px] h-[11px] rounded-full bg-charcoal/8 dark:bg-white/8 border border-charcoal/20 dark:border-white/13 flex items-center justify-center">
                <div className="w-[5px] h-[5px] rounded-full bg-terra" />
              </div>
              {/* Timestamp */}
              <p className="font-sans text-[10px] text-charcoal/35 dark:text-[#5c5a57] mb-1.5">
                {fullTimestamp(c.captured_at)} · saved to Ki
              </p>
              {/* Content block */}
              <div className="bg-charcoal/[0.04] dark:bg-white/[0.04] border border-charcoal/8 dark:border-white/7 rounded-lg px-4 py-3 font-serif text-xs font-light text-charcoal/70 dark:text-[#9e9b96] leading-relaxed cursor-pointer hover:border-charcoal/15 dark:hover:border-white/13 transition-colors">
                {c.title && (
                  <p className="font-sans text-xs font-medium text-charcoal/60 dark:text-[#9e9b96] mb-1.5 not-italic">
                    {c.title}
                  </p>
                )}
                <p className="line-clamp-4 italic">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Right panel: Ki chat ─────────────────────────────────────────────────────

function ChatPanel({
  captureCount,
  messages,
  onSendMessage,
}: {
  captureCount: number
  messages: ProjectConversation[]
  onSendMessage: (content: string) => void
}) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = () => {
    const trimmed = input.trim()
    if (!trimmed) return
    onSendMessage(trimmed)
    setInput('')
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 112)}px`
  }

  const suggestions = [
    'refine my thinking',
    "what am I missing?",
    'shape a distilled thought',
    'most relevant captures?',
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-charcoal/8 dark:border-white/7 flex-shrink-0">
        <div>
          <p className="font-sans text-sm font-medium text-charcoal dark:text-[#f0ede8]">Ki</p>
          <p className="font-sans text-[10px] text-charcoal/40 dark:text-[#5c5a57] mt-0.5">project thinking partner</p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-charcoal/5 dark:bg-white/5 border border-charcoal/8 dark:border-white/7">
          <div className="w-1.5 h-1.5 rounded-full bg-sage flex-shrink-0" />
          <span className="font-sans text-[10px] text-charcoal/45 dark:text-[#5c5a57]">{captureCount} captures</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2.5">
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="max-w-[220px] text-center">
              <p className="font-serif text-sm font-light text-charcoal/50 dark:text-[#9e9b96] leading-relaxed italic mb-2">
                {captureCount > 0
                  ? `${captureCount} capture${captureCount !== 1 ? 's' : ''} in this project. Ask me anything.`
                  : 'No captures yet. Add some on mobile, then come back here to distill your thinking.'}
              </p>
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={['flex flex-col', msg.role === 'user' ? 'items-end' : 'items-start'].join(' ')}
            >
              <div className={[
                'max-w-[85%] px-3 py-2.5 rounded-xl font-sans text-xs leading-relaxed',
                msg.role === 'user'
                  ? 'bg-terra text-cream rounded-br-sm'
                  : 'bg-charcoal/[0.06] dark:bg-white/[0.06] border border-charcoal/8 dark:border-white/7 text-charcoal dark:text-[#f0ede8] rounded-bl-sm',
              ].join(' ')}>
                {msg.content}
              </div>
              <span className="font-sans text-[9px] text-charcoal/25 dark:text-[#5c5a57] mt-1 px-1">
                {msg.role === 'user' ? 'you' : 'Ki'} · {relativeTime(msg.created_at)}
              </span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 px-3 pb-3 border-t border-charcoal/8 dark:border-white/7 pt-3">
        {/* Suggestion chips */}
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => { setInput(s); inputRef.current?.focus() }}
              className="font-sans text-[10px] px-2.5 py-1 rounded-full border border-charcoal/12 dark:border-white/8 text-charcoal/45 dark:text-[#5c5a57] hover:border-terra/40 hover:text-terra dark:hover:text-terra dark:hover:border-terra/40 transition-all bg-transparent"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex items-end gap-2 bg-charcoal/[0.04] dark:bg-white/[0.05] border border-charcoal/10 dark:border-white/8 rounded-xl px-3 py-2 focus-within:border-charcoal/20 dark:focus-within:border-white/15 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Talk to Ki about this project…"
            rows={1}
            className="flex-1 bg-transparent border-none outline-none font-sans text-xs text-charcoal dark:text-[#f0ede8] placeholder:text-charcoal/30 dark:placeholder:text-[#5c5a57] placeholder:italic resize-none leading-relaxed"
            style={{ minHeight: '20px', maxHeight: '112px' }}
          />
          <button
            onClick={send}
            disabled={!input.trim()}
            className={[
              'flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-all mb-0.5',
              input.trim()
                ? 'bg-terra text-cream hover:bg-terra/90'
                : 'bg-charcoal/8 dark:bg-white/8 text-charcoal/25 dark:text-[#5c5a57] cursor-not-allowed',
            ].join(' ')}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

interface Props {
  project: Project
  captures: CaptureWithEnrichment[]
  messages: ProjectConversation[]
}

export function ProjectDetailClient({ captures, messages }: Props) {
  const [panelOpen, setPanelOpen] = useState(true)
  const [distillerContent, setDistillerContent] = useState('')
  const [copied, setCopied] = useState(false)
  const [highlightedCaptureId, setHighlightedCaptureId] = useState<string | null>(null)

  const rawCaptures = captures.filter(c => c.source_type !== 'distilled')
  const distilledCaptures = captures
    .filter(c => c.source_type === 'distilled')
    .sort((a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime())

  const handleCopy = async () => {
    if (!distillerContent.trim()) return
    await navigator.clipboard.writeText(distillerContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = () => {
    // Checkpoint 4 — opens title modal and creates distilled capture
    // Wired up in the next build round
  }

  const handleSendMessage = (content: string) => {
    // Checkpoint 2 — persists to project_conversations
    // Checkpoint 3 — triggers project-agent edge function
    console.log('send:', content)
  }

  const handleHighlight = (captureId: string) => {
    setHighlightedCaptureId(captureId)
    setTimeout(() => setHighlightedCaptureId(null), 2000)
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* LEFT: Captures panel */}
      <div
        className={[
          'flex-shrink-0 border-r border-charcoal/8 dark:border-white/7 bg-cream dark:bg-[#161514] transition-all duration-200',
          panelOpen ? 'w-[260px]' : 'w-0 overflow-hidden',
        ].join(' ')}
      >
        <div className="w-[260px] h-full flex flex-col relative">
          {/* Collapse toggle */}
          <button
            onClick={() => setPanelOpen(false)}
            className="absolute top-3 right-3 z-10 flex items-center justify-center w-5 h-5 rounded border border-charcoal/12 dark:border-white/8 text-charcoal/35 dark:text-[#5c5a57] hover:text-charcoal dark:hover:text-[#9e9b96] transition-colors text-[10px]"
            title="Collapse captures"
          >
            ◂
          </button>
          <CapturesPanel
            captures={rawCaptures}
            highlightedId={highlightedCaptureId}
            onHighlight={handleHighlight}
          />
        </div>
      </div>

      {/* CENTER */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-cream dark:bg-[#0f0e0e]">
        <ThoughtDistiller
          content={distillerContent}
          onChange={setDistillerContent}
          onCopy={handleCopy}
          onSave={handleSave}
          copied={copied}
          refCaptures={[]}
          onOpenPanel={() => setPanelOpen(true)}
          panelOpen={panelOpen}
        />
        <OutputHistory distilled={distilledCaptures} />
      </div>

      {/* RIGHT: Ki chat */}
      <div className="w-[320px] flex-shrink-0 border-l border-charcoal/8 dark:border-white/7 bg-cream dark:bg-[#161514]">
        <ChatPanel
          captureCount={rawCaptures.length}
          messages={messages}
          onSendMessage={handleSendMessage}
        />
      </div>

    </div>
  )
}
