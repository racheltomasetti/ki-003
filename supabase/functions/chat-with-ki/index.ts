// Ki — chat-with-ki Edge Function
//
// The thought distillation pipeline.
// Receives a question from the user, retrieves the most semantically relevant
// captures from their corpus, layers their memory document, then calls Claude
// Sonnet to respond grounded entirely in what the user has captured.
//
// Context budget:
//   Layer 1 — memory document   (~800 tokens, always included)
//   Layer 2 — top 10 captures   (~2500 tokens, via pgvector match_captures)
//   Total                        ~3300 tokens
//
// No hallucination. Every response is grounded in the corpus.
// If the answer isn't there, Ki says so.

import { createClient } from 'npm:@supabase/supabase-js@2'

const SONNET_MODEL = 'claude-sonnet-4-6'
const EMBEDDING_MODEL = 'text-embedding-3-small'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ─── Embedding ────────────────────────────────────────────────────────────────

async function embedText(text: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  })
  if (!res.ok) throw new Error(`OpenAI embedding error: ${res.status}`)
  const data = await res.json()
  return data.data[0].embedding as number[]
}

// ─── Cycle context ──────────────────────────────────────────────────────────
// Ported from packages/utils/src/cycle.ts — Deno edge functions can't
// resolve pnpm workspace packages, so pure phase-derivation logic is
// duplicated here (same pattern as getTimeOfDayCat in enrich-capture).
// cycle_day is stamped by Postgres; phase is always derived at read time,
// never stored. See docs/active/cycle-tracker.md Phase C.

interface CycleProfile {
  cycle_type: string | null
  average_cycle_length: number | null
  average_period_length: number | null
}

interface DailyLog {
  log_date: string
  energy_level: number | null
  emotions: string[] | null
  body_signals: string[] | null
}

const MENSTRUAL_LABELS: Record<string, string> = {
  rest: 'Menstruation', build: 'Follicular', peak: 'Ovulation', release: 'Luteal',
}

function resolveCyclePhase(day: number, cycleLength: number, periodLength: number): { phase: string; label: string } {
  const ovulationDay = cycleLength - 14
  const fertileStart = ovulationDay - 1
  const fertileEnd = ovulationDay + 1
  let phase: string
  if (day <= periodLength) phase = 'rest'
  else if (day >= fertileStart && day <= fertileEnd) phase = 'peak'
  else if (day > fertileEnd) phase = 'release'
  else phase = 'build'
  return { phase, label: MENSTRUAL_LABELS[phase] }
}

function formatDailyLogs(logs: DailyLog[]): string {
  return logs.map(l => {
    const parts: string[] = []
    if (l.energy_level != null) parts.push(`energy ${l.energy_level}/5`)
    if (l.emotions?.length) parts.push(`emotions: ${l.emotions.join(', ')}`)
    if (l.body_signals?.length) parts.push(`body: ${l.body_signals.join(', ')}`)
    return `- ${l.log_date}${parts.length ? ` — ${parts.join(' | ')}` : ''}`
  }).join('\n')
}

/** Ambient "where the user is today" block. Null (no-op) when not opted in. */
function formatCycleContext(profile: CycleProfile, cycleDay: number | null, dailyLogs: DailyLog[]): string | null {
  if (!profile.cycle_type) return null

  const lines: string[] = []
  if (cycleDay != null) {
    const length = profile.average_cycle_length ?? 28
    const periodLength = profile.average_period_length ?? 5
    const { label } = resolveCyclePhase(cycleDay, length, periodLength)
    lines.push(`Today is cycle day ${cycleDay} of ~${length} (${label} phase).`)
  }
  if (dailyLogs.length > 0) {
    lines.push(`Recent daily logs:\n${formatDailyLogs(dailyLogs)}`)
  }
  return lines.length > 0 ? lines.join('\n\n') : null
}

/** Per-capture cycle day tag for RAG context — the piece that lets Ki spot patterns. */
function formatCaptureCycleTag(cycleDay: number | null, profile: CycleProfile | null): string {
  if (cycleDay == null || !profile?.cycle_type) return ''
  const length = profile.average_cycle_length ?? 28
  const periodLength = profile.average_period_length ?? 5
  const { label } = resolveCyclePhase(cycleDay, length, periodLength)
  return ` · cycle day ${cycleDay} (${label})`
}

// ─── Format captures for Claude context ──────────────────────────────────────

