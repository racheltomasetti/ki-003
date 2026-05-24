'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Prompt chips ─────────────────────────────────────────────────────────────

const PROMPT_CHIPS = [
  'what am I most focused on?',
  'what patterns do you see?',
  'what am I avoiding?',
]

// ─── Citation chip ────────────────────────────────────────────────────────────

function CitationChip({ citation }: { citation: Citation }) {
  const label = citation.title ?? new Date(citation.captured_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  })
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-[2px] rounded-full border border-charcoal/10 dark:border-white/[0.08] text-charcoal/45 dark:text-[#5c5a57] bg-charcoal/[0.02] dark:bg-white/[0.03]">
      <span className="w-[4px] h-[4px] rounded-full bg-pacific shrink-0" />
      {label}
    </span>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isKi = message.role === 'ki'

  if (isKi) {
    return (
      <div className="self-start max-w-full">
        <div className="bg-charcoal/[0.04] dark:bg-[#1d1b1a] border border-charcoal/8 dark:border-white/[0.07] rounded-[12px] rounded-tl-[2px] px-3 py-[9px] text-[12px] text-charcoal dark:text-[#f0ede8] leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>
        {message.citations && message.citations.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-[5px] px-[2px]">
            {message.citations.map(c => (
              <CitationChip key={c.id} citation={c} />
            ))}
          </div>
        )}
        <div className="text-[10px] text-charcoal/35 dark:text-[#5c5a57] mt-[3px] px-[3px]">Ki</div>
      </div>
    )
  }

  return (
    <div className="self-end max-w-[85%]">
      <div className="bg-terra/10 border border-terra/20 rounded-[12px] rounded-tr-[2px] px-3 py-[9px] text-[12px] text-charcoal dark:text-[#f0ede8] leading-relaxed whitespace-pre-wrap">
        {message.content}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'ki',
      content: 'Your full corpus is loaded. Ask me anything about what you have been thinking, what patterns I notice, or what you seem most uncertain about. I only know what you have given me.',
    },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // History for the API — excludes the initial hardcoded welcome message
  const [apiHistory, setApiHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    const heroMessage: Message = { role: 'hero', content: trimmed }
    setMessages(prev => [...prev, heroMessage])
    setInput('')
    setSending(true)

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      const { data, error } = await supabase.functions.invoke('chat-with-ki', {
        body: { message: trimmed, history: apiHistory },
      })

      if (error) throw error

      const responseText: string = data.response ?? 'Something went wrong.'
      const citations: Citation[] = data.citations ?? []

      const kiMessage: Message = { role: 'ki', content: responseText, citations }
      setMessages(prev => [...prev, kiMessage])

      // Update API history
      setApiHistory(prev => [
        ...prev,
        { role: 'user', content: trimmed },
        { role: 'assistant', content: responseText },
      ])
    } catch {
      setMessages(prev => [...prev, {
        role: 'ki',
        content: 'Something went wrong. Please try again.',
      }])
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

  return (
    <div className="flex h-full overflow-hidden">

      {/* Left — patterns */}
      <div className="flex-1 overflow-y-auto px-7 py-[26px] border-r border-charcoal/8 dark:border-white/[0.07] min-w-0">

        <div className="mb-[22px]">
          <div className="font-serif text-[20px] font-light text-charcoal dark:text-[#f0ede8] mb-1">Your mind, explored</div>
          <div className="font-sans text-[12px] text-charcoal/40 dark:text-[#5c5a57]">
            Patterns and connections across everything you have captured
          </div>
        </div>

        <div className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] p-[18px] mb-[14px]">
          <div className="font-serif text-[16px] font-light text-charcoal dark:text-[#f0ede8] mb-[3px]">Recurring themes</div>
          <div className="font-sans text-[12px] text-charcoal/40 dark:text-[#5c5a57] mb-3">
            What your mind keeps returning to across all captures
          </div>
          <p className="font-serif text-[13px] font-light italic text-charcoal/35 dark:text-[#5c5a57]">
            Themes appear as your corpus grows.
          </p>
        </div>

        <div className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] p-[18px]">
          <div className="font-serif text-[16px] font-light text-charcoal dark:text-[#f0ede8] mb-[3px]">Questions you keep raising</div>
          <div className="font-sans text-[12px] text-charcoal/40 dark:text-[#5c5a57] mb-3">
            Open questions surfaced across your captures
          </div>
          <p className="font-serif text-[13px] font-light italic text-charcoal/35 dark:text-[#5c5a57]">
            Questions emerge as Ki processes your captures.
          </p>
        </div>

      </div>

      {/* Right — Ki corpus chat */}
      <div className="w-[380px] shrink-0 bg-charcoal/[0.02] dark:bg-[#161514] flex flex-col">

        {/* Header */}
        <div className="px-4 py-[13px] border-b border-charcoal/8 dark:border-white/[0.07] flex items-center justify-between shrink-0">
          <div>
            <div className="font-sans text-[13px] font-medium text-charcoal dark:text-[#f0ede8]">Chat with Ki</div>
            <div className="font-sans text-[11px] text-charcoal/40 dark:text-[#5c5a57] mt-[1px]">full corpus in context</div>
          </div>
          <div className="flex items-center gap-1 font-sans text-[10px] text-charcoal/40 dark:text-[#5c5a57] bg-charcoal/[0.04] dark:bg-[#1d1b1a] px-[9px] py-[3px] rounded-full border border-charcoal/8 dark:border-white/[0.07]">
            <span className="w-[5px] h-[5px] rounded-full bg-sage" />
            all captures
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-[9px]">
          {messages.map((m, i) => (
            <MessageBubble key={i} message={m} />
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
              placeholder="Ask Ki anything across all captures..."
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
    </div>
  )
}
