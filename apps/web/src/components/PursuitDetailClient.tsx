'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { IoMdSettings } from 'react-icons/io'
import { createClient } from '@/lib/supabase/client'
import { addPursuitMessage } from '@ki/services'
import type { Pursuit, CaptureWithEnrichment, PursuitConversation } from '@ki/types'

// ─── Markdown renderer (paragraphs + bold, no dependency) ────────────────────

function renderMarkdown(text: string): React.ReactNode {
  return text.split('\n\n').map((para, i) => {
    const parts = para.split(/(\*\*[^*]+\*\*)/)
    return (
      <p key={i} className="mb-2 last:mb-0 whitespace-pre-wrap">
        {parts.map((part, j) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={j}>{part.slice(2, -2)}</strong>
            : part
        )}
      </p>
    )
  })
}

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
      <div className="flex items-center justify-between px-4 py-3 border-b border-charcoal/8 dark:border-white/7 flex-shrink-0">
        <span className="font-sans text-xs font-medium text-charcoal/60 dark:text-[#9e9b96]">
          Captures
          <span className="ml-1.5 text-charcoal/35 dark:text-[#5c5a57]">({captures.length})</span>
        </span>
      </div>

      <div className="px-3 py-2 border-b border-charcoal/8 dark:border-white/7 flex-shrink-0">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="search captures…"
          className="w-full bg-charcoal/5 dark:bg-white/5 rounded-lg px-3 py-1.5 font-sans text-xs text-charcoal dark:text-[#f0ede8] placeholder:text-charcoal/30 dark:placeholder:text-[#5c5a57] outline-none border border-transparent focus:border-charcoal/15 dark:focus:border-white/10 transition-colors"
        />
      </div>

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

// ─── Center: Thought distiller ────────────────────────────────────────────────