function formatCaptures(captures: Array<{
  id: string
  body: string | null
  title: string | null
  captured_at: string
  type: string
  is_starred: boolean
  cycle_day: number | null
}>, cycleProfile: CycleProfile | null): string {
  return captures.map((c, i) => {
    const date = new Date(c.captured_at).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    })
    const starred = c.is_starred ? ' ★' : ''
    const title = c.title ? `"${c.title}"` : `Capture ${i + 1}`
    const cycleTag = formatCaptureCycleTag(c.cycle_day, cycleProfile)
    return `[${title}${starred} — ${date}${cycleTag}]\n${c.body ?? ''}`
  }).join('\n\n---\n\n')
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Service client — used for all DB operations and JWT verification
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

  // Verify the user's JWT by passing the token directly to getUser()
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS })
  }

  const { data: { user }, error: authError } = await serviceClient.auth.getUser(token)
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS })
  }

  try {
    const { message, history = [] } = await req.json() as {
      message: string
      history: Array<{ role: 'user' | 'assistant'; content: string }>
    }

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: 'No message provided' }), { status: 400, headers: CORS_HEADERS })
    }

    // ── Layer 1: memory document ─────────────────────────────────────────────
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('memory_document, cycle_type, average_cycle_length, average_period_length')
      .eq('id', user.id)
      .single()

    const memoryDocument = profile?.memory_document ?? ''
    const cycleProfile = profile as CycleProfile | null

    // ── Ambient cycle context — where the user is today. No-op if not opted in. ─
    let cycleContext: string | null = null
    if (cycleProfile?.cycle_type) {
      const { data: cycleInfo } = await serviceClient.rpc('compute_cycle_day', {
        p_user_id: user.id,
        p_captured_at: new Date().toISOString(),
      })
      const cycleDay = cycleInfo?.[0]?.cycle_day ?? null

      const { data: dailyLogs } = await serviceClient
        .from('daily_logs')
        .select('log_date, energy_level, emotions, body_signals')
        .eq('user_id', user.id)
        .order('log_date', { ascending: false })
        .limit(5)

      cycleContext = formatCycleContext(cycleProfile, cycleDay, dailyLogs ?? [])
    }

    // ── Layer 2: RAG retrieval ───────────────────────────────────────────────
    const queryEmbedding = await embedText(message)

    const { data: captures, error: rpcError } = await serviceClient.rpc('match_captures', {
      query_embedding: queryEmbedding,
      match_user_id: user.id,
      match_count: 10,
    })

    if (rpcError) {
      console.error('match_captures error:', rpcError)
    }

    const retrievedCaptures = captures ?? []

    // ── Build context ────────────────────────────────────────────────────────
    const hasMemory = memoryDocument.trim().length > 0
    const hasCaptures = retrievedCaptures.length > 0

    const systemPrompt = `You are Ki — a personal intelligence system. You help the user think more clearly by reflecting their own thoughts back to them, surfaced in context.

Your responses are grounded entirely in what the user has captured. You never hallucinate or invent. If the answer is not in their corpus, say so directly.

${hasMemory ? `Here is who this person is:\n\n${memoryDocument}\n\n` : ''}${cycleContext ? `Where the user is in their cycle right now:\n\n${cycleContext}\n\n` : ''}${hasCaptures ? `Here are the most relevant captures from their corpus — each is tagged with its cycle day where known, so you can notice patterns tied to where the user was in their cycle when they captured it:\n\n${formatCaptures(retrievedCaptures, cycleProfile)}\n\n` : 'The user has not captured enough thoughts yet for corpus-grounded answers. Encourage them to keep capturing.'}

Rules:
- Ground every claim in a specific capture. Reference it by date or title when relevant.
- Be direct. Don't pad. If you don't know, say so.
- Tone: thoughtful, grounded, like a thinking partner who has read everything they've ever written.
- Never reveal the memory document verbatim. Use it only as context.
- Cycle day/phase and daily logs are background, not something to volunteer. Only bring them up if the user asks directly about their cycle or patterns, or if you notice a genuine correlation — the same theme, emotion, or doubt recurring at the same phase across multiple captures. Otherwise don't mention it.`

    // ── Call Claude Sonnet ───────────────────────────────────────────────────
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: SONNET_MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          ...history,
          { role: 'user', content: message },
        ],
      }),
    })

    if (!claudeRes.ok) {
      const txt = await claudeRes.text()
      throw new Error(`Claude error ${claudeRes.status}: ${txt}`)
    }

    const claudeData = await claudeRes.json()
    const response = claudeData.content?.[0]?.text ?? 'No response.'

    // Return response + citations so the app can render them
    const citations = retrievedCaptures.slice(0, 5).map((c: {
      id: string
      title: string | null
      captured_at: string
      similarity: number
    }) => ({
      id: c.id,
      title: c.title,
      captured_at: c.captured_at,
      similarity: c.similarity,
    }))

    return new Response(
      JSON.stringify({ response, citations }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('chat-with-ki error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal error', response: 'Something went wrong. Please try again.' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
