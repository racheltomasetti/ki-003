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
    // Include the capture ID so Claude can reference it in propose_artifact
    return `[${title}${starred} — ${date}${cycleTag} | id:${c.id}]\n${c.body ?? ''}`
  }).join('\n\n---\n\n')
}

// ─── Artifacts ────────────────────────────────────────────────────────────
// Mirrors packages/types/src/app.ts's Artifact union — duplicated because
// Deno edge functions can't import across the pnpm workspace boundary
// (same reason CycleProfile/DailyLog are duplicated above). v1: 'prose' only.

interface Artifact {
  kind: 'prose'
  title?: string
  text: string
  referenced_capture_ids: string[]
}

const PROPOSE_ARTIFACT_TOOL = {
  name: 'propose_artifact',
  description:
    'Place a finished piece of writing into the user\'s Create panel — a surface next to this ' +
    'conversation, not a reply in it. Call this when the user explicitly asks you to draft, write, ' +
    'distill, or create something concrete (a paragraph, a stance, a summary, a piece of writing they ' +
    'could copy and use elsewhere), or when the conversation has clearly produced something that wants ' +
    'to exist as standalone writing and proposing it is a natural next step. Most messages are ' +
    'conversational only — do not call this tool by default.',
  input_schema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'A short title for the artifact, under 60 characters. Optional but preferred.',
      },
      text: {
        type: 'string',
        description:
          'The full text of the artifact — clean, standalone prose the user could copy and use ' +
          'elsewhere. This is the artifact; do not repeat it inside your conversational reply.',
      },
      referenced_capture_ids: {
        type: 'array',
        items: { type: 'string' },
        description:
          'UUIDs (the id: value on each capture listed above) this artifact draws from. Include every ' +
          'id you actually drew from — that is the norm. An empty array is acceptable only when the ' +
          'user explicitly asked for something written from scratch, not grounded in their captures. ' +
          'Never invent an id you were not given.',
      },
    },
    required: ['text', 'referenced_capture_ids'],
  },
} as const

function validateArtifact(input: unknown, validCaptureIds: Set<string>): Artifact | undefined {
  if (!input || typeof input !== 'object') return undefined
  const a = input as Record<string, unknown>
  if (typeof a.text !== 'string' || !a.text.trim()) return undefined
  const ids = Array.isArray(a.referenced_capture_ids)
    ? a.referenced_capture_ids.filter((x): x is string => typeof x === 'string' && validCaptureIds.has(x))
    : []
  return {
    kind: 'prose',
    title: typeof a.title === 'string' && a.title.trim() ? a.title.trim() : undefined,
    text: a.text,
    referenced_capture_ids: ids,
  }
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
    const { message, history = [], current_artifact = null } = await req.json() as {
      message: string
      history: Array<{ role: 'user' | 'assistant'; content: string }>
      current_artifact: { title?: string; text: string } | null
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
${current_artifact ? `The user currently has this in their Create panel:\n\n"""\n${current_artifact.text}\n"""\n\nIf they are asking you to revise, tighten, extend, or otherwise change it, call propose_artifact again with the FULL revised text — your output replaces what is there now, it is not a diff.\n\n` : ''}You also have access to a Create panel via the propose_artifact tool — a side surface next to this conversation, not this chat itself. Whenever the user explicitly asks you to write, draft, distill, or create something concrete, you MUST call propose_artifact in that same turn — it is not optional, and it is the only way anything actually appears in their Create panel. Saying you will create, draft, or put something there in your conversational reply, without calling the tool, accomplishes nothing — never do that; if you say it's there, it must actually be there via the tool call. For messages that are purely conversational, with no request to produce something concrete, don't call the tool — most messages stay conversational only.

Rules:
- Ground every claim in a specific capture. Reference it by date or title when relevant.
- Be direct. Don't pad. If you don't know, say so.
- Tone: thoughtful, grounded, like a thinking partner who has read everything they've ever written.
- Never reveal the memory document verbatim. Use it only as context.
- Cycle day/phase and daily logs are background, not something to volunteer. Only bring them up if the user asks directly about their cycle or patterns, or if you notice a genuine correlation — the same theme, emotion, or doubt recurring at the same phase across multiple captures. Otherwise don't mention it.
- When you call propose_artifact, briefly acknowledge what you did in your reply (e.g. "I've put a draft of that in your Create panel") — do not restate the artifact's full text in the reply.`

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
        max_tokens: 1600,
        system: systemPrompt,
        tools: [PROPOSE_ARTIFACT_TOOL],
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
    const blocks: Array<{ type: string; text?: string; name?: string; input?: unknown }> = claudeData.content ?? []
    const response = blocks.filter(b => b.type === 'text').map(b => b.text ?? '').join('').trim() || 'No response.'

    const toolUse = blocks.find(b => b.type === 'tool_use' && b.name === 'propose_artifact')
    const validCaptureIds = new Set<string>(retrievedCaptures.map((c: { id: string }) => c.id))
    const artifact = toolUse ? validateArtifact(toolUse.input, validCaptureIds) : undefined

    // ── Artifact diagnostics — remove once propose_artifact is reliable ────────
    console.log('[chat-with-ki:artifact]', JSON.stringify({
      stop_reason: claudeData.stop_reason,
      block_types: blocks.map(b => b.type),
      tool_use_present: Boolean(toolUse),
      tool_input: toolUse ? toolUse.input : null,
      artifact_valid: Boolean(artifact),
    }))

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
      JSON.stringify({ response, citations, artifact }),
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
