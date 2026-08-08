// Shared enrichment display tokens — sentiment/energy/phase badge styling and
// ordering. Originally local to the Explore page; extracted so the Patterns
// view can reuse the same design-token maps instead of duplicating them.

import { resolveCyclePhase, type CyclePhase } from '@ki/utils'

export const SENTIMENT_ORDER: Record<string, number> = { positive: 0, neutral: 1, mixed: 2, negative: 3 }
export const ENERGY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

export const SENTIMENT_STYLES: Record<string, string> = {
  positive: 'bg-sage/10 text-sage border-sage/20',
  negative: 'bg-terra/10 text-terra border-terra/20',
  mixed: 'bg-ray/10 text-[#b8923a] border-ray/20',
  neutral: 'bg-charcoal/[0.04] dark:bg-white/[0.04] text-charcoal/40 dark:text-[#9e9b96] border-charcoal/8 dark:border-white/[0.06]',
}

export const ENERGY_STYLES: Record<string, string> = {
  high: 'bg-terra/8 text-terra border-terra/15',
  medium: 'bg-pacific/10 text-pacific border-pacific/20',
  low: 'bg-charcoal/[0.04] dark:bg-white/[0.04] text-charcoal/35 dark:text-[#5c5a57] border-charcoal/8 dark:border-white/[0.06]',
}

export const PHASE_STYLES: Record<CyclePhase, string> = {
  rest: 'bg-terra/8 text-terra border-terra/15',
  build: 'bg-sage/10 text-sage border-sage/20',
  peak: 'bg-ray/10 text-[#b8923a] border-ray/20',
  release: 'bg-pacific/10 text-pacific border-pacific/20',
}

export function SentimentBadge({ value }: { value: string | null | undefined }) {
  if (!value) return null
  return (
    <span className={`inline-block font-sans text-[9px] px-[6px] py-[2px] rounded-full border capitalize whitespace-nowrap ${SENTIMENT_STYLES[value] ?? SENTIMENT_STYLES.neutral}`}>
      {value}
    </span>
  )
}

export function EnergyBadge({ value }: { value: string | null | undefined }) {
  if (!value) return null
  return (
    <span className={`inline-block font-sans text-[9px] px-[6px] py-[2px] rounded-full border capitalize whitespace-nowrap ${ENERGY_STYLES[value] ?? ENERGY_STYLES.low}`}>
      {value}
    </span>
  )
}

/** Cycle day + derived phase — phase is never stored, computed here from the
 * user's average cycle/period length, same as the sidebar and Settings. */
export function CycleBadge({
  cycleDay,
  averageCycleLength,
  averagePeriodLength,
}: {
  cycleDay: number | null | undefined
  averageCycleLength: number | null | undefined
  averagePeriodLength: number | null | undefined
}) {
  if (!cycleDay) return null
  const phaseInfo = resolveCyclePhase(cycleDay, { averageCycleLength, averagePeriodLength })
  return (
    <div className="flex items-center gap-[6px] whitespace-nowrap">
      <span className="font-sans text-[10px] text-charcoal/40 dark:text-[#9e9b96]">Day {cycleDay}</span>
      <span className={`inline-block font-sans text-[9px] px-[6px] py-[2px] rounded-full border whitespace-nowrap ${PHASE_STYLES[phaseInfo.phase]}`}>
        {phaseInfo.label}
      </span>
    </div>
  )
}