function ThoughtDistiller({
  content,
  onChange,
  onCopy,
  onSave,
  copied,
  saving,
  panelOpen,
  onOpenPanel,
}: {
  content: string
  onChange: (v: string) => void
  onCopy: () => void
  onSave: () => void
  copied: boolean
  saving: boolean
  panelOpen: boolean
  onOpenPanel: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-charcoal/8 dark:border-white/7 flex-shrink-0">
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChange('')}
            className="font-sans text-xs text-charcoal/35 dark:text-[#5c5a57] hover:text-charcoal dark:hover:text-[#9e9b96] transition-colors px-2 py-1 rounded border border-charcoal/10 dark:border-white/7 hover:border-charcoal/20 dark:hover:border-white/13"
          >
            clear
          </button>
          <button
            onClick={onSave}
            disabled={!content.trim() || saving}
            className={[
              'font-sans text-xs font-medium px-3 py-1 rounded-lg border transition-all',
              content.trim() && !saving
                ? 'border-charcoal/20 dark:border-white/13 text-charcoal/60 dark:text-[#9e9b96] hover:border-charcoal/35 dark:hover:border-white/20 hover:text-charcoal dark:hover:text-[#f0ede8]'
                : 'border-charcoal/8 dark:border-white/5 text-charcoal/25 dark:text-[#5c5a57] cursor-not-allowed',
            ].join(' ')}
          >
            {saving ? 'saving…' : 'save to Ki'}
          </button>
          <button
            onClick={onCopy}
            disabled={!content.trim()}
            className={[
              'flex items-center gap-1.5 font-sans text-xs font-semibold px-4 py-1 rounded-lg transition-all',
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

      {/* Textarea — fills remaining space */}
      <div className="flex-1 px-5 py-4 overflow-hidden">
        <textarea
          value={content}
          onChange={e => onChange(e.target.value)}
          placeholder="Ki will help shape your thinking here as you converse. You can also write directly — edit, refine, build on it together."
          className="w-full h-full bg-transparent border-none outline-none font-serif text-sm text-charcoal dark:text-[#f0ede8] placeholder:text-charcoal/25 dark:placeholder:text-[#5c5a57] placeholder:italic resize-none leading-relaxed"
        />
      </div>
    </div>
  )
}

// ─── Right panel: Ki chat ─────────────────────────────────────────────────────

function ChatPanel({
  captureCount,
  messages,
  isThinking,
  onSendMessage,
}: {
  captureCount: number
  messages: PursuitConversation[]
  isThinking: boolean
  onSendMessage: (content: string) => void
}) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking])

  const send = () => {
    const trimmed = input.trim()
    if (!trimmed || isThinking) return
    onSendMessage(trimmed)
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
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
    'what are the key themes here?',
    "what am I missing?",
    'help me distill this',
    'what questions keep coming up?',
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-charcoal/8 dark:border-white/7 flex-shrink-0">
        <div>
          <p className="font-sans text-sm font-medium text-charcoal dark:text-[#f0ede8]">Ki</p>
          <p className="font-sans text-[10px] text-charcoal/40 dark:text-[#5c5a57] mt-0.5">thinking partner</p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-charcoal/5 dark:bg-white/5 border border-charcoal/8 dark:border-white/7">
          <div className="w-1.5 h-1.5 rounded-full bg-sage flex-shrink-0" />
          <span className="font-sans text-[10px] text-charcoal/45 dark:text-[#5c5a57]">{captureCount} captures</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2.5">
        {messages.length === 0 && !isThinking ? (
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="max-w-[220px] text-center">
              <p className="font-serif text-sm font-light text-charcoal/50 dark:text-[#9e9b96] leading-relaxed italic">
                {captureCount > 0
                  ? `${captureCount} capture${captureCount !== 1 ? 's' : ''} in context. Ask me anything.`
                  : 'No captures yet. Add some on mobile, then come back to distill your thinking.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map(msg => (
              <div
                key={msg.id}
                className={['flex flex-col', msg.role === 'hero' ? 'items-end' : 'items-start'].join(' ')}
              >
                <div className={[
                  'max-w-[85%] px-3 py-2.5 rounded-xl font-sans text-xs leading-relaxed',
                  msg.role === 'hero'
                    ? 'bg-terra text-cream rounded-br-sm'
                    : 'bg-charcoal/[0.06] dark:bg-white/[0.06] border border-charcoal/8 dark:border-white/7 text-charcoal dark:text-[#f0ede8] rounded-bl-sm',
                ].join(' ')}>
                  {msg.role === 'ki' ? renderMarkdown(msg.content) : msg.content}
                </div>
                <span className="font-sans text-[9px] text-charcoal/25 dark:text-[#5c5a57] mt-1 px-1">
                  {msg.role === 'hero' ? 'you' : 'Ki'} · {relativeTime(msg.created_at)}
                </span>
              </div>
            ))}

            {/* Thinking indicator */}
            {isThinking && (
              <div className="flex flex-col items-start">
                <div className="px-3 py-2.5 rounded-xl rounded-bl-sm bg-charcoal/[0.06] dark:bg-white/[0.06] border border-charcoal/8 dark:border-white/7">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-charcoal/30 dark:bg-white/30 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-charcoal/30 dark:bg-white/30 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-charcoal/30 dark:bg-white/30 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
                <span className="font-sans text-[9px] text-charcoal/25 dark:text-[#5c5a57] mt-1 px-1">Ki · thinking</span>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 px-3 pb-3 border-t border-charcoal/8 dark:border-white/7 pt-3">
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

        <div className="flex items-end gap-2 bg-charcoal/[0.04] dark:bg-white/[0.05] border border-charcoal/10 dark:border-white/8 rounded-xl px-3 py-2 focus-within:border-charcoal/20 dark:focus-within:border-white/15 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Talk to Ki about this pursuit…"
            rows={1}
            disabled={isThinking}
            className="flex-1 bg-transparent border-none outline-none font-sans text-xs text-charcoal dark:text-[#f0ede8] placeholder:text-charcoal/30 dark:placeholder:text-[#5c5a57] placeholder:italic resize-none leading-relaxed disabled:opacity-50"
            style={{ minHeight: '20px', maxHeight: '112px' }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || isThinking}
            className={[
              'flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-all mb-0.5',
              input.trim() && !isThinking
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
  pursuit: Pursuit
  captures: CaptureWithEnrichment[]
  messages: PursuitConversation[]
}

const MODE_COLORS: Record<string, string> = {
  building: '#9e2a2b',
  creating: '#efcb68',
  researching: '#58a4b0',
  figuring_out: '#67934d',
}

const MODE_LABELS: Record<string, string> = {
  building: 'building',
  creating: 'creating',
  researching: 'researching',
  figuring_out: 'figuring out',
}

export function PursuitDetailClient({ pursuit, captures, messages: initialMessages }: Props) {
  const supabase = createClient()

  const [panelOpen, setPanelOpen] = useState(true)
  const [distillerContent, setDistillerContent] = useState('')
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [messages, setMessages] = useState<PursuitConversation[]>(initialMessages)
  const [highlightedCaptureId, setHighlightedCaptureId] = useState<string | null>(null)

  const rawCaptures = captures

  const handleCopy = async () => {
    if (!distillerContent.trim()) return
    await navigator.clipboard.writeText(distillerContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = async () => {
    if (!distillerContent.trim() || saving) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: capture, error } = await supabase
        .from('captures')
        .insert({
          user_id: user.id,
          type: 'text',
          source_type: 'distilled',
          enrichment_profile: 'distilled',
          body: distillerContent.trim(),
          source_metadata: {
            pursuit_id: pursuit.id,
            distilled_at: new Date().toISOString(),
          },
        })
        .select()
        .single()

      if (error || !capture) throw error

      // Tag it to this pursuit
      await supabase
        .from('capture_pursuits')
        .insert({ capture_id: capture.id, pursuit_id: pursuit.id, user_id: user.id })

      setDistillerContent('')
    } catch (err) {
      console.error('save to Ki error:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleSendMessage = async (content: string) => {
    if (isThinking) return
    setIsThinking(true)

    // Optimistic user message — temp ID so it renders immediately
    const tempUserMsg: PursuitConversation = {
      id: `temp-user-${Date.now()}`,
      pursuit_id: pursuit.id,
      user_id: '',
      role: 'hero',
      content,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempUserMsg])

    try {
      // Build conversation history for the agent (exclude the temp message)
      const history = messages.map(m => ({ role: m.role, content: m.content }))

      const { data, error: fnError } = await supabase.functions.invoke('pursuit-agent', {
        body: {
          pursuit_id: pursuit.id,
          message: content,
          conversation_history: history,
        },
      })

      if (fnError) throw fnError

      const agentData = data as {
        response: string
        distilled_text?: string
        citations?: Array<{ id: string; title: string | null; captured_at: string }>
      }

      const kiResponse = agentData.response ?? 'Something went wrong. Please try again.'

      // Populate thought distiller if Ki proposed a distillation
      if (agentData.distilled_text?.trim()) {
        setDistillerContent(agentData.distilled_text.trim())
      }

      // Persist both messages to DB (fire and update local state with real IDs)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const [savedUser, savedKi] = await Promise.all([
          addPursuitMessage(supabase, pursuit.id, user.id, 'hero', content),
          addPursuitMessage(supabase, pursuit.id, user.id, 'ki', kiResponse),
        ])

        // Replace temp message + add Ki response with real DB rows
        setMessages(prev => [
          ...prev.filter(m => m.id !== tempUserMsg.id),
          savedUser,
          savedKi,
        ])
      } else {
        // No user — still show Ki response in UI
        const tempKiMsg: PursuitConversation = {
          id: `temp-ki-${Date.now()}`,
          pursuit_id: pursuit.id,
          user_id: '',
          role: 'ki',
          content: kiResponse,
          created_at: new Date().toISOString(),
        }
        setMessages(prev => [...prev, tempKiMsg])
      }

      // Highlight referenced captures briefly
      if (agentData.citations?.length) {
        setHighlightedCaptureId(agentData.citations[0].id)
        setTimeout(() => setHighlightedCaptureId(null), 2000)
      }

    } catch (err) {
      console.error('pursuit-agent error:', err)
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id))
    } finally {
      setIsThinking(false)
    }
  }

  const handleHighlight = (captureId: string) => {
    setHighlightedCaptureId(captureId)
    setTimeout(() => setHighlightedCaptureId(null), 2000)
  }

  const color = pursuit.color ?? '#9e9b96'
  const mode = pursuit.pursuit_mode
  const modeColor = mode ? MODE_COLORS[mode] : null
  const modeLabel = mode ? MODE_LABELS[mode] : null

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Project header */}
      <div className="flex items-center justify-between px-5 py-[10px] border-b border-charcoal/8 dark:border-white/7 shrink-0 bg-cream dark:bg-[#161514]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="font-serif text-[15px] font-medium text-charcoal dark:text-[#f0ede8] truncate">{pursuit.name}</span>
          {modeLabel && modeColor && (
            <span
              className="text-[9px] font-medium px-2 py-[2px] rounded-full uppercase tracking-[0.06em] shrink-0"
              style={{ background: `${modeColor}20`, color: modeColor }}
            >
              {modeLabel}
            </span>
          )}
        </div>
        <Link
          href={`/pursuits/${pursuit.id}/settings`}
          className="flex items-center justify-center shrink-0 p-1 -m-1 text-charcoal/40 dark:text-[#9e9b96] hover:text-charcoal dark:hover:text-[#f0ede8] transition-colors"
          aria-label="Project settings"
        >
          <IoMdSettings className="size-[18px]" aria-hidden />
        </Link>
      </div>

      <div className="flex flex-1 overflow-hidden">

      {/* LEFT: Captures panel */}
      <div
        className={[
          'flex-shrink-0 border-r border-charcoal/8 dark:border-white/7 bg-cream dark:bg-[#161514] transition-all duration-200',
          panelOpen ? 'w-[260px]' : 'w-0 overflow-hidden',
        ].join(' ')}
      >
        <div className="w-[260px] h-full flex flex-col relative">
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

      {/* CENTER: Thought distiller */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-cream dark:bg-[#0f0e0e]">
        <ThoughtDistiller
          content={distillerContent}
          onChange={setDistillerContent}
          onCopy={handleCopy}
          onSave={handleSave}
          copied={copied}
          saving={saving}
          panelOpen={panelOpen}
          onOpenPanel={() => setPanelOpen(true)}
        />
      </div>

      {/* RIGHT: Ki chat */}
      <div className="w-[320px] flex-shrink-0 border-l border-charcoal/8 dark:border-white/7 bg-cream dark:bg-[#161514]">
        <ChatPanel
          captureCount={rawCaptures.length}
          messages={messages}
          isThinking={isThinking}
          onSendMessage={handleSendMessage}
        />
      </div>

      </div>{/* end panels row */}
    </div>
  )
}
