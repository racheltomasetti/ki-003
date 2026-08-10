// Ki — flow tracker service
//
// A universal start/stop timer. One flow can be running per user at a
// time — enforced by a partial unique index in Postgres
// (020_flows.sql), not just checked here, so two tabs or a
// double-click can never both succeed. startFlow does a cheap
// pre-check for a friendly error in the common case, then relies on the
// DB constraint (caught below) as the actual guarantee under a race.
//
// Elapsed time is never computed or stored here — started_at is the only
// source of truth; the UI derives elapsed as now - started_at wherever it
// displays it.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Flow, FlowEndInput } from '@ki/types'

const UNIQUE_VIOLATION = '23505'
const ALREADY_RUNNING_MESSAGE = 'You already have a flow running. End it before starting a new one.'

/** The currently running flow for a user, or null if none. */
export async function getRunningFlow(
  client: SupabaseClient,
  userId: string,
): Promise<Flow | null> {
  const { data, error } = await client
    .from('flows')
    .select('*')
    .eq('user_id', userId)
    .is('ended_at', null)
    .maybeSingle()

  if (error) throw error
  return data as Flow | null
}

/**
 * Start a new flow. Throws a clear message (not a raw Postgres error) if
 * one is already running — either because the pre-check caught it, or
 * because the unique-violation from a genuine race did.
 */
export async function startFlow(
  client: SupabaseClient,
  userId: string,
  label: string,
): Promise<Flow> {
  const trimmed = label.trim()
  if (!trimmed) throw new Error('A flow needs a label.')

  const running = await getRunningFlow(client, userId)
  if (running) throw new Error(ALREADY_RUNNING_MESSAGE)

  const { data, error } = await client
    .from('flows')
    .insert({ user_id: userId, label: trimmed })
    .select()
    .single()

  if (error) {
    if (error.code === UNIQUE_VIOLATION) throw new Error(ALREADY_RUNNING_MESSAGE)
    throw error
  }
  return data as Flow
}

/**
 * End the given flow. debrief and energy_after are both optional — ending
 * must never require them. Scoped to ended_at is null so ending an
 * already-ended flow (e.g. a stale second tab) is a no-op failure, not a
 * silent double-write.
 */
export async function endFlow(
  client: SupabaseClient,
  userId: string,
  flowId: string,
  input: FlowEndInput = {},
): Promise<Flow> {
  if (
    input.energy_after != null &&
    (input.energy_after < 1 || input.energy_after > 5)
  ) {
    throw new Error('Energy must be between 1 and 5.')
  }

  const { data, error } = await client
    .from('flows')
    .update({
      ended_at: new Date().toISOString(),
      debrief: input.debrief?.trim() || null,
      energy_after: input.energy_after ?? null,
    })
    .eq('id', flowId)
    .eq('user_id', userId)
    .is('ended_at', null)
    .select()
    .single()

  if (error) throw error
  return data as Flow
}

/** Recent flows, most recent first — no dedicated UI yet, but cheap to
 * have ready (matches todos.ts / cycle.ts always including a list-read). */
export async function getFlows(
  client: SupabaseClient,
  userId: string,
  limit = 30,
): Promise<Flow[]> {
  const { data, error } = await client
    .from('flows')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data as Flow[]
}
