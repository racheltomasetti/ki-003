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

// ─── Format captures for Claude context ──────────────────────────────────────

function formatCaptures(captures: Array<{
  id: string
  body: string | null
  title: string | null
  captured_at: string
  type: string
  is_starred: boolean
}>): string {
  return captures.map((c, i) => {
    const date = new Date(c.captured_at).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    })
    const starred = c.is_starred ? ' ★' : ''
    const title = c.title ? `"${c.title}"` : `Capture ${i + 1}`
    return `[${title}${starred} — ${date}]\n${c.body ?? ''}`
  }).join('\n\n---\n\n')
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Service client — used for all DB operations and JWT verification
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

  // Verify the user's JWT by passing the token directly to getUser()
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const { data: { user }, error: authError } = await serviceClient.auth.getUser(token)
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  try {
    const { message, history = [] } = await req.json() as {
      message: string
      history: Array<{ role: 'user' | 'assistant'; content: string }>
    }

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: 'No message provided' }), { status: 400 })
    }

    // ── Layer 1: memory document ─────────────────────────────────────────────
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('memory_document')
      .eq('id', user.id)
      .single()

    const memoryDocument = profile?.memory_document ?? ''

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

${hasMemory ? `Here is who this person is:\n\n${memoryDocument}\n\n` : ''}${hasCaptures ? `Here are the most relevant captures from their corpus:\n\n${formatCaptures(retrievedCaptures)}\n\n` : 'The user has not captured enough thoughts yet for corpus-grounded answers. Encourage them to keep capturing.'}

Rules:
- Ground every claim in a specific capture. Reference it by date or title when relevant.
- Be direct. Don't pad. If you don't know, say so.
- Tone: thoughtful, grounded, like a thinking partner who has read everything they've ever written.
- Never reveal the memory document verbatim. Use it only as context.`

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
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('chat-with-ki error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal error', response: 'Something went wrong. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
