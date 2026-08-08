import { createClient } from 'npm:@supabase/supabase-js@2'

const SONNET_MODEL = 'claude-sonnet-4-6'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawCapture {
  id: string
  title: string | null
  body: string | null
  captured_at: string
  source_type: string
  is_starred: boolean
  enrichments?: Array<{
    summary: string | null
    themes: string[] | null
    questions_raised: string[] | null
    cycle_day: number | null
  }> | null
}

interface PursuitRow {
  id: string
  user_id: string
  name: string
  core_question: string | null
  description: string | null
  pursuit_mode: string | null
}

// ─── Cycle context ──────────────────────────────────────────────────────────
// Ported from packages/utils/src/cycle.ts — Deno edge functions can't
// resolve pnpm workspace packages, so pure phase-derivation logic is
// duplicated here (same pattern as chat-with-ki and enrich-capture's
// getTimeOfDayCat). cycle_day is stamped by Postgres; phase is always
// derived at read time, never stored. See docs/active/cycle-tracker.md Phase C.

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

/** Per-capture cycle day tag for pursuit context — the piece that lets Ki spot patterns. */
function formatCaptureCycleTag(cycleDay: number | null, profile: CycleProfile | null): string {
  if (cycleDay == null || !profile?.cycle_type) return ''
  const length = profile.average_cycle_length ?? 28
  const periodLength = profile.average_period_length ?? 5
  const { label } = resolveCyclePhase(cycleDay, length, periodLength)
  return ` · cycle day ${cycleDay} (${label})`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPursuitContext(pursuit: PursuitRow): string {
  const lines: string[] = [`Pursuit: ${pursuit.name}`]
  if (pursuit.core_question) lines.push(`Core question: ${pursuit.core_question}`)
  if (pursuit.description) lines.push(`What they're carrying: ${pursuit.description}`)
  if (pursuit.pursuit_mode) lines.push(`Pursuit mode: ${pursuit.pursuit_mode}`)
  return lines.join('\n')
}

function formatCaptures(captures: RawCapture[], cycleProfile: CycleProfile | null): string {
  if (captures.length === 0) {
    return 'No captures have been added to this pursuit yet.'
  }

  return captures.map((c, i) => {
    const date = new Date(c.captured_at).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    })
    const starred = c.is_starred ? ' ★' : ''
    const label = c.title ?? `Capture ${i + 1}`
    const enrichment = Array.isArray(c.enrichments) ? c.enrichments[0] : c.enrichments
    const cycleTag = formatCaptureCycleTag(enrichment?.cycle_day ?? null, cycleProfile)

    // Include the capture ID so Claude can cite it precisely
    let text = `[${label}${starred} — ${date}${cycleTag} | id:${c.id}]\n${c.body ?? '(no text body)'}`

    if (enrichment?.summary) text += `\nSummary: ${enrichment.summary}`
    if (enrichment?.themes?.length) text += `\nThemes: ${enrichment.themes.join(', ')}`
    if (enrichment?.questions_raised?.length) {
      text += `\nQuestions raised: ${enrichment.questions_raised.join(' / ')}`
    }

    return text
  }).join('\n\n---\n\n')
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

  // Auth
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
    const { pursuit_id, message, conversation_history = [] } = await req.json() as {
      pursuit_id: string
      message: string
      conversation_history: Array<{ role: 'hero' | 'ki'; content: string }>
    }

    if (!pursuit_id?.trim() || !message?.trim()) {
      return new Response(
        JSON.stringify({ error: 'pursuit_id and message are required' }),
        { status: 400, headers: CORS_HEADERS }
      )
    }

    // ── Load pursuit (verify ownership) ──────────────────────────────────────
    const { data: pursuit, error: pursuitError } = await serviceClient
      .from('pursuits')
      .select('id, user_id, name, core_question, description, pursuit_mode')
      .eq('id', pursuit_id)
      .eq('user_id', user.id)
      .single()

    if (pursuitError || !pursuit) {
      return new Response(JSON.stringify({ error: 'Pursuit not found' }), { status: 404, headers: CORS_HEADERS })
    }

    // ── Load all pursuit captures + enrichments ───────────────────────────────
    const { data: captureRows } = await serviceClient
      .from('capture_pursuits')
      .select(`
        captures (
          id, title, body, captured_at, source_type, is_starred,
          enrichments ( summary, themes, questions_raised, cycle_day )
        )
      `)
      .eq('pursuit_id', pursuit_id)
      .order('created_at', { ascending: true })

    const captures: RawCapture[] = (captureRows ?? [])
      .map((row: { captures: unknown }) => {
        const raw = row.captures
        return (Array.isArray(raw) ? raw[0] : raw) as RawCapture | undefined
      })
      .filter((c): c is RawCapture => c !== undefined && Boolean(c.body))

    // ── Load memory document + cycle preferences ──────────────────────────────
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('memory_document, cycle_type, average_cycle_length, average_period_length')
      .eq('id', user.id)
      .single()

    const memoryDocument = profile?.memory_document?.trim() ?? ''
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

    // ── Map conversation roles for Claude API ─────────────────────────────────
    const mappedHistory = conversation_history.map(m => ({
      role: m.role === 'hero' ? 'user' : 'assistant' as 'user' | 'assistant',
      content: m.content,
    }))

    // ── Build system prompt ───────────────────────────────────────────────────
    const systemPrompt = `You are Ki — a thinking partner built for builders and creators.

You are working inside a specific pursuit. The user has captured raw thoughts here — voice recordings, observations, ideas. Your job is to help them think: surface what they're actually saying, find the threads that matter, and help them arrive at clarity.

${memoryDocument ? `Here is who this person is:\n\n${memoryDocument}\n\n` : ''}${cycleContext ? `Where the user is in their cycle right now:\n\n${cycleContext}\n\n` : ''}Here is the pursuit context:

${formatPursuitContext(pursuit as PursuitRow)}

Here are all their captured thoughts in this pursuit (each has an id field, and a cycle day tag where known — notice patterns tied to where the user was in their cycle when they captured it):

${formatCaptures(captures, cycleProfile)}

---

Your responses are grounded in what the user has actually captured. You do not invent or hallucinate. If something is not in the corpus, say so directly.

Structure your response using these XML tags:

<response>
Your conversational reply — direct, grounded, like a thinking partner who has read everything they have written.
</response>

<citations>
A JSON array of captures you actually drew from. Include the capture id and, where applicable, a short verbatim quote (max 120 chars) of the specific text your response references. Omit quote if referencing the capture generally.
Example: [{"id": "abc-123", "quote": "the specific words you pulled"}, {"id": "def-456"}]
Only include captures you genuinely referenced. Return an empty array if none.
</citations>

Rules:
- Be direct. No filler, no padding, no "great question!".
- Reference specific captures by title or date when relevant. Do not wrap capture titles in quotation marks.
- When quoting the user's words verbatim, use a markdown blockquote (lines starting with >). Do not wrap verbatim quotes in asterisks or quotation marks.
- When naming a capture, use its title in plain text with no quotation marks around it.
- Never reveal the memory document verbatim — use it only as context.
- The citations block must be valid JSON.
- Cycle day/phase and daily logs are background, not something to volunteer. Only bring them up if the user asks directly about their cycle or patterns, or if you notice a genuine correlation — the same theme, emotion, or doubt recurring at the same phase across multiple captures. Otherwise don't mention it.`

    // ── Call Claude Sonnet ────────────────────────────────────────────────────
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: SONNET_MODEL,
        max_tokens: 1500,
        system: systemPrompt,
        messages: [
          ...mappedHistory,
          { role: 'user', content: message },
        ],
      }),
    })

    if (!claudeRes.ok) {
      const txt = await claudeRes.text()
      throw new Error(`Claude error ${claudeRes.status}: ${txt}`)
    }

    const claudeData = await claudeRes.json()
    const rawText: string = claudeData.content?.[0]?.text ?? ''

    // ── Parse citations (before response — strip so they never leak into chat) ─
    const citationsMatch = rawText.match(/<citations>([\s\S]*?)<\/citations>/)
    let citations: Array<{ id: string; title: string | null; captured_at: string; quote?: string }> = []

    if (citationsMatch) {
      try {
        const raw: Array<{ id: string; quote?: string }> = JSON.parse(citationsMatch[1].trim())
        // Only include IDs that actually exist in this pursuit's captures
        const validIds = new Set(captures.map(c => c.id))
        const seenIds = new Set<string>()
        citations = raw
          .filter(c => validIds.has(c.id) && !seenIds.has(c.id) && (seenIds.add(c.id), true))
          .map(c => {
            const cap = captures.find(cap => cap.id === c.id)!
            return {
              id: c.id,
              title: cap.title,
              captured_at: cap.captured_at,
              ...(c.quote ? { quote: c.quote } : {}),
            }
          })
      } catch {
        // Malformed JSON — citations stay empty
      }
    }

    // ── Parse response — never return the raw citations block to the client ───
    const withoutCitations = rawText
      .replace(/<citations>[\s\S]*?<\/citations>/g, '')
      .trim()
    const responseMatch = withoutCitations.match(/<response>([\s\S]*?)<\/response>/)
    const response = (responseMatch?.[1] ?? withoutCitations)
      .replace(/<\/?response>/g, '')
      .trim()

    return new Response(
      JSON.stringify({ response, citations }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('pursuit-agent error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal error', response: 'Something went wrong. Please try again.' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
