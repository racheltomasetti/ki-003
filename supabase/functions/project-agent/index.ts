// Ki — project-agent Edge Function
//
// The thinking partner for a specific project workspace.
//
// Loads ALL captures in the project (full focused corpus, no RAG needed),
// layers project context + memory document + conversation history,
// then helps the user distill their thinking via Claude Sonnet.
//
// Returns: { response, distilled_text?, citations }
//
// distilled_text is optional — Ki only proposes one when something has
// genuinely crystallized in the conversation. Not on every message.

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

interface ProjectRow {
  id: string
  user_id: string
  name: string
  what: string | null
  why: string | null
  success_looks_like: string | null
  open_question: string | null
  project_mode: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatProjectContext(project: ProjectRow): string {
  const lines: string[] = [`Project: ${project.name}`]
  if (project.what) lines.push(`What they're working on: ${project.what}`)
  if (project.why) lines.push(`Why it matters to them: ${project.why}`)
  if (project.success_looks_like) lines.push(`What success looks like: ${project.success_looks_like}`)
  if (project.open_question) lines.push(`Biggest open question they're sitting with: ${project.open_question}`)
  if (project.project_mode) lines.push(`Project mode: ${project.project_mode}`)
  return lines.join('\n')
}

function formatCaptures(captures: RawCapture[]): string {
  if (captures.length === 0) {
    return 'No captures have been added to this project yet.'
  }

  return captures.map((c, i) => {
    const date = new Date(c.captured_at).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    })
    const starred = c.is_starred ? ' ★' : ''
    const label = c.title ? `"${c.title}"` : `Capture ${i + 1}`
    const enrichment = Array.isArray(c.enrichments) ? c.enrichments[0] : c.enrichments

    let text = `[${label}${starred} — ${date}]\n${c.body ?? '(no text body)'}`

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
    const { project_id, message, conversation_history = [] } = await req.json() as {
      project_id: string
      message: string
      conversation_history: Array<{ role: 'user' | 'assistant'; content: string }>
    }

    if (!project_id?.trim() || !message?.trim()) {
      return new Response(
        JSON.stringify({ error: 'project_id and message are required' }),
        { status: 400, headers: CORS_HEADERS }
      )
    }

    // ── Load project (verify ownership) ──────────────────────────────────────
    const { data: project, error: projectError } = await serviceClient
      .from('projects')
      .select('id, user_id, name, what, why, success_looks_like, open_question, project_mode')
      .eq('id', project_id)
      .eq('user_id', user.id)
      .single()

    if (projectError || !project) {
      return new Response(JSON.stringify({ error: 'Project not found' }), { status: 404, headers: CORS_HEADERS })
    }

    // ── Load all project captures + enrichments ───────────────────────────────
    const { data: captureRows } = await serviceClient
      .from('capture_projects')
      .select(`
        captures (
          id, title, body, captured_at, source_type, is_starred,
          enrichments ( summary, themes, questions_raised )
        )
      `)
      .eq('project_id', project_id)
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

    // ── Build system prompt ───────────────────────────────────────────────────
    const systemPrompt = `You are Ki — a thinking partner built for builders and creators.

You are working inside a specific project. The user has captured raw thoughts here — voice recordings, observations, ideas. Your job is to help them think: surface what they're actually saying, find the threads that matter, and help them arrive at clarity.

${memoryDocument ? `Here is who this person is:\n\n${memoryDocument}\n\n` : ''}Here is the project context:

${formatProjectContext(project as ProjectRow)}

Here are all their captured thoughts in this project:

${formatCaptures(captures)}

---

Your responses are grounded in what the user has actually captured. You do not invent or hallucinate. If something is not in the corpus, say so directly.

The user has a text area called the "thought distiller" where they can build and refine a piece of writing together with you. You can read whatever is currently in it (they may include it in their message). You can suggest edits, rewrites, additions, or entirely new drafts. This text should be clean and portable — something they could paste into a document, hand to a collaborator, or feed to another AI. No references to "our conversation." Just clear thinking made usable.

Occasionally — only when the conversation has produced something genuinely concrete — include a distilled_text in your response. A distilled thought is clean, standalone prose the user could use immediately. Do not force it. Most responses should be conversational. Only crystallize when something real has emerged.

Structure your response using these XML tags:

<response>
Your conversational reply — direct, grounded, like a thinking partner who has read everything they have written.
</response>

<distilled>
Only include this tag when something has genuinely crystallized — clean standalone prose the user could paste anywhere. Omit this tag entirely if nothing concrete has emerged. Most responses should not include it.
</distilled>

Rules:
- Be direct. No filler, no padding, no "great question!".
- Reference specific captures by title or date when relevant.
- Never reveal the memory document verbatim — use it only as context.
- Content inside <distilled> must stand alone — no references to this conversation, no jargon.`

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
          ...conversation_history,
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

    // ── Parse XML tags ────────────────────────────────────────────────────────
    const responseMatch = rawText.match(/<response>([\s\S]*?)<\/response>/)
    const distilledMatch = rawText.match(/<distilled>([\s\S]*?)<\/distilled>/)

    const response = responseMatch?.[1]?.trim() ?? rawText
    const distilled_text = distilledMatch?.[1]?.trim() || undefined

    // ── Citations — the captures Ki drew from ────────────────────────────────
    const citations = captures.map(c => ({
      id: c.id,
      title: c.title,
      captured_at: c.captured_at,
    }))

    return new Response(
      JSON.stringify({ response, distilled_text, citations }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('project-agent error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal error', response: 'Something went wrong. Please try again.' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
