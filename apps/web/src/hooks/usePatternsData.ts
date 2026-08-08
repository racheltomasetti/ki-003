// Aggregates the corpus + daily logs into cycle-phase-correlated patterns —
// the client-side counterpart to what chat's RAG retrieval can't do (it only
// sees the top-N captures semantically nearest a single message, not the
// whole corpus grouped by phase). Mirrors terra-001's usePatternsData.ts,
// simplified: capture cycle_day is already stamped by Postgres, so no
// client-side findCycleForDate is needed there — only daily_logs (which
// aren't stamped) need cycleDayForDate.

import { useMemo } from 'react'
import {
  resolveCyclePhase,
  getPhaseCycleDayRanges,
  cycleDayForDate,
  clusterPeriodDates,
  type CyclePhase,
  type PhaseRange,
} from '@ki/utils'
import type { CaptureWithEnrichment, DailyLog, PeriodLog } from '@ki/types'
import type { CycleProfile } from '@ki/services'

const MIN_RECURRENCE = 2
const MAX_ITEMS = 20
const MIN_QUALIFYING_CAPTURES = 5

export interface PatternItem {
  phase: CyclePhase
  label: string
  count: number
}

export interface DailyLogPatternItem extends PatternItem {
  kind: 'emotion' | 'body_signal'
}

export interface PatternsData {
  phaseBands: PhaseRange[]
  energyByPhase: Record<CyclePhase, { high: number; medium: number; low: number; total: number }>
  recurringThemes: PatternItem[]
  dailyLogPatterns: DailyLogPatternItem[]
  hasEnoughData: boolean
  hasPeriodLogged: boolean
}

function emptyEnergyByPhase(): PatternsData['energyByPhase'] {
  return {
    rest: { high: 0, medium: 0, low: 0, total: 0 },
    build: { high: 0, medium: 0, low: 0, total: 0 },
    peak: { high: 0, medium: 0, low: 0, total: 0 },
    release: { high: 0, medium: 0, low: 0, total: 0 },
  }
}

/** Tally a phase-keyed string into a count map, then filter/sort/cap into a flat list. */
function tallyToPatternItems(counts: Map<string, { phase: CyclePhase; label: string; count: number }>): PatternItem[] {
  return Array.from(counts.values())
    .filter(item => item.count >= MIN_RECURRENCE)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_ITEMS)
}

export function usePatternsData(
  captures: CaptureWithEnrichment[],
  dailyLogs: DailyLog[],
  periodLogs: PeriodLog[],
  cycleProfile: CycleProfile | null | undefined,
): PatternsData {
  return useMemo(() => {
    const cycleLength = cycleProfile?.average_cycle_length ?? 28
    const periodLength = cycleProfile?.average_period_length ?? 5
    const phaseBands = getPhaseCycleDayRanges(cycleLength, periodLength).filter(b => b.startDay <= b.endDay)

    const energyByPhase = emptyEnergyByPhase()
    const themeCounts = new Map<string, { phase: CyclePhase; label: string; count: number }>()
    let qualifyingCaptures = 0

    for (const capture of captures) {
      const cycleDay = capture.enrichments?.cycle_day
      if (cycleDay == null) continue
      qualifyingCaptures++

      const { phase } = resolveCyclePhase(cycleDay, {
        averageCycleLength: cycleProfile?.average_cycle_length,
        averagePeriodLength: cycleProfile?.average_period_length,
      })

      const energyLevel = capture.enrichments?.energy_level
      if (energyLevel) {
        energyByPhase[phase][energyLevel]++
        energyByPhase[phase].total++
      }

      const tags = [
        ...(capture.enrichments?.mood_tags ?? []),
        ...(capture.enrichments?.themes ?? []),
      ]
      for (const raw of tags) {
        const label = raw.trim().toLowerCase()
        if (!label) continue
        const key = `${phase}|||${label}`
        const existing = themeCounts.get(key)
        if (existing) existing.count++
        else themeCounts.set(key, { phase, label, count: 1 })
      }
    }

    const recurringThemes = tallyToPatternItems(themeCounts)

    const periodInstances = clusterPeriodDates(
      periodLogs.map(log => log.date).sort(),
    )

    const dailyLogCounts = new Map<string, { phase: CyclePhase; label: string; count: number; kind: 'emotion' | 'body_signal' }>()
    for (const log of dailyLogs) {
      const cycleDay = cycleDayForDate(log.log_date, periodInstances)
      if (cycleDay == null) continue
      const { phase } = resolveCyclePhase(cycleDay, {
        averageCycleLength: cycleProfile?.average_cycle_length,
        averagePeriodLength: cycleProfile?.average_period_length,
      })

      const entries: Array<[string, 'emotion' | 'body_signal']> = [
        ...(log.emotions ?? []).map((e): [string, 'emotion'] => [e, 'emotion']),
        ...(log.body_signals ?? []).map((s): [string, 'body_signal'] => [s, 'body_signal']),
      ]
      for (const [raw, kind] of entries) {
        const label = raw.trim().toLowerCase()
        if (!label) continue
        const key = `${phase}|||${kind}|||${label}`
        const existing = dailyLogCounts.get(key)
        if (existing) existing.count++
        else dailyLogCounts.set(key, { phase, label, count: 1, kind })
      }
    }

    const dailyLogPatterns = Array.from(dailyLogCounts.values())
      .filter(item => item.count >= MIN_RECURRENCE)
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_ITEMS)

    return {
      phaseBands,
      energyByPhase,
      recurringThemes,
      dailyLogPatterns,
      hasEnoughData: qualifyingCaptures >= MIN_QUALIFYING_CAPTURES && recurringThemes.length > 0,
      hasPeriodLogged: qualifyingCaptures > 0,
    }
  }, [captures, dailyLogs, periodLogs, cycleProfile])
}
