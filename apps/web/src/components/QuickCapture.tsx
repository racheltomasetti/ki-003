'use client'

import Image from 'next/image'
import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createCapture, addCaptureToProject, addTagToCapture, getTags, createTag } from '@ki/services'
import type { Project, Tag } from '@ki/types'

type VoiceState = 'idle' | 'recording' | 'processing'

/** Shared surface — logo tap target uses fixed height; editor grows from same min height */
const INPUT_SURFACE_CLASSES =
  'bg-charcoal/5 dark:bg-[#1d1b1a] border border-charcoal/10 dark:border-white/[0.08] rounded-[18px]'

/** Grows with parent flex so Quick Capture matches Projects column height */
const VOICE_TAP_SLOT = `w-full min-h-[112px] flex-1 ${INPUT_SURFACE_CLASSES}`
const EDITOR_SLOT = `w-full min-h-[112px] flex-1 min-h-0 ${INPUT_SURFACE_CLASSES} resize-y`

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

// ─── Save modal ───────────────────────────────────────────────────────────────

interface SaveModalProps {
  body: string
  projects: Project[]
  userId: string
  onSave: (opts: { title: string; body: string; projectIds: string[]; tagIds: string[] }) => Promise<void>
  onClose: () => void
  saving: boolean
}

function SaveModal({ body: initialBody, projects, userId, onSave, onClose, saving }: SaveModalProps) {
  const supabase = createClient()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState(initialBody)
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
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

  const toggleProject = (id: string) =>
    setSelectedProjectIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])

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
              Title <span className="normal-case font-normal opacity-60">(optional)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Give this thought a name…"
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

          {/* Projects */}
          {projects.length > 0 && (
            <div>
              <label className="block font-sans text-[10px] font-semibold text-charcoal/35 dark:text-[#5c5a57] uppercase tracking-widest mb-2">
                Projects
              </label>
              <div className="flex flex-wrap gap-1.5">
                {projects.map(p => {
                  const active = selectedProjectIds.includes(p.id)
                  const color = p.color ?? '#9e2a2b'
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleProject(p.id)}
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
            onClick={() => onSave({ title: title.trim(), body: body.trim(), projectIds: selectedProjectIds, tagIds: selectedTagIds })}
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
  projects: Project[]
  userId: string
}

export function QuickCapture({ projects, userId }: Props) {
  const supabase = createClient()

  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  /** Raw thought text — filled after transcription; user can edit before save */
  const [body, setBody] = useState('')
  /** After a successful transcription we show the editor; logo tap is for the next capture only */
  const [inEditor, setInEditor] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const clearCapture = useCallback(() => {
    setBody('')
    setInEditor(false)
    setError(null)
  }, [])

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
      setVoiceState('recording')
    } catch {
      setError('Microphone access is required for voice capture.')
    }
  }, [])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
  }, [])

  const handleSave = async ({ title, body, projectIds, tagIds }: {
    title: string
    body: string
    projectIds: string[]
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
        ...projectIds.map(pid => addCaptureToProject(supabase, capture.id, pid, userId)),
        ...tagIds.map(tid => addTagToCapture(supabase, capture.id, tid, userId)),
      ])

      setBody('')
      setInEditor(false)
      setShowModal(false)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const hasContent = inEditor && body.trim().length > 0

  return (
    <>
      <div className="w-full h-full min-h-0 flex flex-col bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] px-5 pt-4 pb-[14px]">

        {/* Title */}
        <div className="text-[10px] font-medium text-charcoal/40 dark:text-[#5c5a57] uppercase tracking-[0.08em] mb-3 shrink-0">
          Thought Capture
        </div>

        {/* Voice capture → editable transcript — fills space to match Projects widget */}
        <div className="flex-1 min-h-0 flex flex-col gap-2">
        {!inEditor ? (
          <button
            type="button"
            onClick={voiceState === 'recording' ? stopRecording : startRecording}
            disabled={voiceState === 'processing'}
            aria-label={voiceState === 'recording' ? 'Stop recording' : voiceState === 'processing' ? 'Transcribing' : 'Start recording'}
            className={[
              VOICE_TAP_SLOT,
              'flex items-center justify-center transition-all min-h-[112px]',
              voiceState === 'recording'
                ? '!border-terra/45 !bg-terra/8'
                : voiceState === 'processing'
                  ? '!border-charcoal/15 dark:!border-white/[0.13] cursor-wait'
                  : 'hover:border-terra/35',
            ].join(' ')}
          >
            <Image
              src="/logo-dark.png"
              alt="Ki voice capture"
              width={64}
              height={64}
              unoptimized
              quality={100}
              sizes="64px"
              className={[
                'dark:hidden block w-[64px] h-[64px] object-contain [transform-origin:50%_50%] [will-change:transform]',
                voiceState === 'recording' ? 'animate-spin' : '',
                voiceState === 'processing' ? 'animate-spin' : '',
              ].join(' ')}
              style={voiceState === 'processing' ? { animationDirection: 'reverse' } : undefined}
            />
            <Image
              src="/logo-light.png"
              alt="Ki voice capture"
              width={64}
              height={64}
              unoptimized
              quality={100}
              sizes="64px"
              className={[
                'hidden dark:block w-[64px] h-[64px] object-contain [transform-origin:50%_50%] [will-change:transform]',
                voiceState === 'recording' ? 'animate-spin' : '',
                voiceState === 'processing' ? 'animate-spin' : '',
              ].join(' ')}
              style={voiceState === 'processing' ? { animationDirection: 'reverse' } : undefined}
            />
          </button>
        ) : (
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Edit your thought…"
            className={`${EDITOR_SLOT} px-[14px] py-3 font-serif text-[13px] font-light text-charcoal dark:text-[#f0ede8] leading-relaxed outline-none focus:border-charcoal/20 dark:focus:border-white/[0.13] transition-colors placeholder:text-charcoal/30 dark:placeholder:text-[#5c5a57] placeholder:italic`}
          />
        )}

        {error && <p className="font-sans text-[11px] text-terra shrink-0">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-[10px] gap-3 shrink-0">
          <div className="min-w-0 flex items-center">
            {inEditor && voiceState === 'idle' && (
              <button
                type="button"
                onClick={clearCapture}
                className="px-4 py-[6px] rounded-[10px] font-sans text-[12px] font-medium transition-all border border-charcoal/12 dark:border-white/[0.1] text-charcoal/55 dark:text-[#9e9b96] hover:bg-charcoal/[0.06] dark:hover:bg-white/[0.05] hover:text-charcoal dark:hover:text-[#f0ede8]"
              >
                Clear
              </button>
            )}
          </div>

          {/* Save */}
          <button
            onClick={() => hasContent && setShowModal(true)}
            disabled={!hasContent}
            className={[
              'px-4 py-[6px] rounded-[10px] font-sans text-[12px] font-medium transition-all',
              hasContent
                ? 'bg-terra text-cream hover:bg-[#b83333] cursor-pointer'
                : 'bg-charcoal/8 dark:bg-white/[0.06] text-charcoal/25 dark:text-[#5c5a57] cursor-not-allowed',
            ].join(' ')}
          >
            Save
          </button>
        </div>

      </div>

      {showModal && (
        <SaveModal
          body={body.trim()}
          projects={projects}
          userId={userId}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
          saving={saving}
        />
      )}
    </>
  )
}
