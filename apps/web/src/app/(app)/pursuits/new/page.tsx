'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createPursuit } from '@ki/services'
import type { PursuitMode } from '@ki/types'

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  {
    key: 'intro',
    type: 'intro',
    question: 'Start a pursuit',
    paragraphs: [
      'A pursuit is not a project with a deadline. It is something you are carrying — a question you are living, a thing you are building, a direction you are moving in.',
      'At its center is a core question: the guiding light that gives the pursuit its meaning and makes new information relevant or not.',
      'You carry a maximum of three active pursuits at any time. Three is enough to hold the complexity of a life in motion — not so many that attention fragments and nothing receives what it deserves. Constraints create focus. Focus creates depth.',
    ],
  },
  {
    key: 'name',
    type: 'input',
    question: 'What are you carrying?',
    hint: 'Give this pursuit a name you will recognize when you return to it — short, honest, yours.',
    placeholder: 'Ki',
    required: true,
  },
  {
    key: 'description',
    type: 'textarea',
    question: 'What is this, in your own words?',
    hint: 'Not a pitch. Just enough context that future-you remembers why this matters and what you are moving toward.',
    placeholder: 'I am trying to understand what software feels like when it is genuinely alive — responsive, intentional, and growing with the person using it.',
    required: true,
  },
  {
    key: 'core_question',
    type: 'textarea',
    question: 'What is the core question?',
    hint: 'This is the antenna. Ki uses it to know what belongs here — what to surface, connect, and return to as your thinking deepens.',
    placeholder: 'What does it look like to build software that is deeply alive?',
    examples: [
      'What does it look like to build software that is deeply alive?',
      'How do I become someone who follows through?',
      'What kind of creator do I actually want to be?',
    ],
    required: true,
  },
  {
    key: 'pursuit_mode',
    type: 'chips',
    question: 'How are you moving through this right now?',
    hint: 'This is a snapshot, not a verdict. It can change as the pursuit deepens.',
    required: true,
    options: [
      { value: 'building',     label: 'Building',     description: 'Making something concrete' },
      { value: 'exploring',    label: 'Exploring',    description: 'Following threads, gathering signal' },
      { value: 'becoming',     label: 'Becoming',     description: 'Growing into who you are reaching for' },
      { value: 'figuring_out', label: 'Figuring out', description: 'Still finding the shape of the question' },
    ],
  },
] as const

type StepKey = 'name' | 'description' | 'core_question' | 'pursuit_mode'

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
    if (current.type === 'intro') return true
    if (current.type === 'chips') return answers.pursuit_mode !== ''
    if (!('required' in current) || !current.required) return true
    const answer = answers[current.key as StepKey]
    return typeof answer === 'string' && answer.trim().length > 0
  })()

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
        setError('You already have 3 active pursuits. Archive one before starting another.')
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
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Something went wrong'
      setError(message)
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

          <p className="font-sans text-[10px] font-semibold text-charcoal/30 dark:text-cream/30 uppercase tracking-[0.12em] mb-5">
            New pursuit · {step + 1} of {STEPS.length}
          </p>

          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-charcoal dark:text-cream leading-snug mb-4">
            {current.question}
          </h1>

          {/* Intro — pursuit philosophy */}
          {current.type === 'intro' && 'paragraphs' in current && (
            <div className="space-y-4 mb-2">
              {current.paragraphs.map((para, i) => (
                <p
                  key={i}
                  className={[
                    'font-serif leading-relaxed',
                    i === current.paragraphs.length - 1
                      ? 'text-[15px] text-charcoal/55 dark:text-cream/55 italic border-l-2 border-terra/30 pl-4'
                      : 'text-[16px] text-charcoal/70 dark:text-cream/70',
                  ].join(' ')}
                >
                  {para}
                </p>
              ))}
            </div>
          )}

          {/* Step hint */}
          {'hint' in current && current.hint && (
            <p className="font-sans text-sm text-charcoal/45 dark:text-cream/45 leading-relaxed mb-8">
              {current.hint}
            </p>
          )}

          {/* Name */}
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
              placeholder={'placeholder' in current ? current.placeholder : ''}
              className="w-full font-serif text-2xl text-charcoal dark:text-cream bg-transparent border-b-2 border-charcoal/20 dark:border-cream/20 focus:border-terra outline-none leading-relaxed placeholder:text-charcoal/20 dark:placeholder:text-cream/20 transition-colors pb-2"
            />
          )}

          {/* Textarea fields */}
          {current.type === 'textarea' && (
            <>
              {'examples' in current && current.examples && (
                <div className="mb-6 rounded-[14px] border border-charcoal/8 dark:border-cream/10 bg-charcoal/[0.03] dark:bg-white/[0.03] px-4 py-3">
                  <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.1em] text-charcoal/35 dark:text-cream/35 mb-2">
                    Examples
                  </p>
                  <ul className="space-y-1.5">
                    {current.examples.map((ex) => (
                      <li
                        key={ex}
                        className="font-serif text-[13px] italic text-charcoal/50 dark:text-cream/50 leading-snug"
                      >
                        {ex}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <textarea
                ref={textareaRef}
                value={answers[current.key as StepKey] as string}
                onChange={(e) => handleTextareaChange(e, current.key)}
                onKeyDown={handleTextareaKeyDown}
                placeholder={'placeholder' in current ? current.placeholder : ''}
                rows={4}
                className="w-full font-serif text-xl text-charcoal dark:text-cream bg-transparent border-b-2 border-charcoal/20 dark:border-cream/20 focus:border-terra outline-none resize-none leading-relaxed placeholder:text-charcoal/20 dark:placeholder:text-cream/20 transition-colors pb-3"
              />
            </>
          )}

          {/* Mode chips */}
          {current.type === 'chips' && 'options' in current && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {current.options.map((opt) => {
                const selected = answers.pursuit_mode === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setAnswers((prev) => ({
                        ...prev,
                        pursuit_mode: selected ? '' : opt.value as PursuitMode,
                      }))
                    }
                    className={[
                      'text-left px-5 py-4 rounded-xl border transition-all',
                      selected
                        ? 'bg-terra border-terra text-cream'
                        : 'border-charcoal/20 dark:border-cream/20 text-charcoal dark:text-cream hover:border-charcoal/40 dark:hover:border-cream/40',
                    ].join(' ')}
                  >
                    <span className="block font-sans text-sm font-semibold">{opt.label}</span>
                    <span
                      className={[
                        'block font-sans text-[12px] mt-1 leading-snug',
                        selected ? 'text-cream/80' : 'text-charcoal/45 dark:text-cream/45',
                      ].join(' ')}
                    >
                      {opt.description}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {error && (
            <p className="font-sans text-sm text-terra mt-4">{error}</p>
          )}

          <div className="flex items-center justify-between mt-12">
            <p className="font-sans text-xs text-charcoal/25 dark:text-cream/25">
              {(current.type === 'textarea' || current.type === 'input') && canAdvance && '⌘↵ to continue'}
            </p>

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
              {submitting
                ? 'Creating…'
                : current.type === 'intro'
                  ? 'Begin'
                  : isLast
                    ? 'Create pursuit'
                    : 'Continue'}
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
  )
}
