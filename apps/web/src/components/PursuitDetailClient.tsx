'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import { IoMdSettings } from 'react-icons/io'
import { createClient } from '@/lib/supabase/client'
import { addPursuitMessage } from '@ki/services'
import type { Pursuit, CaptureWithEnrichment, PursuitConversation } from '@ki/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Citation {
  id: string
  title: string | null
  captured_at: string
  quote?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode {
  return text.split('\n\n').map((para, i) => {
    const parts = para.split(/(\*\*[^*]+\*\*)/)
    return (
      <p key={i} className="mb-2 last:mb-0">
        {parts.map((part, j) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={j}>{part.slice(2, -2)}</strong>
            : part
        )}
      </p>
    )
  })
}

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

function highlightText(body: string, quote: string | null): React.ReactNode {
  if (!quote) return body
  const idx = body.toLowerCase().indexOf(quote.toLowerCase())
  if (idx === -1) return body
  return (
    <>
      {body.slice(0, idx)}
      <mark className="bg-ray/40 dark:bg-ray/25 text-charcoal dark:text-[#f0ede8] rounded-sm px-0.5 not-italic">
        {body.slice(idx, idx + quote.length)}
      </mark>
      {body.slice(idx + quote.length)}
    </>
  )
}

// ─── Corpus Panel ─────────────────────────────────────────────────────────────

