// Phase derivation for the cycle layer. See docs/active/cycle-tracker.md.
//
// cycle_day is stamped by Postgres (never here) — these are pure functions
// that turn a stamped day into a phase, at read time. Nothing here is
// stored: phases refine automatically whenever the derivation improves.
//
// Menstrual cycle only for now — the specific, proven case before
// generalizing outward. Ported from terra-001's phaseUtils.ts /
// cycleUtils.ts. `phase` uses an abstracted vocabulary — rest / build /
// peak / release — that reads better in Ki's voice than clinical terms;
// `label` carries the specific name. When lunar (or other cyclic types)
// arrive, this same vocabulary is designed to extend to them.

export type CyclePhase = 'rest' | 'build' | 'peak' | 'release'

export interface PhaseInfo {
  phase: CyclePhase
  label: string
  day: number
  length: number
}

const DEFAULT_CYCLE_LENGTH = 28
const DEFAULT_PERIOD_LENGTH = 5

/** Display label per phase. Exported so filter UIs can list all phases without duplicating this map. */
export const MENSTRUAL_LABELS: Record<CyclePhase, string> = {
  rest: 'Menstruation',
  build: 'Follicular',
  peak: 'Ovulation',
  release: 'Luteal',
}

/** Estimated ovulation day (1-based cycle day), typically cycle length minus 14. */
export function getEstimatedOvulationDay(cycleLength: number): number {
  return cycleLength - 14
}

function resolveMenstrualPhase(day: number, cycleLength: number, periodLength: number): CyclePhase {
  if (day <= periodLength) return 'rest'

  const ovulationDay = getEstimatedOvulationDay(cycleLength)
  const fertileStart = ovulationDay - 1
  const fertileEnd = ovulationDay + 1

  if (day >= fertileStart && day <= fertileEnd) return 'peak'
  if (day > fertileEnd) return 'release'
  return 'build'
}

/**
 * Resolve the phase for a stamped cycle_day. Scales with the user's own
 * average cycle/period length (falls back to 28/5 day population averages
 * if not yet known).
 */
export function resolveCyclePhase(
  cycleDay: number,
  options?: { averageCycleLength?: number | null; averagePeriodLength?: number | null },
): PhaseInfo {
  const length = options?.averageCycleLength ?? DEFAULT_CYCLE_LENGTH
  const periodLength = options?.averagePeriodLength ?? DEFAULT_PERIOD_LENGTH
  const phase = resolveMenstrualPhase(cycleDay, length, periodLength)
  return { phase, label: MENSTRUAL_LABELS[phase], day: cycleDay, length }
}

export interface PhaseRange {
  phase: CyclePhase
  label: string
  startDay: number
  endDay: number
}

/**
 * Phase band boundaries for all 4 phases at once, given a cycle/period
 * length — ported from terra-001's phaseUtils.ts getPhaseCycleDayRanges.
 * Used for phase legends/bands (e.g. the Patterns view), not for resolving
 * a single day — use resolveCyclePhase for that. A band with startDay >
 * endDay (very short cycles) is degenerate and callers should skip it.
 */
export function getPhaseCycleDayRanges(cycleLength: number, periodLength: number): PhaseRange[] {
  const ovulationDay = getEstimatedOvulationDay(cycleLength)
  const fertileStart = ovulationDay - 1
  const fertileEnd = ovulationDay + 1
  return [
    { phase: 'rest', label: MENSTRUAL_LABELS.rest, startDay: 1, endDay: periodLength },
    { phase: 'build', label: MENSTRUAL_LABELS.build, startDay: periodLength + 1, endDay: fertileStart - 1 },
    { phase: 'peak', label: MENSTRUAL_LABELS.peak, startDay: fertileStart, endDay: fertileEnd },
    { phase: 'release', label: MENSTRUAL_LABELS.release, startDay: fertileEnd + 1, endDay: cycleLength },
  ]
}

// ─── Clustering ─────────────────────────────────────────────────────────────
// Groups individual logged days (period_logs rows) into period instances —
// the same "contiguous days = one cycle start" logic compute_cycle_day uses
// in Postgres, mirrored here so the UI can display and edit whole periods
// rather than individual date rows. Ported from terra-001's clusterDates.

export interface PeriodInstance {
  startDate: string
  endDate: string
  dayCount: number
}

export function daysBetween(a: string, b: string): number {
  const start = new Date(a + 'T00:00:00')
  const end = new Date(b + 'T00:00:00')
  return Math.round((end.getTime() - start.getTime()) / 86_400_000)
}

/** Groups sorted (ascending) YYYY-MM-DD dates into contiguous-day instances. */
export function clusterPeriodDates(sortedDates: string[]): PeriodInstance[] {
  if (sortedDates.length === 0) return []
  const clusters: string[][] = [[sortedDates[0]]]
  for (let i = 1; i < sortedDates.length; i++) {
    const cluster = clusters[clusters.length - 1]
    const last = cluster[cluster.length - 1]
    if (daysBetween(last, sortedDates[i]) === 1) {
      cluster.push(sortedDates[i])
    } else {
      clusters.push([sortedDates[i]])
    }
  }
  return clusters.map(c => ({ startDate: c[0], endDate: c[c.length - 1], dayCount: c.length }))
}

/**
 * Cycle day for an arbitrary date, given already-clustered period instances.
 * Mirrors compute_cycle_day's SQL logic client-side — needed because unlike
 * enrichments, daily_logs rows aren't stamped with cycle_day by Postgres, so
 * consumers that need a daily_log's phase (e.g. the Patterns view) derive it
 * here instead. Returns null if the date is before any known cycle start.
 */
export function cycleDayForDate(date: string, periodInstances: PeriodInstance[]): number | null {
  const start = periodInstances
    .map(p => p.startDate)
    .filter(startDate => startDate <= date)
    .sort()
    .pop()
  if (!start) return null
  return daysBetween(start, date) + 1
}
