'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createPursuit } from '@ki/services'
import type { PursuitMode } from '@ki/types'

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  {
    key: 'name',
    question: 'Name it.',
    hint: '',
    placeholder: '',
    required: true,
    type: 'input',
  },
  {
    key: 'description',
    question: 'Describe it.',
    hint: '',
    placeholder: '',
    required: true,
    type: 'textarea',
  },
  {
    key: 'core_question',
    question: "What's the question you keep coming back to?",
    hint: '',
    placeholder: '',
    required: true,
    type: 'textarea',
  },
  {
    key: 'pursuit_mode',
    question: 'How are you moving through this right now?',
    hint: '',
    required: true,
    type: 'chips',
    options: [
      { value: 'building',     label: 'Building' },
      { value: 'exploring',    label: 'Exploring' },
      { value: 'becoming',     label: 'Becoming' },
      { value: 'figuring_out', label: 'Figuring out' },
    ],
  },
] as const

type StepKey = typeof STEPS[number]['key']

type Answers = {
  name: string
  description: string
  core_question: string
  pursuit_mode: PursuitMode | ''
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NewPursuitPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answers>({
    name: '',
    description: '',
    core_question: '',
    pursuit_mode: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nameInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  const canAdvance = (() => {
    if (!current.required) return true
    const answer = answers[current.key as StepKey]
    return typeof answer === 'string' && answer.trim().length > 0
  })()

  // Focus on step change
  useEffect(() => {
    if (current.type === 'input') {
      nameInputRef.current?.focus()
    } else if (current.type === 'textarea') {
      textareaRef.current?.focus()
    }
  }, [step, current.type])

  const advance = () => {
    if (!canAdvance) return
    if (isLast) handleSubmit()
    else setStep((s) => s + 1)
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>, key: string) => {
    setAnswers((prev) => ({ ...prev, [key]: e.target.value }))
    e.target.style.height = 'auto'
    e.target.style.height = `${e.target.scrollHeight}px`
  }

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      if (canAdvance) advance()
    }
  }

  const handleSubmit = async () => {
    if (submitting) return
    setSubmitting(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: existing } = await supabase
        .from('pursuits')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
      if ((existing ?? []).length >= 3) {
        setError('You have 3 active pursuits. Archive one to create a new one.')
        setSubmitting(false)
        return
      }

      const pursuit = await createPursuit(supabase, user.id, {
        name: answers.name.trim(),
        description: answers.description.trim() || undefined,
        core_question: answers.core_question.trim() || undefined,
        pursuit_mode: answers.pursuit_mode || undefined,
        status: 'active',
      })

      router.push(`/pursuits/${pursuit.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f1e6] dark:bg-[#1a1a1a] flex flex-col">

      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-6">
        <button
          onClick={() => step === 0 ? router.push('/home') : setStep((s) => s - 1)}
          className="flex items-center gap-2 font-sans text-sm text-charcoal/40 dark:text-cream/40 hover:text-charcoal dark:hover:text-cream transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          {step === 0 ? 'Home' : 'Back'}
        </button>

        {/* Step dots */}
        <div className="flex items-center gap-2">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={[
                'h-1.5 rounded-full transition-all duration-300',
                i === step
                  ? 'w-4 bg-terra'
                  : i < step
                  ? 'w-1.5 bg-charcoal/30 dark:bg-cream/30'
                  : 'w-1.5 bg-charcoal/15 dark:bg-cream/15',
              ].join(' ')}
            />
          ))}
        </div>

        <div className="w-16" />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-24">
        <div className="w-full max-w-2xl">

          {/* Optional badge */}
          {!current.required && (
            <p className="font-sans text-xs font-semibold text-charcoal/30 dark:text-cream/30 uppercase tracking-widest mb-6">
              Optional
            </p>
          )}

          {/* Question */}
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-charcoal dark:text-cream leading-snug mb-3">
            {current.question}
          </h1>

          {/* Hint */}
          <p className="font-sans text-sm text-charcoal/45 dark:text-cream/45 leading-relaxed mb-10">
            {current.hint}
          </p>

          {/* Input — name */}
          {current.type === 'input' && (
            <input
              ref={nameInputRef}
              type="text"
              value={answers.name}
              onChange={(e) => setAnswers((prev) => ({ ...prev, name: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canAdvance) {
                  e.preventDefault()
                  advance()
                }
              }}
              placeholder=""
              className="w-full font-serif text-2xl text-charcoal dark:text-cream bg-transparent border-b-2 border-charcoal/20 dark:border-cream/20 focus:border-terra outline-none leading-relaxed placeholder:text-charcoal/20 dark:placeholder:text-cream/20 transition-colors pb-2"
            />
          )}

          {/* Textarea — single contextual question */}
          {current.type === 'textarea' && (
            <textarea
              ref={textareaRef}
              value={answers[current.key as StepKey] as string}
              onChange={(e) => handleTextareaChange(e, current.key)}
              onKeyDown={handleTextareaKeyDown}
              placeholder={'placeholder' in current ? current.placeholder : ''}
              rows={4}
              className="w-full font-serif text-xl text-charcoal dark:text-cream bg-transparent border-b-2 border-charcoal/20 dark:border-cream/20 focus:border-terra outline-none resize-none leading-relaxed placeholder:text-charcoal/20 dark:placeholder:text-cream/20 transition-colors pb-3"
            />
          )}

          {/* Chips — pursuit mode */}
          {current.type === 'chips' && 'options' in current && (
            <div className="flex flex-wrap gap-3">
              {current.options.map((opt) => {
                const selected = answers.pursuit_mode === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() =>
                      setAnswers((prev) => ({
                        ...prev,
                        pursuit_mode: selected ? '' : opt.value as PursuitMode,
                      }))
                    }
                    className={[
                      'px-5 py-3 rounded-xl border font-sans text-sm font-medium transition-all',
                      selected
                        ? 'bg-terra border-terra text-cream'
                        : 'border-charcoal/20 dark:border-cream/20 text-charcoal/70 dark:text-cream/70 hover:border-charcoal/40 dark:hover:border-cream/40 hover:text-charcoal dark:hover:text-cream',
                    ].join(' ')}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="font-sans text-sm text-terra mt-4">{error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between mt-12">
            <p className="font-sans text-xs text-charcoal/25 dark:text-cream/25">
              {(current.type === 'textarea' || current.type === 'input') && canAdvance && '⌘↵ to continue'}
            </p>

            <div className="flex items-center gap-4">
              {!current.required && !isLast && (
                <button
                  onClick={() => setStep((s) => s + 1)}
                  className="font-sans text-sm text-charcoal/40 dark:text-cream/40 hover:text-charcoal dark:hover:text-cream transition-colors"
                >
                  Skip
                </button>
              )}

              <button
                onClick={advance}
                disabled={!canAdvance || submitting}
                className={[
                  'flex items-center gap-2 px-6 py-3 rounded-xl font-sans text-sm font-semibold transition-all',
                  canAdvance && !submitting
                    ? 'bg-terra text-cream hover:bg-terra/90'
                    : 'bg-charcoal/10 dark:bg-cream/10 text-charcoal/30 dark:text-cream/30 cursor-not-allowed',
                ].join(' ')}
              >
                {submitting ? 'Creating…' : isLast ? 'Create pursuit' : 'Continue'}
                {!submitting && (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

        </div>
      </div>

    </div>
  )
}