function CorpusPanel({
  captures,
  selectedId,
  highlightQuote,
  onSelect,
  onBack,
}: {
  captures: CaptureWithEnrichment[]
  selectedId: string | null
  highlightQuote: string | null
  onSelect: (id: string, quote?: string) => void
  onBack: () => void
}) {
  const [search, setSearch] = useState('')
  const selected = captures.find(c => c.id === selectedId) ?? null

  // Detail view
  if (selected) {
    const enrichment = Array.isArray(selected.enrichments)
      ? selected.enrichments[0]
      : selected.enrichments

    return (
      <div className="flex flex-col h-full bg-cream dark:bg-[#161514]">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-charcoal/8 dark:border-white/7 flex-shrink-0">
          <button
            onClick={onBack}
            className="font-sans text-[10px] text-charcoal/40 dark:text-[#5c5a57] hover:text-charcoal dark:hover:text-[#9e9b96] transition-colors"
          >
            ← corpus
          </button>
          <span className="text-charcoal/15 dark:text-[#3a3835]">·</span>
          <span className="font-sans text-[10px] text-charcoal/40 dark:text-[#5c5a57]">
            {relativeTime(selected.captured_at)}
          </span>
          {selected.is_starred && <span className="text-[10px] text-ray">★</span>}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="font-serif text-sm text-charcoal dark:text-[#f0ede8] leading-relaxed whitespace-pre-wrap">
            {highlightText(selected.body ?? '', highlightQuote)}
          </div>

          {(enrichment?.summary || (enrichment?.themes && (enrichment.themes as string[]).length > 0)) && (
            <div className="border-t border-charcoal/8 dark:border-white/7 pt-4 space-y-3">
              {enrichment?.summary && (
                <div>
                  <p className="font-sans text-[9px] font-medium uppercase tracking-widest text-charcoal/35 dark:text-[#5c5a57] mb-1.5">
                    Summary
                  </p>
                  <p className="font-sans text-xs text-charcoal/55 dark:text-[#9e9b96] leading-relaxed">
                    {enrichment.summary}
                  </p>
                </div>
              )}
              {enrichment?.themes && (enrichment.themes as string[]).length > 0 && (
                <div>
                  <p className="font-sans text-[9px] font-medium uppercase tracking-widest text-charcoal/35 dark:text-[#5c5a57] mb-1.5">
                    Themes
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(enrichment.themes as string[]).map((t: string) => (
                      <span
                        key={t}
                        className="font-sans text-[10px] px-2 py-0.5 rounded-full bg-charcoal/5 dark:bg-white/5 border border-charcoal/8 dark:border-white/7 text-charcoal/50 dark:text-[#9e9b96]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // List view
  const filtered = search.trim()
    ? captures.filter(c =>
        (c.title ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (c.body ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : captures

  return (
    <div className="flex flex-col h-full bg-cream dark:bg-[#161514]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-charcoal/8 dark:border-white/7 flex-shrink-0">
        <span className="font-sans text-xs font-medium text-charcoal/60 dark:text-[#9e9b96]">
          Corpus
          <span className="ml-1.5 text-charcoal/35 dark:text-[#5c5a57]">({captures.length})</span>
        </span>
      </div>

      <div className="px-3 py-2 border-b border-charcoal/8 dark:border-white/7 flex-shrink-0">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="search…"
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
            const label = c.title ?? (c.body ?? '').slice(0, 60)
            const meta = [
              c.source_type === 'voice' ? 'voice' : c.source_type === 'file' ? 'file' : 'text',
              relativeTime(c.captured_at),
            ].join(' · ')

            return (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className="w-full text-left px-3 py-2.5 rounded-lg mb-1 border border-transparent bg-charcoal/[0.03] dark:bg-white/[0.04] hover:border-charcoal/10 dark:hover:border-white/10 transition-all duration-150"
              >
                <p className="font-sans text-xs font-medium leading-snug line-clamp-2 mb-0.5 text-charcoal dark:text-[#f0ede8]">
                  {label}{c.is_starred ? ' ★' : ''}
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

// ─── Chat Panel ───────────────────────────────────────────────────────────────

function ChatPanel({
  captureCount,
  messages,
  messageCitations,
  isThinking,
  savingMessageId,
  onSendMessage,
  onSaveMessage,
  onCitationClick,
}: {
  captureCount: number
  messages: PursuitConversation[]
  messageCitations: Map<string, Citation[]>
  isThinking: boolean
  savingMessageId: string | null
  onSendMessage: (content: string) => void
  onSaveMessage: (messageId: string, content: string) => void
  onCitationClick: (captureId: string, quote?: string) => void
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
    <div className="flex flex-col h-full bg-cream dark:bg-[#0f0e0e]">
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
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {messages.length === 0 && !isThinking ? (
          <div className="flex-1 flex items-center justify-center px-4">
            <p className="max-w-[260px] text-center font-serif text-sm font-light text-charcoal/50 dark:text-[#9e9b96] leading-relaxed italic">
              {captureCount > 0
                ? `${captureCount} capture${captureCount !== 1 ? 's' : ''} in context. Ask me anything.`
                : 'No captures yet. Add some on mobile, then come back to distill your thinking.'}
            </p>
          </div>
        ) : (
          <>
            {messages.map(msg => {
              if (msg.role === 'hero') {
                return (
                  <div key={msg.id} className="flex flex-col items-end">
                    <div className="max-w-[85%] px-3 py-2.5 rounded-xl rounded-br-sm bg-terra text-cream font-sans text-xs leading-relaxed">
                      {msg.content}
                    </div>
                    <span className="font-sans text-[9px] text-charcoal/25 dark:text-[#5c5a57] mt-1 px-1">
                      you · {relativeTime(msg.created_at)}
                    </span>
                  </div>
                )
              }

              const citations = messageCitations.get(msg.id)
              const isSaving = savingMessageId === msg.id

              return (
                <div key={msg.id} className="flex flex-col items-start group">
                  <div className="max-w-[90%] px-3 py-2.5 rounded-xl rounded-bl-sm bg-charcoal/[0.06] dark:bg-white/[0.06] border border-charcoal/8 dark:border-white/7 text-charcoal dark:text-[#f0ede8] font-sans text-xs leading-relaxed">
                    {renderMarkdown(msg.content)}
                  </div>

                  {/* Timestamp + save */}
                  <div className="flex items-center gap-3 mt-1 px-1">
                    <span className="font-sans text-[9px] text-charcoal/25 dark:text-[#5c5a57]">
                      Ki · {relativeTime(msg.created_at)}
                    </span>
                    <button
                      onClick={() => onSaveMessage(msg.id, msg.content)}
                      disabled={isSaving}
                      className="font-sans text-[9px] text-charcoal/30 dark:text-[#5c5a57] hover:text-charcoal dark:hover:text-[#9e9b96] transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-40"
                    >
                      {isSaving ? 'saving…' : 'save to Ki'}
                    </button>
                  </div>

                  {/* Citation chips */}
                  {citations && citations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 px-1">
                      {citations.map(c => (
                        <button
                          key={c.id}
                          onClick={() => onCitationClick(c.id, c.quote)}
                          title={c.quote ?? undefined}
                          className="flex items-center gap-1.5 font-sans text-[10px] px-2 py-0.5 rounded-full border border-charcoal/12 dark:border-white/8 text-charcoal/45 dark:text-[#5c5a57] hover:border-terra/40 hover:text-terra dark:hover:text-terra dark:hover:border-terra/40 transition-all bg-transparent"
                        >
                          <span className="w-1 h-1 rounded-full bg-current flex-shrink-0" />
                          <span className="max-w-[160px] truncate">
                            {c.title ?? (c.quote ? `"${c.quote.slice(0, 32)}…"` : 'capture')}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

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

      {/* Input */}
      <div className="flex-shrink-0 px-4 pb-4 border-t border-charcoal/8 dark:border-white/7 pt-3">
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

  const [messages, setMessages] = useState<PursuitConversation[]>(initialMessages)
  const [messageCitations, setMessageCitations] = useState<Map<string, Citation[]>>(new Map())
  const [selectedCaptureId, setSelectedCaptureId] = useState<string | null>(null)
  const [highlightQuote, setHighlightQuote] = useState<string | null>(null)
  const [isThinking, setIsThinking] = useState(false)
  const [savingMessageId, setSavingMessageId] = useState<string | null>(null)

  const handleSelectCapture = (id: string, quote?: string) => {
    setSelectedCaptureId(id)
    setHighlightQuote(quote ?? null)
  }

  const handleBack = () => {
    setSelectedCaptureId(null)
    setHighlightQuote(null)
  }

  const handleSaveMessage = async (messageId: string, content: string) => {
    setSavingMessageId(messageId)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: capture, error } = await supabase
        .from('captures')
        .insert({
          user_id: user.id,
          type: 'text',
          source_type: 'distilled',
          enrichment_profile: 'personal',
          body: content,
          captured_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error || !capture) throw error ?? new Error('Insert failed')

      await supabase
        .from('capture_pursuits')
        .insert({ capture_id: capture.id, pursuit_id: pursuit.id, user_id: user.id })

    } catch (err) {
      console.error('save message error:', err)
    } finally {
      setSavingMessageId(null)
    }
  }

  const handleSendMessage = async (content: string) => {
    if (isThinking) return
    setIsThinking(true)

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
      const history = messages.map(m => ({ role: m.role, content: m.content }))

      const { data, error: fnError } = await supabase.functions.invoke('pursuit-agent', {
        body: { pursuit_id: pursuit.id, message: content, conversation_history: history },
      })

      if (fnError) throw fnError

      const agentData = data as { response: string; citations?: Citation[] }
      const kiResponse = agentData.response ?? 'Something went wrong. Please try again.'

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const [savedUser, savedKi] = await Promise.all([
          addPursuitMessage(supabase, pursuit.id, user.id, 'hero', content),
          addPursuitMessage(supabase, pursuit.id, user.id, 'ki', kiResponse),
        ])

        setMessages(prev => [
          ...prev.filter(m => m.id !== tempUserMsg.id),
          savedUser,
          savedKi,
        ])

        if (agentData.citations?.length) {
          setMessageCitations(prev => new Map(prev).set(savedKi.id, agentData.citations!))
        }
      } else {
        const tempKiMsg: PursuitConversation = {
          id: `temp-ki-${Date.now()}`,
          pursuit_id: pursuit.id,
          user_id: '',
          role: 'ki',
          content: kiResponse,
          created_at: new Date().toISOString(),
        }
        setMessages(prev => [...prev, tempKiMsg])

        if (agentData.citations?.length) {
          setMessageCitations(prev => new Map(prev).set(tempKiMsg.id, agentData.citations!))
        }
      }

    } catch (err) {
      console.error('pursuit-agent error:', err)
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id))
    } finally {
      setIsThinking(false)
    }
  }

  const color = pursuit.color ?? '#9e9b96'
  const mode = pursuit.pursuit_mode
  const modeColor = mode ? MODE_COLORS[mode] : null
  const modeLabel = mode ? MODE_LABELS[mode] : null

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
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
          aria-label="Pursuit settings"
        >
          <IoMdSettings className="size-[18px]" aria-hidden />
        </Link>
      </div>

      {/* Resizable panels */}
      <div className="flex-1 min-h-0">
        <PanelGroup
          direction="horizontal"
          autoSaveId={`pursuit-workspace-${pursuit.id}`}
          className="h-full"
        >
          <Panel defaultSize={35} minSize={20} maxSize={55} className="overflow-hidden">
            <CorpusPanel
              captures={captures}
              selectedId={selectedCaptureId}
              highlightQuote={highlightQuote}
              onSelect={handleSelectCapture}
              onBack={handleBack}
            />
          </Panel>

          <PanelResizeHandle className="w-1.5 flex-shrink-0 bg-charcoal/8 dark:bg-white/7 hover:bg-terra/30 data-[resize-handle-active]:bg-terra/50 transition-colors cursor-col-resize" />

          <Panel defaultSize={65} minSize={35} className="overflow-hidden">
            <ChatPanel
              captureCount={captures.length}
              messages={messages}
              messageCitations={messageCitations}
              isThinking={isThinking}
              savingMessageId={savingMessageId}
              onSendMessage={handleSendMessage}
              onSaveMessage={handleSaveMessage}
              onCitationClick={handleSelectCapture}
            />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  )
}
