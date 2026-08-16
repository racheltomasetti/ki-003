'use client'

import { useEffect, useRef, useState } from 'react'
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import { createClient } from '@/lib/supabase/client'
import { saveArtifactCapture } from '@ki/services'
import { ArtifactPanel } from '@/components/ArtifactPanel'
import type { Artifact } from '@ki/types'

// ─── Types ────────────────────────────────────────────────────────────────────
// Mirrors apps/web/src/app/(app)/explore/page.tsx's chat shapes exactly.

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

const PROMPT_CHIPS = [
  'draft something from what I\'ve been circling',
  'distill this conversation into a paragraph',
  'write me a fresh take on this',
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreatePage() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [supabase])

  // ── Chat state ─────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([{
    role: 'ki',
    content: 'This is Create — talk with me and ask for something concrete (a paragraph, a stance, a draft) and I\'ll place it in the panel alongside us.',
  }])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [apiHistory, setApiHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Artifact state ─────────────────────────────────────────────────────────
  const [artifact, setArtifact] = useState<Artifact | null>(null)
  const [savingArtifact, setSavingArtifact] = useState(false)
  const [artifactSaved, setArtifactSaved] = useState(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    setMessages(prev => [...prev, { role: 'hero', content: trimmed }])
    setInput('')
    setSending(true)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    try {
      const { data, error } = await supabase.functions.invoke('chat-with-ki', {
        body: {
          message: trimmed,
          history: apiHistory,
          current_artifact: artifact ? { title: artifact.title, text: artifact.text } : null,
        },
      })
      if (error) throw error

      const responseText: string = data.response ?? 'Something went wrong.'
      const citations: Citation[] = data.citations ?? []
      const proposedArtifact: Artifact | undefined = data.artifact

      setMessages(prev => [...prev, { role: 'ki', content: responseText, citations }])
      setApiHistory(prev => [
        ...prev,
        { role: 'user', content: trimmed },
        { role: 'assistant', content: responseText },
      ])

      if (proposedArtifact) {
        setArtifact(proposedArtifact)
        setArtifactSaved(false)
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

  const handleSaveArtifact = async () => {
    if (!artifact || !userId) return
    setSavingArtifact(true)
    try {
      await saveArtifactCapture(supabase, {
        userId,
        body: artifact.text,
        title: artifact.title,
        referencedCaptureIds: artifact.referenced_capture_ids,
      })
      setArtifactSaved(true)
    } finally {
      setSavingArtifact(false)
    }
  }

  return (
    <div className="flex-1 min-h-0 bg-cream dark:bg-[#0f0e0e]">
      <PanelGroup direction="horizontal" autoSaveId="create-workspace" className="h-full">
        <Panel defaultSize={60} minSize={35} className="overflow-hidden">
          <div className="h-full flex flex-col">

            {/* Header */}
            <div className="px-5 py-[13px] border-b border-charcoal/8 dark:border-white/[0.07] shrink-0">
              <div className="font-sans text-[13px] font-medium text-charcoal dark:text-[#f0ede8]">Create</div>
              <div className="font-sans text-[11px] text-charcoal/40 dark:text-[#5c5a57] mt-[1px]">full corpus in context</div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-[9px]">
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
                            <span
                              key={c.id}
                              className="inline-flex items-center gap-1 text-[10px] px-2 py-[2px] rounded-full border border-charcoal/10 dark:border-white/[0.08] text-charcoal/45 dark:text-[#5c5a57] bg-charcoal/[0.02] dark:bg-white/[0.03]"
                            >
                              <span className="w-[4px] h-[4px] rounded-full bg-pacific shrink-0" />
                              {c.title ?? new Date(c.captured_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="text-[10px] text-charcoal/35 dark:text-[#5c5a57] mt-[3px] px-[3px]">Ki</div>
                    </>
                  ) : (
                    <div className="bg-accent/10 border border-accent/20 rounded-[12px] rounded-tr-[2px] px-3 py-[9px] text-[12px] text-charcoal dark:text-[#f0ede8] leading-relaxed whitespace-pre-wrap">
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
            <div className="px-4 py-[10px] border-t border-charcoal/8 dark:border-white/[0.07] shrink-0">
              <div className="flex gap-[5px] flex-wrap mb-[7px]">
                {PROMPT_CHIPS.map(chip => (
                  <button
                    key={chip}
                    onClick={() => send(chip)}
                    disabled={sending}
                    className="font-sans text-[10px] px-[9px] py-[3px] border border-charcoal/8 dark:border-white/[0.07] rounded-full text-charcoal/40 dark:text-[#5c5a57] bg-transparent cursor-pointer hover:border-accent hover:text-accent hover:bg-accent/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
                  placeholder="Ask Ki to draft, write, or distill something…"
                  rows={1}
                />
                <button
                  onClick={() => send(input)}
                  disabled={sending || !input.trim()}
                  className="w-[26px] h-[26px] rounded-[7px] bg-accent border-none text-on-accent font-sans text-[12px] cursor-pointer flex items-center justify-center shrink-0 hover:opacity-90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ↑
                </button>
              </div>
            </div>
          </div>
        </Panel>

        <PanelResizeHandle className="w-1.5 flex-shrink-0 bg-charcoal/8 dark:bg-white/7 hover:bg-accent/30 data-[resize-handle-active]:bg-accent/50 transition-colors cursor-col-resize" />

        <Panel defaultSize={40} minSize={25} className="overflow-hidden">
          <ArtifactPanel
            artifact={artifact}
            onChange={next => { setArtifact(next); setArtifactSaved(false) }}
            onSave={handleSaveArtifact}
            saving={savingArtifact}
            saved={artifactSaved}
          />
        </Panel>
      </PanelGroup>
    </div>
  )
}
