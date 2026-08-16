'use client'

import { useState } from 'react'
import type { Artifact } from '@ki/types'

interface ArtifactPanelProps {
  artifact: Artifact | null
  onChange: (next: Artifact | null) => void
  onSave: () => void
  saving: boolean
  saved: boolean
}

/** The "Create" surface — prose only in v1. Shared between the global
 * /create page and the pursuit workspace. No kind-switch: renders prose
 * directly. Reintroducing a registry when a second kind ships is a small
 * mechanical step, not a rewrite. */
export function ArtifactPanel({ artifact, onChange, onSave, saving, saved }: ArtifactPanelProps) {
  const [copied, setCopied] = useState(false)
  const text = artifact?.text ?? ''

  const handleCopy = async () => {
    if (!text.trim()) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleChangeText = (next: string) => {
    if (!artifact) return
    onChange({ ...artifact, text: next })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-14 px-5 flex items-center justify-between border-b border-charcoal/8 dark:border-white/[0.07] shrink-0">
        <span className="font-sans text-[10px] font-semibold text-charcoal/45 dark:text-[#5c5a57] uppercase tracking-widest">
          Create
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChange(null)}
            disabled={!artifact}
            className="font-sans text-[11px] text-charcoal/35 dark:text-[#5c5a57] hover:text-charcoal dark:hover:text-[#f0ede8] transition-colors px-2 py-1 rounded-[7px] border border-charcoal/10 dark:border-white/[0.07] hover:border-charcoal/20 dark:hover:border-white/[0.13] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            clear
          </button>
          <button
            onClick={onSave}
            disabled={!text.trim() || saving}
            className={[
              'font-sans text-[11px] font-medium px-3 py-1 rounded-[7px] border transition-all cursor-pointer',
              text.trim() && !saving
                ? 'border-charcoal/20 dark:border-white/[0.13] text-charcoal/60 dark:text-[#9e9b96] hover:border-charcoal/35 dark:hover:border-white/20 hover:text-charcoal dark:hover:text-[#f0ede8]'
                : 'border-charcoal/8 dark:border-white/5 text-charcoal/25 dark:text-[#5c5a57] cursor-not-allowed',
            ].join(' ')}
          >
            {saving ? 'saving…' : saved ? 'saved' : 'save to Ki'}
          </button>
          <button
            onClick={handleCopy}
            disabled={!text.trim()}
            className={[
              'font-sans text-[11px] font-semibold px-3 py-1 rounded-[7px] transition-all cursor-pointer',
              text.trim()
                ? copied
                  ? 'bg-sage text-cream'
                  : 'bg-accent text-on-accent hover:opacity-90'
                : 'bg-charcoal/8 dark:bg-white/5 text-charcoal/25 dark:text-[#5c5a57] cursor-not-allowed',
            ].join(' ')}
          >
            {copied ? '✓ copied' : 'copy'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-5 py-4 overflow-hidden">
        <textarea
          value={text}
          onChange={e => handleChangeText(e.target.value)}
          disabled={!artifact}
          placeholder="Ki will place things here when you create something together — ask it to draft, write, or distill something. Once it does, you can edit freely."
          className="w-full h-full bg-transparent border-none outline-none font-serif text-[13px] text-charcoal dark:text-[#f0ede8] placeholder:text-charcoal/25 dark:placeholder:text-[#5c5a57] placeholder:italic resize-none leading-relaxed disabled:cursor-default"
        />
      </div>
    </div>
  )
}
