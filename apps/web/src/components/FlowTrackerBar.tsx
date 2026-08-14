'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getRunningFlow, startFlow, endFlow } from '@ki/services'

const ENERGY_LEVELS = [1, 2, 3, 4, 5]

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}

/** Persistent start/stop timer bar — visible on every (app) page regardless
 * of sidebar collapse state. Elapsed time is always derived from the
 * flow's started_at, never accumulated client-side, so it survives a
 * backgrounded/reloaded tab without losing accuracy. */
export function FlowTrackerBar({ userId }: { userId: string }) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const queryKey = ['running-flow', userId]

  const { data: flow } = useQuery({
    queryKey,
    queryFn: () => getRunningFlow(supabase, userId),
  })

  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [ending, setEnding] = useState(false)
  const [debriefDraft, setDebriefDraft] = useState('')
  const [energyDraft, setEnergyDraft] = useState<number | null>(null)

  const [, forceTick] = useState(0)
  useEffect(() => {
    if (!flow) return
    const id = setInterval(() => forceTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [flow?.id])

  const invalidate = () => queryClient.invalidateQueries({ queryKey })

  const handleStart = async () => {
    const trimmed = label.trim()
    if (!trimmed) return
    setBusy(true)
    setError(null)
    try {
      await startFlow(supabase, userId, trimmed)
      setLabel('')
      invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start flow.')
      invalidate()
    } finally {
      setBusy(false)
    }
  }

  const handleDone = async () => {
    if (!flow) return
    setBusy(true)
    try {
      await endFlow(supabase, userId, flow.id, {
        debrief: debriefDraft.trim() || undefined,
        energy_after: energyDraft ?? undefined,
      })
      setEnding(false)
      setDebriefDraft('')
      setEnergyDraft(null)
      invalidate()
    } finally {
      setBusy(false)
    }
  }

  const barClasses = 'shrink-0 flex items-center gap-2 px-4 py-2 border-b border-charcoal/8 dark:border-white/[0.07] bg-cream dark:bg-[#0f0e0e]'

  if (!flow) {
    return (
      <div className={barClasses}>
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleStart()}
          placeholder="what are you doing?"
          disabled={busy}
          className="flex-1 min-w-0 bg-transparent font-serif text-[13px] font-light text-charcoal dark:text-[#f0ede8] placeholder:text-charcoal/30 dark:placeholder:text-[#5c5a57] placeholder:italic outline-none"
        />
        {error && (
          <span className="font-sans text-[10px] text-terra shrink-0">{error}</span>
        )}
        <button
          onClick={handleStart}
          disabled={busy || !label.trim()}
          className="shrink-0 px-3 py-1 rounded-[7px] font-sans text-[10.5px] font-medium bg-accent text-on-accent hover:opacity-90 disabled:opacity-40 cursor-pointer"
        >
          Start Flow
        </button>
      </div>
    )
  }

  if (ending) {
    return (
      <div className={barClasses}>
        <span className="shrink-0 font-serif text-[13px] font-light text-charcoal dark:text-[#f0ede8]">
          {flow.label}
        </span>
        <input
          value={debriefDraft}
          onChange={e => setDebriefDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleDone()}
          placeholder="how'd it go? (optional)"
          disabled={busy}
          className="flex-1 min-w-0 bg-transparent font-serif text-[13px] font-light text-charcoal dark:text-[#f0ede8] placeholder:text-charcoal/30 dark:placeholder:text-[#5c5a57] placeholder:italic outline-none"
        />
        <div className="hidden sm:flex items-center gap-1 shrink-0">
          {ENERGY_LEVELS.map(n => (
            <button
              key={n}
              onClick={() => setEnergyDraft(d => (d === n ? null : n))}
              disabled={busy}
              className={[
                'size-6 rounded-full font-sans text-[10px] border transition-colors cursor-pointer',
                energyDraft === n
                  ? 'bg-accent text-on-accent border-accent'
                  : 'border-charcoal/15 dark:border-white/[0.1] text-charcoal/40 dark:text-[#9e9b96] hover:border-accent/40',
              ].join(' ')}
            >
              {n}
            </button>
          ))}
        </div>
        <button
          onClick={handleDone}
          disabled={busy}
          className="shrink-0 px-3 py-1 rounded-[7px] font-sans text-[10.5px] font-medium bg-accent text-on-accent hover:opacity-90 disabled:opacity-40 cursor-pointer"
        >
          Done
        </button>
        <button
          onClick={() => setEnding(false)}
          disabled={busy}
          aria-label="Cancel"
          className="shrink-0 font-sans text-[14px] leading-none text-charcoal/30 dark:text-[#5c5a57] hover:text-charcoal dark:hover:text-[#f0ede8] cursor-pointer"
        >
          ×
        </button>
      </div>
    )
  }

  const elapsedMs = Date.now() - new Date(flow.started_at).getTime()

  return (
    <div className={barClasses}>
      <span className="shrink-0 font-serif text-[13px] font-light text-charcoal dark:text-[#f0ede8] truncate">
        {flow.label}
      </span>
      <span className="font-mono text-[11px] text-charcoal/45 dark:text-[#9e9b96] tabular-nums">
        {formatElapsed(elapsedMs)}
      </span>
      <div className="flex-1" />
      <button
        onClick={() => setEnding(true)}
        className="shrink-0 px-3 py-1 rounded-[7px] font-sans text-[10.5px] font-medium border border-charcoal/15 dark:border-white/[0.1] text-charcoal/60 dark:text-[#9e9b96] hover:border-accent/40 hover:text-accent transition-colors cursor-pointer"
      >
        End
      </button>
    </div>
  )
}
