'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getCaptures, getCycleProfile, getDailyLogs, getPeriodLogs } from '@ki/services'
import type { CaptureWithEnrichment, DailyLog, PeriodLog } from '@ki/types'
import { usePatternsData } from '@/hooks/usePatternsData'
import { PhaseLegend } from '@/components/patterns/PhaseLegend'
import { EnergyByPhase } from '@/components/patterns/EnergyByPhase'
import { RecurringPatternCards } from '@/components/patterns/RecurringPatternCards'

// ─── Empty states ─────────────────────────────────────────────────────────────

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="max-w-[440px] mx-auto text-center pt-24">
      <h2 className="font-serif text-[18px] font-light text-charcoal dark:text-[#f0ede8] mb-2">
        {title}
      </h2>
      <p className="font-serif text-[13px] font-light text-charcoal/55 dark:text-[#9e9b96] leading-relaxed mb-5">
        {body}
      </p>
      <Link
        href="/profile"
        className="inline-block px-4 py-2 rounded-[8px] font-sans text-[11.5px] font-medium bg-accent text-on-accent hover:opacity-90"
      >
        Go to Settings
      </Link>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PatternsPage() {
  const supabase = createClient()

  const { data: cycleProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['patterns-cycle-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      return getCycleProfile(supabase, user.id)
    },
  })

  const { data: captures = [], isLoading: capturesLoading } = useQuery({
    queryKey: ['patterns-captures'],
    queryFn: async () => {
      const { data, error } = await getCaptures(supabase, { limit: 500 })
      if (error) throw error
      return (data ?? []) as CaptureWithEnrichment[]
    },
    enabled: Boolean(cycleProfile?.cycle_type),
  })

  const { data: dailyLogs = [] } = useQuery({
    queryKey: ['patterns-daily-logs'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []
      return getDailyLogs(supabase, user.id, 90)
    },
    enabled: Boolean(cycleProfile?.cycle_type),
  })

  const { data: periodLogs = [] } = useQuery({
    queryKey: ['patterns-period-logs'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []
      return getPeriodLogs(supabase, user.id)
    },
    enabled: Boolean(cycleProfile?.cycle_type),
  })

  const patterns = usePatternsData(
    captures as CaptureWithEnrichment[],
    dailyLogs as DailyLog[],
    periodLogs as PeriodLog[],
    cycleProfile,
  )

  if (profileLoading) return null

  if (!cycleProfile?.cycle_type) {
    return (
      <div className="h-full overflow-y-auto bg-cream dark:bg-[#0f0e0e] px-8 py-8">
        <EmptyState
          title="Patterns lives under your cycle"
          body="Connect your cycle in Settings and Ki starts mapping what you capture — thoughts, energy, mood — against where you are in your cycle. Nothing to fill in daily; it works from what you already capture."
        />
      </div>
    )
  }

  if (capturesLoading) return null

  if (!patterns.hasPeriodLogged) {
    return (
      <div className="h-full overflow-y-auto bg-cream dark:bg-[#0f0e0e] px-8 py-8">
        <EmptyState
          title="Log your first period to start"
          body="Cycle day is stamped on every capture from the moment you log a period — including ones you've already made. Once that's in, patterns start forming here."
        />
      </div>
    )
  }

  if (!patterns.hasEnoughData) {
    return (
      <div className="h-full overflow-y-auto bg-cream dark:bg-[#0f0e0e] px-8 py-8">
        <EmptyState
          title="Keep capturing"
          body="Patterns need a few weeks of captures spread across your cycle to emerge. Nothing's wrong — there's just not enough here yet."
        />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-cream dark:bg-[#0f0e0e]">
      <div className="max-w-[880px] mx-auto px-8 py-8 space-y-8">

        <div>
          <h1 className="font-serif text-[22px] font-light text-charcoal dark:text-[#f0ede8] mb-1">
            Patterns
          </h1>
          <p className="font-sans text-[11.5px] text-charcoal/45 dark:text-[#9e9b96]">
            What you capture, mapped against where you are in your cycle.
          </p>
        </div>

        <PhaseLegend phaseBands={patterns.phaseBands} />

        <section>
          <h2 className="font-sans text-[10px] font-semibold text-charcoal/35 dark:text-[#5c5a57] uppercase tracking-[0.12em] mb-3">
            Energy by phase
          </h2>
          <EnergyByPhase energyByPhase={patterns.energyByPhase} />
        </section>

        <section>
          <h2 className="font-sans text-[10px] font-semibold text-charcoal/35 dark:text-[#5c5a57] uppercase tracking-[0.12em] mb-3">
            What keeps coming up
          </h2>
          <RecurringPatternCards
            items={patterns.recurringThemes}
            emptyMessage="Nothing recurring yet — keep capturing and this fills in."
          />
        </section>

        <section>
          <h2 className="font-sans text-[10px] font-semibold text-charcoal/35 dark:text-[#5c5a57] uppercase tracking-[0.12em] mb-3">
            From your daily check-ins
          </h2>
          <RecurringPatternCards
            items={patterns.dailyLogPatterns}
            emptyMessage="No daily check-ins logged yet."
          />
        </section>

      </div>
    </div>
  )
}
