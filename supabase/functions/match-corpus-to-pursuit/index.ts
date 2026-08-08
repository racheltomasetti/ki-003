// Ki — match-corpus-to-pursuit Edge Function
//
// Retroactive pursuit resonance pass. Called when a pursuit is promoted
// from curiosity → active (or created directly as active).
//
// Self-healing: if the pursuit has no core_question_embedding yet, this
// generates one from core_question and writes it before matching — so
// calling this function is also how a pursuit's embedding gets backfilled,
// not just how the corpus gets swept.
//
// Reads every capture in the user's corpus that has an embedding,
// computes cosine similarity against the pursuit's core_question_embedding,
// and for matches above RESONANCE_THRESHOLD generates a Claude reason and
// appends a PursuitConnection to enrichments.pursuit_connections.
//
// Existing connections for this pursuit_id (from previous passes) are
// replaced — only the latest pass is kept per pursuit per capture.
// Connections from other pursuits are left untouched.
//
// This function runs async (fire-and-forget from the app) and can take
// several seconds for large corpora. Call it; don't await a response body.
//
// Request body: { pursuit_id: string }

import { createClient } from 'npm:@supabase/supabase-js@2'

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'
const EMBEDDING_MODEL = 'text-embedding-3-small'
const RESONANCE_THRESHOLD = 0.40

// ─── Embedding ────────────────────────────────────────────────────────────────

async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI embedding error ${res.status}: ${text}`)
  }
  const data = await res.json()
  return data.data[0].embedding as number[]
}

// ─── Cosine similarity ────────────────────────────────────────────────────────

// pgvector columns come back as their textual form through PostgREST
// ("[0.1,0.2,...]" as a string), not a parsed array — always normalize both
// inputs here rather than trust callers to. Getting this wrong doesn't
// throw: string arithmetic silently produces NaN, and `NaN < threshold` is
// always false, so a broken comparison looks like "everything matches."
function parseEmbedding(value: unknown): number[] {
  if (Array.isArray(value)) return value as number[]
  if (typeof value === 'string') return JSON.parse(value) as number[]
  throw new Error('Unexpected embedding format — expected array or JSON string')
}

function cosineSimilarity(aRaw: unknown, bRaw: unknown): number {
  const a = parseEmbedding(aRaw)
  const b = parseEmbedding(bRaw)
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

// ─── Reason generation ────────────────────────────────────────────────────────

async function generateResonanceReason(
  captureBody: string,
  pursuitName: string,
  coreQuestion: string,
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: 200,
      system: `You are Ki. Explain in one clear sentence why this capture resonates with the user's pursuit. Be specific and grounded — reference what is actually in the capture and how it touches the pursuit's core question. Do not be generic. Do not say "this capture resonates because" — just write the reason directly.`,
      messages: [
        {
          role: 'user',
          content: `Pursuit: "${pursuitName}"\nCore question: "${coreQuestion}"\n\nCapture:\n${captureBody}`,
        },
      ],
    }),
  })

  if (!res.ok) {
    console.warn(`reason generation failed: ${res.status}`)
    return `Relates to your pursuit of ${pursuitName}.`
  }

  const data = await res.json()
  return (data.content?.[0]?.text ?? '').trim()
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let pursuitId: string | null = null

  try {
    const body = await req.json()
    pursuitId = body.pursuit_id

    if (!pursuitId) {
      return new Response('pursuit_id required', { status: 400 })
    }

    // Fetch the pursuit — must be active and have a core_question
    const { data: pursuit, error: pursuitErr } = await supabase
      .from('pursuits')
      .select('id, user_id, name, core_question, status')
      .eq('id', pursuitId)
      .single()

    if (pursuitErr || !pursuit) {
      return new Response('pursuit not found', { status: 404 })
    }

    if (pursuit.status !== 'active') {
      return new Response('pursuit is not active', { status: 400 })
    }

    if (!pursuit.core_question) {
      return new Response('pursuit has no core_question to embed', { status: 400 })
    }

    // Always regenerate from the current core_question — cheap, and the only
    // way to guarantee the embedding can never silently go stale after an
    // edit (PursuitSettingsClient lets core_question change after creation).
    const pursuitEmbedding = await generateEmbedding(pursuit.core_question)
    const { error: embedErr } = await supabase
      .from('pursuits')
      .update({ core_question_embedding: pursuitEmbedding })
      .eq('id', pursuitId)
    if (embedErr) throw embedErr

    const matchedAt = new Date().toISOString()

    // Fetch all captures for this user that have an embedding
    // Join through enrichments to get the embedding
    const { data: enrichments, error: enrichErr } = await supabase
      .from('enrichments')
      .select(`
        capture_id,
        embedding,
        pursuit_connections,
        captures!inner ( id, user_id, body, status )
      `)
      .eq('captures.user_id', pursuit.user_id)
      .eq('captures.status', 'active')
      .eq('enrichment_status', 'complete')
      .not('embedding', 'is', null)

    if (enrichErr) throw enrichErr

    if (!enrichments || enrichments.length === 0) {
      console.log(`match-corpus-to-pursuit: no enriched captures for user ${pursuit.user_id}`)
      return new Response(JSON.stringify({ matched: 0, processed: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let processed = 0
    let matched = 0

    for (const row of enrichments) {
      const captureEmbedding = row.embedding as number[]
      const confidence = cosineSimilarity(captureEmbedding, pursuitEmbedding)
      processed++

      // Build the updated connections array for this capture.
      // Keep connections for other pursuits; replace/add for this pursuit.
      const existing: Array<Record<string, unknown>> =
        Array.isArray(row.pursuit_connections) ? row.pursuit_connections : []
      const withoutThisPursuit = existing.filter(
        (c) => c.pursuit_id !== pursuitId
      )

      if (confidence < RESONANCE_THRESHOLD) {
        // If we previously had a connection for this pursuit, remove it
        if (withoutThisPursuit.length !== existing.length) {
          await supabase
            .from('enrichments')
            .update({ pursuit_connections: withoutThisPursuit.length > 0 ? withoutThisPursuit : null })
            .eq('capture_id', row.capture_id)
        }
        continue
      }

      // Generate reason for this match
      const capture = row.captures as unknown as { body: string | null }
      if (!capture.body) continue

      const reason = await generateResonanceReason(
        capture.body,
        pursuit.name,
        pursuit.core_question,
      )

      const newConnection = {
        pursuit_id: pursuitId,
        reason,
        confidence: Math.round(confidence * 1000) / 1000,
        matched_at: matchedAt,
      }

      const updatedConnections = [...withoutThisPursuit, newConnection]

      const { error: writeErr } = await supabase
        .from('enrichments')
        .update({ pursuit_connections: updatedConnections })
        .eq('capture_id', row.capture_id)

      if (writeErr) {
        console.error(`failed to write connection for capture ${row.capture_id}`, writeErr)
        continue
      }

      matched++
    }

    console.log(`match-corpus-to-pursuit: pursuit ${pursuitId} — ${matched} matches from ${processed} captures`)

    return new Response(JSON.stringify({ matched, processed }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error(`match-corpus-to-pursuit: failed for pursuit ${pursuitId}`, err)
    return new Response('internal error', { status: 500 })
  }
})
