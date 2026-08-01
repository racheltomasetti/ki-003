// Ki — re-enrich Edge Function
//
// Re-runs the enrichment pipeline over the caller's corpus, one page per
// invocation, OR a single capture when capture_id is given (the capture
// detail menu's "Re-enrich" action). The client loops with the returned
// cursor until next_cursor is null for the batch case. Each capture is
// re-enriched by invoking the deployed enrich-capture function — single
// source of truth for enrichment logic.
//
// Re-enrichment rewrites only the derived enrichments row. Captures are
// immutable and untouched (auto-title only ever fills a blank title).
// pursuit_connections are re-tested against the user's CURRENT active
// pursuits — the past reorganizes around the present.
//
// Request:  { limit?: number, cursor?: string | null } — batch mode
//        or { capture_id: string }                     — single-capture mode
// Response (batch):  { processed, enriched, failed, next_cursor, total }
// Response (single): { processed, enriched, failed }

import { createClient } from 'npm:@supabase/supabase-js@2'

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 25

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json' }

interface CaptureRow {
  id: string
  user_id: string
  title: string | null
  body: string
  captured_at: string
}

// Re-enriches one capture by invoking the deployed enrich-capture function
// with the service role key — the same trust boundary the Postgres webhook
// uses. Returns whether it succeeded.
async function reEnrichOne(
  supabaseUrl: string,
  supabaseServiceKey: string,
  capture: CaptureRow,
): Promise<boolean> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/enrich-capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ record: capture }),
    })
    const text = await res.text()
    if (res.ok && text === 'ok') return true
    console.warn(`re-enrich: enrich-capture returned "${text}" for ${capture.id}`)
    return false
  } catch (err) {
    console.error(`re-enrich: invoke failed for ${capture.id}`, err)
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

  // Verify the user's JWT — re-enrichment is scoped to the caller's corpus
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS })
  }
  const { data: { user }, error: authError } = await serviceClient.auth.getUser(token)
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS })
  }

  let limit = DEFAULT_LIMIT
  let cursor: string | null = null
  let captureId: string | null = null
  try {
    const body = await req.json()
    if (typeof body.capture_id === 'string') captureId = body.capture_id
    if (typeof body.limit === 'number') limit = Math.min(Math.max(1, body.limit), MAX_LIMIT)
    if (typeof body.cursor === 'string') cursor = body.cursor
  } catch {
    // no body — use defaults
  }

  // ─── Single-capture mode ─────────────────────────────────────────────────
  if (captureId) {
    const { data: capture, error: fetchOneError } = await serviceClient
      .from('captures')
      .select('id, user_id, title, body, captured_at')
      .eq('id', captureId)
      .eq('user_id', user.id) // scoped to the caller — cannot re-enrich another user's capture
      .not('body', 'is', null)
      .single()

    if (fetchOneError || !capture) {
      return new Response(JSON.stringify({ error: 'Capture not found' }), { status: 404, headers: JSON_HEADERS })
    }

    const ok = await reEnrichOne(supabaseUrl, supabaseServiceKey, capture as CaptureRow)
    return new Response(
      JSON.stringify({ processed: 1, enriched: ok ? 1 : 0, failed: ok ? 0 : 1 }),
      { status: 200, headers: JSON_HEADERS },
    )
  }

  // ─── Batch mode ───────────────────────────────────────────────────────────

  // Total enrichable captures (for progress display)
  const { count: total } = await serviceClient
    .from('captures')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .neq('status', 'deleted')
    .not('body', 'is', null)

  // Next page, keyed by id for a stable cursor
  let query = serviceClient
    .from('captures')
    .select('id, user_id, title, body, captured_at')
    .eq('user_id', user.id)
    .neq('status', 'deleted')
    .not('body', 'is', null)
    .order('id', { ascending: true })
    .limit(limit)
  if (cursor) query = query.gt('id', cursor)

  const { data: captures, error: fetchError } = await query
  if (fetchError) {
    console.error('re-enrich: fetch failed', fetchError)
    return new Response(JSON.stringify({ error: 'Failed to fetch captures' }), { status: 500, headers: JSON_HEADERS })
  }

  let enriched = 0
  let failed = 0

  for (const capture of (captures ?? []) as CaptureRow[]) {
    const ok = await reEnrichOne(supabaseUrl, supabaseServiceKey, capture)
    if (ok) enriched++
    else failed++
  }

  const processed = captures?.length ?? 0
  const nextCursor = processed === limit ? captures![processed - 1].id : null

  return new Response(
    JSON.stringify({
      processed,
      enriched,
      failed,
      next_cursor: nextCursor,
      total: total ?? 0,
    }),
    { status: 200, headers: JSON_HEADERS },
  )
})
