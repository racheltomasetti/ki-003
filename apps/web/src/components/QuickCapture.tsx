'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createCapture, addCaptureToPursuit, addTagToCapture, getTags, createTag } from '@ki/services'
import type { Pursuit, Tag } from '@ki/types'

type VoiceState = 'idle' | 'recording' | 'processing'

/** Shared card shell — Speak chrome, Speak review, and Write all fill the same footprint */
const CARD_SHELL =
  'w-full min-h-[112px] flex-1 min-h-0 rounded-[12px] bg-charcoal/5 dark:bg-[#1d1b1a]'
const CARD_BORDER_SOLID = 'border border-terra/40 dark:border-terra/45'
const EDITOR_TEXT =
  'px-[14px] py-3 font-serif text-[13px] font-light text-charcoal dark:text-[#f0ede8] leading-relaxed outline-none resize-none'

/** Idle visualizer — eight mute dots */
const IDLE_DOTS = 8
/** Recording visualizer — nine bars with staggered heights (CSS animates scaleY) */
const WAVE_BARS = [0.42, 0.72, 0.48, 0.95, 0.55, 0.82, 0.4, 0.68, 0.5]

function formatRecordingDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

async function transcribeBlob(blob: Blob): Promise<string> {
  const formData = new FormData()
  formData.append('file', blob, 'recording.webm')
  formData.append('model', 'whisper-1')
  formData.append('language', 'en')
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}` },
    body: formData,
  })
  if (!res.ok) throw new Error(`Transcription failed: ${res.status}`)
  const data = await res.json()
  return data.text as string
}

function StopGlyph({ className }: { className?: string }) {
  return <span className={['inline-block w-[9px] h-[9px] rounded-[1px] shrink-0', className].join(' ')} aria-hidden />
}

function IdleDots() {
  return (
    <div className="flex items-center justify-center gap-[5px] h-7" aria-hidden>
      {Array.from({ length: IDLE_DOTS }).map((_, i) => (
        <span
          key={i}
          className="w-[5px] h-[5px] rounded-full bg-charcoal/20 dark:bg-white/[0.18]"
        />
      ))}
    </div>
  )
}

function WaveBars({ active }: { active: boolean }) {
  return (
    <div className="flex items-end justify-center gap-[3px] h-7" aria-hidden>
      {WAVE_BARS.map((base, i) => (
        <span
          key={i}
          className={[
            'w-[3px] rounded-full origin-bottom',
            active ? 'bg-terra animate-ki-voice-bar' : 'bg-charcoal/20 dark:bg-white/[0.18]',
          ].join(' ')}
          style={{
            height: `${Math.round(base * 28)}px`,
            animationDelay: active ? `${i * 0.08}s` : undefined,
            opacity: active ? 1 : 0.5,
          }}
        />
      ))}
    </div>
  )
}

// ─── Save modal ───────────────────────────────────────────────────────────────

interface SaveModalProps {
  body: string
  pursuits: Pursuit[]
  userId: string
  onSave: (opts: { title: string; body: string; pursuitIds: string[]; tagIds: string[] }) => Promise<void>
  onClose: () => void
  saving: boolean
}

function SaveModal({ body: initialBody, pursuits, userId, onSave, onClose, saving }: SaveModalProps) {
  const supabase = createClient()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState(initialBody)
  const [selectedPursuitIds, setSelectedPursuitIds] = useState<string[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [showTagInput, setShowTagInput] = useState(false)
  const [creatingTag, setCreatingTag] = useState(false)
  const tagInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getTags(supabase, userId).then(({ data }) => {
      if (data) setTags(data as Tag[])
    })
  }, [userId])

  useEffect(() => {
    if (showTagInput) tagInputRef.current?.focus()
  }, [showTagInput])

  const togglePursuit = (id: string) =>
    setSelectedPursuitIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])

  const toggleTag = (id: string) =>
    setSelectedTagIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])

  const handleCreateTag = async () => {
    const name = newTagName.trim()
    if (!name || creatingTag) return
    setCreatingTag(true)
    try {
      const { data: tag } = await createTag(supabase, userId, name)
      if (tag) {
        setTags(prev => [...prev, tag as Tag])
        setSelectedTagIds(prev => [...prev, (tag as Tag).id])
      }
    } catch {
      const existing = tags.find(t => t.name.toLowerCase() === name.toLowerCase())
      if (existing && !selectedTagIds.includes(existing.id)) {
        setSelectedTagIds(prev => [...prev, existing.id])
      }
    } finally {
      setNewTagName('')
      setShowTagInput(false)
      setCreatingTag(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleCreateTag()
    if (e.key === 'Escape') { setShowTagInput(false); setNewTagName('') }
  }

  const canSave = body.trim().length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-[480px] bg-cream dark:bg-[#161514] border border-charcoal/10 dark:border-white/[0.09] rounded-[18px] shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-charcoal/8 dark:border-white/[0.07] flex-shrink-0">
          <span className="font-sans text-[11px] font-semibold text-charcoal/40 dark:text-[#5c5a57] uppercase tracking-widest">Save capture</span>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full text-charcoal/35 dark:text-[#5c5a57] hover:text-charcoal dark:hover:text-[#9e9b96] hover:bg-charcoal/5 dark:hover:bg-white/5 transition-all text-[16px]"
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Title */}
          <div>
            <label className="block font-sans text-[10px] font-semibold text-charcoal/35 dark:text-[#5c5a57] uppercase tracking-widest mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder=""
              className="w-full bg-charcoal/[0.04] dark:bg-white/[0.04] border border-charcoal/8 dark:border-white/[0.07] rounded-[10px] px-3 py-2.5 font-sans text-[13px] text-charcoal dark:text-[#f0ede8] placeholder:text-charcoal/30 dark:placeholder:text-[#5c5a57] outline-none focus:border-charcoal/20 dark:focus:border-white/[0.13] transition-colors"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block font-sans text-[10px] font-semibold text-charcoal/35 dark:text-[#5c5a57] uppercase tracking-widest mb-1.5">
              Capture
            </label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={4}
              className="w-full bg-charcoal/[0.04] dark:bg-white/[0.04] border border-charcoal/8 dark:border-white/[0.07] rounded-[10px] px-3 py-2.5 font-serif text-[13px] font-light text-charcoal dark:text-[#f0ede8] placeholder:text-charcoal/30 dark:placeholder:text-[#5c5a57] leading-relaxed resize-none outline-none focus:border-charcoal/20 dark:focus:border-white/[0.13] transition-colors"
            />
          </div>

          {/* Pursuits */}
          {pursuits.length > 0 && (
            <div>
              <label className="block font-sans text-[10px] font-semibold text-charcoal/35 dark:text-[#5c5a57] uppercase tracking-widest mb-2">
                Pursuits
              </label>
              <div className="flex flex-wrap gap-1.5">
                {pursuits.map(p => {
                  const active = selectedPursuitIds.includes(p.id)
                  const color = p.color ?? '#9e2a2b'
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePursuit(p.id)}
                      className={[
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full font-sans text-[12px] border transition-all',
                        active
                          ? 'border-transparent text-cream'
                          : 'border-charcoal/10 dark:border-white/[0.08] text-charcoal/55 dark:text-[#9e9b96] bg-transparent hover:border-charcoal/20 dark:hover:border-white/[0.15]',
                      ].join(' ')}
                      style={active ? { backgroundColor: color } : {}}
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: active ? '#f6f1e6' : color }} />
                      {p.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Tags */}
          <div>
            <label className="block font-sans text-[10px] font-semibold text-charcoal/35 dark:text-[#5c5a57] uppercase tracking-widest mb-2">
              Tags
            </label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map(tag => {
                const active = selectedTagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={[
                      'px-3 py-1.5 rounded-full font-sans text-[12px] border transition-all',
                      active
                        ? 'bg-terra border-terra text-cream'
                        : 'border-charcoal/10 dark:border-white/[0.08] text-charcoal/55 dark:text-[#9e9b96] hover:border-charcoal/20 dark:hover:border-white/[0.15]',
                    ].join(' ')}
                  >
                    {tag.name}
                  </button>
                )
              })}

              {showTagInput ? (
                <input
                  ref={tagInputRef}
                  type="text"
                  value={newTagName}
                  onChange={e => setNewTagName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={() => { if (!newTagName.trim()) { setShowTagInput(false) } }}
                  placeholder="tag name"
                  className="px-3 py-1.5 rounded-full font-sans text-[12px] border border-charcoal/20 dark:border-white/[0.15] bg-charcoal/[0.04] dark:bg-white/[0.05] text-charcoal dark:text-[#f0ede8] placeholder:text-charcoal/30 dark:placeholder:text-[#5c5a57] outline-none w-[90px]"
                />
              ) : (
                <button
                  onClick={() => setShowTagInput(true)}
                  className="px-3 py-1.5 rounded-full font-sans text-[12px] border border-dashed border-charcoal/15 dark:border-white/[0.08] text-charcoal/35 dark:text-[#5c5a57] hover:border-charcoal/25 dark:hover:border-white/[0.15] hover:text-charcoal/55 dark:hover:text-[#9e9b96] transition-all"
                >
                  + tag
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-charcoal/8 dark:border-white/[0.07] flex-shrink-0">
          <button
            onClick={() => onSave({ title: title.trim(), body: body.trim(), pursuitIds: selectedPursuitIds, tagIds: selectedTagIds })}
            disabled={!canSave || saving}
            className={[
              'w-full py-3 rounded-[12px] font-sans text-[13px] font-semibold transition-all',
              canSave && !saving
                ? 'bg-terra text-cream hover:bg-[#b83333]'
                : 'bg-charcoal/8 dark:bg-white/[0.06] text-charcoal/30 dark:text-[#5c5a57] cursor-not-allowed',
            ].join(' ')}
          >
            {saving ? 'Saving…' : 'Save to Ki'}
          </button>
        </div>

      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  pursuits: Pursuit[]
  userId: string
}

export function QuickCapture({ pursuits, userId }: Props) {
  const supabase = createClient()

  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice')
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  /** Raw thought text — filled after transcription; user can edit before save */
  const [body, setBody] = useState('')
  /** After a successful transcription we show the review surface */
  const [inEditor, setInEditor] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null)
  const [recordingSeconds, setRecordingSeconds] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const discardCapture = useCallback(() => {
    setBody('')
    setInEditor(false)
    setError(null)
    setRecordingStartedAt(null)
    setRecordingSeconds(0)
  }, [])

  useEffect(() => {
    if (voiceState !== 'recording' || recordingStartedAt === null) return
    const tick = () => {
      setRecordingSeconds(Math.floor((Date.now() - recordingStartedAt) / 1000))
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [voiceState, recordingStartedAt])

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setVoiceState('processing')
        try {
          const t = await transcribeBlob(blob)
          setBody(t)
          setInEditor(true)
        } catch {
          setError('Transcription failed. Please try again.')
        } finally {
          setVoiceState('idle')
        }
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setRecordingStartedAt(Date.now())
      setRecordingSeconds(0)
      setVoiceState('recording')
    } catch {
      setError('Microphone access is required for voice capture.')
    }
  }, [])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    setRecordingStartedAt(null)
  }, [])

  const handleSave = async ({ title, body, pursuitIds, tagIds }: {
    title: string
    body: string
    pursuitIds: string[]
    tagIds: string[]
  }) => {
    setSaving(true)
    try {
      const capture = await createCapture(supabase, {
        user_id: userId,
        type: 'voice',
        source_type: 'voice',
        enrichment_profile: 'personal',
        title: title || null,
        body,
      })

      await Promise.all([
        ...pursuitIds.map(pid => addCaptureToPursuit(supabase, capture.id, pid, userId)),
        ...tagIds.map(tid => addTagToCapture(supabase, capture.id, tid, userId)),
      ])

      setBody('')
      setInEditor(false)
      setInputMode('voice')
      setShowModal(false)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const hasContent = body.trim().length > 0
  const showReview = inputMode === 'voice' && inEditor
  const showWrite = inputMode === 'text'
  const showVoiceChrome = inputMode === 'voice' && !inEditor

  const switchToSpeak = () => {
    setInputMode('voice')
    if (body.trim()) setInEditor(true)
  }

  const switchToWrite = () => {
    if (voiceState === 'recording') stopRecording()
    setInputMode('text')
  }

  const recordActionLabel =
    voiceState === 'recording'
      ? 'Stop & transcribe'
      : voiceState === 'processing'
        ? 'Transcribing…'
        : 'Start recording'

  return (
    <>
      <div className="w-full h-full min-h-0 flex flex-col bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] px-5 pt-4 pb-[14px]">

        {/* Title + Speak / Write toggle */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="text-[10px] font-medium text-charcoal/40 dark:text-[#5c5a57] uppercase tracking-[0.08em]">
            Thought Capture
          </div>
          <div className="flex items-center gap-0.5 bg-charcoal/[0.05] dark:bg-white/[0.05] rounded-full p-0.5">
            <button
              type="button"
              onClick={switchToSpeak}
              className={[
                'px-2.5 py-[3px] rounded-full font-sans text-[11px] font-semibold transition-all',
                inputMode === 'voice'
                  ? 'bg-terra text-cream'
                  : 'text-charcoal/40 dark:text-[#5c5a57] hover:text-charcoal/60 dark:hover:text-[#9e9b96]',
              ].join(' ')}
            >
              Speak
            </button>
            <button
              type="button"
              onClick={switchToWrite}
              className={[
                'px-2.5 py-[3px] rounded-full font-sans text-[11px] font-semibold transition-all',
                inputMode === 'text'
                  ? 'bg-terra text-cream'
                  : 'text-charcoal/40 dark:text-[#5c5a57] hover:text-charcoal/60 dark:hover:text-[#9e9b96]',
              ].join(' ')}
            >
              Write
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col gap-2">
          {showVoiceChrome && (
            <div
              className={[
                CARD_SHELL,
                voiceState === 'recording'
                  ? CARD_BORDER_SOLID
                  : 'border border-charcoal/10 dark:border-white/[0.08]',
                'flex flex-col items-center justify-center gap-3 px-4 py-5',
              ].join(' ')}
            >
              {voiceState === 'recording' ? (
                <WaveBars active />
              ) : voiceState === 'processing' ? (
                <WaveBars active={false} />
              ) : (
                <IdleDots />
              )}

              <button
                type="button"
                onClick={voiceState === 'recording' ? stopRecording : startRecording}
                disabled={voiceState === 'processing'}
                aria-label={recordActionLabel}
                className={[
                  'inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-sans text-[13px] font-semibold transition-all border',
                  voiceState === 'recording'
                    ? 'border-terra text-terra bg-transparent hover:bg-terra/8'
                    : voiceState === 'processing'
                      ? 'border-charcoal/15 dark:border-white/[0.12] text-charcoal/40 dark:text-[#5c5a57] cursor-wait'
                      : 'border-charcoal/20 dark:border-white/[0.16] text-charcoal dark:text-[#f0ede8] bg-transparent hover:border-terra/50',
                ].join(' ')}
              >
                <StopGlyph
                  className={
                    voiceState === 'recording'
                      ? 'bg-terra'
                      : voiceState === 'processing'
                        ? 'bg-charcoal/25 dark:bg-white/25'
                        : 'bg-charcoal dark:bg-[#f0ede8]'
                  }
                />
                {recordActionLabel}
              </button>

              {voiceState === 'recording' && (
                <p className="font-sans text-[12px] font-medium tabular-nums text-charcoal/50 dark:text-[#9e9b96]">
                  {formatRecordingDuration(recordingSeconds)}
                </p>
              )}
            </div>
          )}

          {showReview && (
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              className={[
                CARD_SHELL,
                'border border-dashed border-charcoal/15 dark:border-white/[0.12]',
                EDITOR_TEXT,
                'italic focus:border-charcoal/25 dark:focus:border-white/[0.2] transition-colors',
              ].join(' ')}
            />
          )}

          {showWrite && (
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="What's on your mind..."
              className={[
                CARD_SHELL,
                'border border-charcoal/10 dark:border-white/[0.08]',
                EDITOR_TEXT,
                'focus:border-terra/40 dark:focus:border-terra/45 transition-colors',
                'placeholder:text-charcoal/30 dark:placeholder:text-[#5c5a57] placeholder:italic placeholder:font-serif',
              ].join(' ')}
            />
          )}

          {error && <p className="font-sans text-[11px] text-terra shrink-0">{error}</p>}
        </div>

        {/* Footer — only when reviewing or writing */}
        {(showReview || showWrite) && (
          <div className="flex items-center justify-end mt-[10px] gap-2 shrink-0">
            {hasContent && (
              <button
                type="button"
                onClick={discardCapture}
                className="px-4 py-[6px] rounded-[10px] font-sans text-[12px] font-medium transition-all border border-charcoal/12 dark:border-white/[0.1] text-charcoal/55 dark:text-[#9e9b96] hover:bg-charcoal/[0.06] dark:hover:bg-white/[0.05] hover:text-charcoal dark:hover:text-[#f0ede8]"
              >
                Discard
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowModal(true)}
              disabled={!hasContent}
              className={[
                'px-4 py-[6px] rounded-[10px] font-sans text-[12px] font-semibold transition-all',
                hasContent
                  ? 'bg-terra text-cream hover:bg-[#b83333] cursor-pointer'
                  : 'bg-terra/40 text-cream/70 cursor-not-allowed',
              ].join(' ')}
            >
              Capture
            </button>
          </div>
        )}

      </div>

      {showModal && (
        <SaveModal
          body={body.trim()}
          pursuits={pursuits}
          userId={userId}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
          saving={saving}
        />
      )}
    </>
  )
}
