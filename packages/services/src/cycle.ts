// Ki — cycle service
//
// period_logs is the sole source of truth for cycle_day — every write here
// is a plain insert/delete; Postgres triggers handle re-stamping enrichments
// and rolling averages (see docs/active/cycle-tracker.md, migrations
// 017_cycle.sql / 018_cycle_rolling_averages.sql). This layer never
// computes or writes cycle_day / cycle_start_date / average_cycle_length /
// average_period_length directly — those are always derived.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CycleType, PeriodLog } from '@ki/types'
import { getLocalYYYYMMDD, clusterPeriodDates, type PeriodInstance } from '@ki/utils'

/** Inclusive list of YYYY-MM-DD dates from start through end, local time. */
function datesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const cursor = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  while (cursor <= end) {
    dates.push(getLocalYYYYMMDD(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

// ─── Cycle preferences (profiles) ──────────────────────────────────────────

export interface CycleProfile {
  cycle_type: CycleType | null
  average_cycle_length: number | null
  average_period_length: number | null
}

export async function getCycleProfile(
  client: SupabaseClient,
  userId: string,
): Promise<CycleProfile | null> {
  const { data, error } = await client
    .from('profiles')
    .select('cycle_type, average_cycle_length, average_period_length')
    .eq('id', userId)
    .single()
  if (error) return null
  return data as CycleProfile
}

/**
 * Opt in to menstrual cycle tracking. avgCycleLength / avgPeriodLength are
 * the user's best-guess starting point — the rolling-average trigger
 * silently replaces them with real data once 3 cycles are logged.
 */
export async function enableMenstrualTracking(
  client: SupabaseClient,
  userId: string,
  avgCycleLength: number,
  avgPeriodLength: number,
) {
  return client
    .from('profiles')
    .update({
      cycle_type: 'menstrual' as CycleType,
      average_cycle_length: avgCycleLength,
      average_period_length: avgPeriodLength,
    })
    .eq('id', userId)
    .select()
    .single()
}

// ─── Period logs ────────────────────────────────────────────────────────────

/** All period log dates for a user, most recent first. */
export async function getPeriodLogs(
  client: SupabaseClient,
  userId: string,
  limit = 90,
): Promise<PeriodLog[]> {
  const { data, error } = await client
    .from('period_logs')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit)
  if (error) return []
  return data as PeriodLog[]
}

/**
 * Log a single bleeding day (defaults to today, local time). Idempotent —
 * logging the same day twice is a no-op, not an error.
 */
export async function logPeriodDay(
  client: SupabaseClient,
  userId: string,
  date: string = getLocalYYYYMMDD(),
) {
  return client
    .from('period_logs')
    .upsert({ user_id: userId, date }, { onConflict: 'user_id,date', ignoreDuplicates: true })
}

/**
 * Log a full period in one write — start date through end date, inclusive.
 * The clustering logic in compute_cycle_day treats any contiguous run of
 * days as one cycle start regardless of whether it arrived as a single
 * day or a whole range, so this is the natural way to backdate a period
 * that already happened rather than logging it one day at a time.
 */
export async function logPeriodRange(
  client: SupabaseClient,
  userId: string,
  startDate: string,
  endDate: string,
) {
  return client
    .from('period_logs')
    .upsert(
      datesInRange(startDate, endDate).map(date => ({ user_id: userId, date })),
      { onConflict: 'user_id,date', ignoreDuplicates: true },
    )
}

/** Remove a single logged day — e.g. correcting a mistaken entry. */
export async function removePeriodDay(client: SupabaseClient, userId: string, date: string) {
  return client
    .from('period_logs')
    .delete()
    .eq('user_id', userId)
    .eq('date', date)
}

/** Remove every logged day in a range, inclusive — deleting a whole period instance. */
export async function deletePeriodRange(
  client: SupabaseClient,
  userId: string,
  startDate: string,
  endDate: string,
) {
  return client
    .from('period_logs')
    .delete()
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
}

/**
 * Period instances (contiguous logged days grouped into ranges), most
 * recent first — what the Settings list shows and edits, rather than raw
 * day rows. Reads the same period_logs, clustered client-side.
 */
export async function getPeriodInstances(
  client: SupabaseClient,
  userId: string,
  limit = 12,
): Promise<PeriodInstance[]> {
  const { data, error } = await client
    .from('period_logs')
    .select('date')
    .eq('user_id', userId)
    .order('date', { ascending: true })
  if (error || !data) return []
  const instances = clusterPeriodDates(data.map(row => row.date as string))
  return instances.reverse().slice(0, limit)
}

/**
 * Correct an existing period instance's date range. Reconciles period_logs
 * to exactly match the new range — deletes days no longer in range, adds
 * days newly in range. Not atomic (two sequential calls), but each step is
 * itself safe: the re-stamp trigger runs after every write, so the corpus
 * is never left pointing at a half-updated cycle for more than an instant.
 */
export async function updatePeriodInstance(
  client: SupabaseClient,
  userId: string,
  oldRange: { startDate: string; endDate: string },
  newRange: { startDate: string; endDate: string },
) {
  await deletePeriodRange(client, userId, oldRange.startDate, oldRange.endDate)
  return logPeriodRange(client, userId, newRange.startDate, newRange.endDate)
}

// ─── Live cycle info ────────────────────────────────────────────────────────

export interface CurrentCycleInfo {
  cycleDay: number | null
  cycleStartDate: string | null
}

/**
 * What day of the cycle is it right now — independent of whether the user
 * has captured anything today. Calls the same compute_cycle_day() Postgres
 * function that stamps enrichments, via RPC, so the answer is always
 * identical to what a capture made this instant would receive.
 */
export async function getCurrentCycleInfo(
  client: SupabaseClient,
  userId: string,
): Promise<CurrentCycleInfo> {
  const { data, error } = await client.rpc('compute_cycle_day', {
    p_user_id: userId,
    p_captured_at: new Date().toISOString(),
  })
  if (error || !data?.[0]) return { cycleDay: null, cycleStartDate: null }
  return { cycleDay: data[0].cycle_day, cycleStartDate: data[0].cycle_start_date }
}

/** Is there a logged bleeding day for today? Purely a display convenience —
 * nothing is stored for "period ended"; the cluster just stops growing. */
export function isPeriodActiveToday(logs: PeriodLog[]): boolean {
  const today = getLocalYYYYMMDD()
  return logs.some(log => log.date === today)
}
