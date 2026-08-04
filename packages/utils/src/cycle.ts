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

const MENSTRUAL_LABELS: Record<CyclePhase, string> = {
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
