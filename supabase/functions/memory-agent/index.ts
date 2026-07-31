import { createClient } from 'npm:@supabase/supabase-js@2'

const SONNET_MODEL = 'claude-sonnet-4-6'
const MAX_TOOL_ROUNDS = 4
const MAX_CAPTURES = 80
const BODY_CHARS = 500

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface CaptureRow {
  id: string
  title: string | null
  body: string | null
  captured_at: string
  is_starred: boolean
}

interface ContentBlock {
  type: string
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  // tool_result
  tool_use_id?: string
  content?: string
}

const UPDATE_MEMORY_DRAFT_TOOL = {
  name: 'update_memory_draft',
  description:
    'Rewrite the user\'s memory document draft in markdown. Call this whenever you have an improved version of the document. The draft is applied live in their editor — it is not saved to the database until they press Save.',
  input_schema: {
    type: 'object',
    properties: {
      draft: {
        type: 'string',
        description: 'The full updated memory document in markdown.',
      },
      summary: {
        type: 'string',
        description: 'One short sentence describing what you changed.',
      },
    },
    required: ['draft'],
  },
}

function formatCaptures(captures: CaptureRow[]): string {
  if (captures.length === 0) {
    return 'No captures yet. Help them write from what they share in conversation.'
  }

  return captures.map((c, i) => {
    const date = new Date(c.captured_at).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
    const starred = c.is_starred ? ' ★' : ''
    const label = c.title?.trim() || `Capture ${i + 1}`
    const body = (c.body ?? '').trim()
    const truncated = body.length > BODY_CHARS
      ? `${body.slice(0, BODY_CHARS)}…`
      : body || '(empty)'
    return `[${label}${starred} — ${date}]\n${truncated}`
  }).join('\n\n---\n\n')
}

function extractText(content: ContentBlock[]): string {
  return content
    .filter(b => b.type === 'text' && b.text)
    .map(b => b.text!)
    .join('\n')
    .trim()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const { data: { user }, error: authError } = await serviceClient.auth.getUser(token)
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  try {
    const {
      message,
      conversation_history = [],
      current_document = '',
    } = await req.json() as {
      message: string
      conversation_history?: Array<{ role: 'user' | 'assistant'; content: string }>
      current_document?: string
    }

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: 'message is required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // ── Load captures (newest first, truncated for token budget) ─────────────
    const { data: captureRows } = await serviceClient
      .from('captures')
      .select('id, title, body, captured_at, is_starred')
      .eq('user_id', user.id)
      .neq('status', 'deleted')
      .is('parent_id', null)
      .order('captured_at', { ascending: false })
      .limit(MAX_CAPTURES)

    const captures = (captureRows ?? []) as CaptureRow[]

    // ── Prefer client draft; fall back to saved profile doc ──────────────────
    let workingDraft = (current_document ?? '').trim()
    if (!workingDraft) {
      const { data: profile } = await serviceClient
        .from('profiles')
        .select('memory_document')
        .eq('id', user.id)
        .single()
      workingDraft = profile?.memory_document?.trim() ?? ''
    }

    const systemPrompt = `You are Ki — a thinking partner helping this person write their living memory document.

The memory document is markdown. It is the identity layer Ki reads before every conversation: who they are, what they are carrying, how they want you to show up. It should feel written by them — direct, personal, unfinished is fine.

You have access to their captures (raw thoughts from their corpus) and the current draft of the document.

Your job:
- Interview lightly when the draft is empty or thin — ask what matters, how they think, what they want from Ki.
- When you have enough signal, call update_memory_draft with a full coherent markdown document.
- Ground everything in what they have actually said or captured. Do not invent biography.
- Prefer a clear, readable document over rigid section templates. Headings are fine if they help; not required.
- Iterate: each tool call replaces the whole draft. Keep what still fits; revise what does not.
- After updating the draft, briefly tell them what you changed and what to try next. Do not dump the full document into chat.

Current memory draft:
${workingDraft || '(empty — help them start)'}

Their captures (${captures.length} most recent, truncated):
${formatCaptures(captures)}`

    type ClaudeMessage = {
      role: 'user' | 'assistant'
      content: string | ContentBlock[]
    }

    const messages: ClaudeMessage[] = [
      ...conversation_history.map(m => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: message.trim() },
    ]

    let responseText = ''
    let latestDraft: string | undefined
    let latestSummary: string | undefined

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: SONNET_MODEL,
          max_tokens: 4000,
          system: systemPrompt,
          tools: [UPDATE_MEMORY_DRAFT_TOOL],
          messages,
        }),
      })

      if (!claudeRes.ok) {
        const txt = await claudeRes.text()
        throw new Error(`Claude error ${claudeRes.status}: ${txt}`)
      }

      const claudeData = await claudeRes.json() as {
        stop_reason: string
        content: ContentBlock[]
      }

      const content = claudeData.content ?? []
      messages.push({ role: 'assistant', content })

      const text = extractText(content)
      if (text) responseText = text

      if (claudeData.stop_reason !== 'tool_use') break

      const toolUses = content.filter(b => b.type === 'tool_use')
      const toolResults: ContentBlock[] = []

      for (const tool of toolUses) {
        if (tool.name === 'update_memory_draft' && tool.id) {
          const draft = typeof tool.input?.draft === 'string' ? tool.input.draft : ''
          const summary = typeof tool.input?.summary === 'string' ? tool.input.summary : undefined
          if (draft.trim()) {
            latestDraft = draft
            workingDraft = draft
            latestSummary = summary
            toolResults.push({
              type: 'tool_result',
              tool_use_id: tool.id,
              content: JSON.stringify({
                ok: true,
                applied: true,
                note: 'Draft applied in the editor. User still needs to Save to persist.',
                summary: summary ?? null,
              }),
            })
          } else {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: tool.id,
              content: JSON.stringify({ ok: false, error: 'draft was empty' }),
            })
          }
        } else if (tool.id) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tool.id,
            content: JSON.stringify({ ok: false, error: 'unknown tool' }),
          })
        }
      }

      messages.push({ role: 'user', content: toolResults })
    }

    return new Response(
      JSON.stringify({
        response: responseText || (latestDraft
          ? (latestSummary ?? 'Updated your memory draft. Review it in the editor and Save when ready.')
          : 'Something went quiet — try again.'),
        draft: latestDraft,
        summary: latestSummary,
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('memory-agent error:', err)
    return new Response(
      JSON.stringify({
        error: 'Internal error',
        response: 'Something went wrong. Please try again.',
      }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
