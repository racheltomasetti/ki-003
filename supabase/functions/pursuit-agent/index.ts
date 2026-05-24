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
  }> | null
}

interface PursuitRow {
  id: string
  user_id: string
  name: string
  core_question: string | null
  what: string | null
  why: string | null
  success_looks_like: string | null
  open_question: string | null
  pursuit_mode: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPursuitContext(pursuit: PursuitRow): string {
  const lines: string[] = [`Pursuit: ${pursuit.name}`]
  if (pursuit.core_question) lines.push(`Core question: ${pursuit.core_question}`)
  if (pursuit.what) lines.push(`What they're working on: ${pursuit.what}`)
  if (pursuit.why) lines.push(`Why it matters to them: ${pursuit.why}`)
  if (pursuit.success_looks_like) lines.push(`What success looks like: ${pursuit.success_looks_like}`)
  if (pursuit.open_question) lines.push(`Biggest open question they're sitting with: ${pursuit.open_question}`)
  if (pursuit.pursuit_mode) lines.push(`Pursuit mode: ${pursuit.pursuit_mode}`)
  return lines.join('\n')
}

function formatCaptures(captures: RawCapture[]): string {
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

    // Include the capture ID so Claude can cite it precisely
    let text = `[${label}${starred} — ${date} | id:${c.id}]\n${c.body ?? '(no text body)'}`

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
      .select('id, user_id, name, core_question, what, why, success_looks_like, open_question, pursuit_mode')
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
          enrichments ( summary, themes, questions_raised )
        )
      `)
      .eq('pursuit_id', pursuit_id)
      .order('created_at', { ascending: true })

    const captures: RawCapture[] = (captureRows ?? [])
      .map((row: { captures: unknown }) => {
        const raw = row.captures
        return (Array.isArray(raw) ? raw[0] : raw) as RawCapture | undefined
      })
      .filter((c): c is RawCapture => Boolean(c) && Boolean(c.body))

    // ── Load memory document ──────────────────────────────────────────────────
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('memory_document')
      .eq('id', user.id)
      .single()

    const memoryDocument = profile?.memory_document?.trim() ?? ''

    // ── Map conversation roles for Claude API ─────────────────────────────────
    const mappedHistory = conversation_history.map(m => ({
      role: m.role === 'hero' ? 'user' : 'assistant' as 'user' | 'assistant',
      content: m.content,
    }))

    // ── Build system prompt ───────────────────────────────────────────────────
    const systemPrompt = `You are Ki — a thinking partner built for builders and creators.

You are working inside a specific pursuit. The user has captured raw thoughts here — voice recordings, observations, ideas. Your job is to help them think: surface what they're actually saying, find the threads that matter, and help them arrive at clarity.

${memoryDocument ? `Here is who this person is:\n\n${memoryDocument}\n\n` : ''}Here is the pursuit context:

${formatPursuitContext(pursuit as PursuitRow)}

Here are all their captured thoughts in this pursuit (each has an id field):

${formatCaptures(captures)}

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
- The citations block must be valid JSON.`

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

    // ── Parse response ────────────────────────────────────────────────────────
    const responseMatch = rawText.match(/<response>([\s\S]*?)<\/response>/)
    const response = responseMatch?.[1]?.trim() ?? rawText

    // ── Parse citations ───────────────────────────────────────────────────────
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
