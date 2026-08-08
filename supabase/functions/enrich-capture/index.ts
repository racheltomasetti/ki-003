// Ki — enrich-capture Edge Function
//
// Triggered by a Postgres webhook on captures INSERT.
// Fetches the capture body + user memory document, calls Claude Haiku for
// structured enrichment, generates a vector embedding, writes everything
// to the enrichments row, and then runs pursuit resonance matching.
//
// Pursuit resonance: cosine similarity between the capture embedding and each
// active pursuit's core_question_embedding. Matches above RESONANCE_THRESHOLD
// get a Claude-generated reason and are written to enrichments.pursuit_connections.
//
// The pending row already exists (created by the create_pending_enrichment
// trigger), so this always UPDATEs, never INSERTs.
//
// The capture is never touched on failure — only enrichment_status is set to
// 'failed'. The capture pipeline is always unblocked.

import { createClient } from 'npm:@supabase/supabase-js@2'

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'
const EMBEDDING_MODEL = 'text-embedding-3-small'
const RESONANCE_THRESHOLD = 0.40

// ─── Time of day ─────────────────────────────────────────────────────────────
// Derived from captured_at server-side. Never from Claude.

function getTimeOfDayCat(capturedAt: string): string {
  const hour = new Date(capturedAt).getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

// ─── Auto-title ───────────────────────────────────────────────────────────────
// First sentence of summary, capped at 100 chars.

function firstSentence(summary: string): string {
  const match = summary.match(/^[^.!?]+[.!?]/)
  return match ? match[0].trim() : summary.slice(0, 100).trim()
}

// ─── Enum sanitizers ──────────────────────────────────────────────────────────
// With the forced tool schema these should never fire — but never let an
// out-of-range value crash the write, and log loudly when one is discarded
// so "not extracting" stays diagnosable.

const VALID_SENTIMENTS = ['positive', 'neutral', 'negative', 'mixed']
const VALID_ENERGY_LEVELS = ['low', 'medium', 'high']
const VALID_CAPTURE_INTENTS = [
  'reflection', 'idea', 'question', 'observation', 'gratitude', 'processing',
]

function sanitizeEnum<T extends string>(field: string, value: unknown, valid: T[]): T | null {
  if (typeof value === 'string' && valid.includes(value as T)) return value as T
  if (value != null) {
    console.warn(`enrich-capture: discarded invalid ${field}: ${JSON.stringify(value)}`)
  }
  return null
}

// ─── Claude Haiku — forced tool call ──────────────────────────────────────────
// The schema carries the valid enum values, and tool_choice forces the call,
// so extraction is structurally guaranteed — no freeform JSON, no fence
// stripping, no guessed enum spellings.

const ENRICHMENT_TOOL = {
  name: 'record_enrichment',
  description: 'Record the structured enrichment extracted from the capture.',
  input_schema: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description: '1-2 sentence distillation of the capture.',
      },
      themes: {
        type: 'array',
        items: { type: 'string' },
        description: '1-4 broad themes genuinely present, lowercase (e.g. "creative process", "self-doubt").',
      },
      sentiment: {
        type: 'string',
        enum: VALID_SENTIMENTS,
        description: 'Overall emotional tone. "mixed" when clearly both positive and negative; "neutral" only when genuinely flat.',
      },
      mood_tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Emotional textures present, lowercase (e.g. "hopeful", "frustrated"). Empty if none.',
      },
      energy_level: {
        type: 'string',
        enum: VALID_ENERGY_LEVELS,
        description: 'The energy of the capture itself — pace, intensity, aliveness. Commit to the closest fit.',
      },
      capture_intent: {
        type: 'string',
        enum: VALID_CAPTURE_INTENTS,
        description: 'What the user was doing in this capture. Commit to the closest fit.',
      },
      questions_raised: {
        type: 'array',
        items: { type: 'string' },
        description: 'Questions the capture raises, explicit or implicit. Empty if none.',
      },
      people_mentioned: {
        type: 'array',
        items: { type: 'string' },
        description: 'Names of people mentioned. Empty if none.',
      },
      key_quotes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Verbatim lines worth keeping, max 3. Empty if none.',
      },
      entities: {
        type: 'object',
        description: 'Named entities grouped by kind, e.g. {"places": [], "works": [], "organizations": []}. Empty object if none.',
      },
    },
    required: ['summary', 'themes', 'sentiment', 'energy_level', 'capture_intent'],
  },
}

async function callClaudeHaiku(
  body: string,
  memoryDocument: string,
): Promise<Record<string, unknown>> {
  const systemPrompt = `You are Ki's enrichment engine. Extract structured intelligence from the user's capture by calling the record_enrichment tool.

Here is who this user is — use this as context to inform what you surface. Do not reference it in your output:

${memoryDocument}

Extract what is genuinely present. sentiment, energy_level, and capture_intent must always be set — commit to the closest fit rather than leaving them out.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: 1500,
      temperature: 0,
      system: systemPrompt,
      tools: [ENRICHMENT_TOOL],
      tool_choice: { type: 'tool', name: 'record_enrichment' },
      messages: [{ role: 'user', content: body }],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Claude API error ${res.status}: ${text}`)
  }

  const data = await res.json()
  const toolUse = data.content?.find(
    (block: { type: string }) => block.type === 'tool_use',
  )
  if (!toolUse?.input) throw new Error('No tool_use block in Claude response')
  return toolUse.input as Record<string, unknown>
}

// ─── Embedding ────────────────────────────────────────────────────────────────

async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI API error ${res.status}: ${text}`)
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

// ─── Pursuit resonance ────────────────────────────────────────────────────────
// Matches a capture embedding against active pursuit core_question_embeddings.
// Returns PursuitConnection objects for matches above RESONANCE_THRESHOLD.

interface Pursuit {
  id: string
  name: string
  core_question: string
  core_question_embedding: number[]
}

interface PursuitConnection {
  pursuit_id: string
  reason: string
  confidence: number
  matched_at: string
}

async function generateResonanceReason(
  captureBody: string,
  pursuit: Pursuit,
  confidence: number,
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
          content: `Pursuit: "${pursuit.name}"\nCore question: "${pursuit.core_question}"\n\nCapture:\n${captureBody}`,
        },
      ],
    }),
  })

  if (!res.ok) {
    console.warn(`resonance reason generation failed: ${res.status}`)
    return `Relates to your pursuit of ${pursuit.name}.`
  }

  const data = await res.json()
  return (data.content?.[0]?.text ?? '').trim()
}

async function matchPursuitResonance(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  captureBody: string,
  captureEmbedding: number[],
): Promise<PursuitConnection[]> {
  // Fetch active pursuits with core_question_embedding
  const { data: pursuits, error } = await supabase
    .from('pursuits')
    .select('id, name, core_question, core_question_embedding')
    .eq('user_id', userId)
    .eq('status', 'active')
    .not('core_question_embedding', 'is', null)

  if (error || !pursuits || pursuits.length === 0) return []

  const connections: PursuitConnection[] = []
  const matchedAt = new Date().toISOString()

  for (const pursuit of pursuits as Pursuit[]) {
    const confidence = cosineSimilarity(captureEmbedding, pursuit.core_question_embedding)

    if (confidence < RESONANCE_THRESHOLD) continue

    const reason = await generateResonanceReason(captureBody, pursuit, confidence)

    connections.push({
      pursuit_id: pursuit.id,
      reason,
      confidence: Math.round(confidence * 1000) / 1000,
      matched_at: matchedAt,
    })
  }

  return connections
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Service role client — bypasses RLS for pipeline writes
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let captureId: string | null = null

  try {
    const payload = await req.json()
    const capture = payload.record

    captureId = capture.id

    // Guard: skip if body is missing
    if (!capture.body) {
      console.log(`enrich-capture: skipping ${captureId} — no body`)
      return new Response('skipped', { status: 200 })
    }

    // Fetch the user's memory document for context
    const { data: profile } = await supabase
      .from('profiles')
      .select('memory_document')
      .eq('id', capture.user_id)
      .single()

    const memoryDocument = profile?.memory_document ?? ''

    // Derive time of day from captured_at
    const timeOfDayCat = getTimeOfDayCat(capture.captured_at)

    // Generate the vector embedding first — RAG must survive extraction
    // failures. A capture with no themes is diminished; a capture with no
    // embedding is invisible.
    const embedding = await generateEmbedding(capture.body)

    // Enrich via Claude Haiku (forced tool call). On failure the embedding
    // still lands and the row is marked failed so re-enrich can retry it.
    let enrichment: Record<string, unknown> = {}
    let extractionOk = true
    try {
      enrichment = await callClaudeHaiku(capture.body, memoryDocument)
    } catch (extractErr) {
      extractionOk = false
      console.error(`enrich-capture: extraction failed for ${captureId}`, extractErr)
    }

    // Run pursuit resonance matching (non-blocking on failure)
    let pursuitConnections: PursuitConnection[] = []
    try {
      pursuitConnections = await matchPursuitResonance(
        supabase,
        capture.user_id,
        capture.body,
        embedding,
      )
      if (pursuitConnections.length > 0) {
        console.log(`enrich-capture: ${pursuitConnections.length} pursuit connection(s) for ${captureId}`)
      }
    } catch (resonanceErr) {
      // Never let resonance failures block the main enrichment write
      console.error(`enrich-capture: resonance matching failed for ${captureId}`, resonanceErr)
    }

    // Write enrichment
    const { error: enrichErr } = await supabase
      .from('enrichments')
      .update({
        summary:             enrichment.summary   ?? null,
        themes:              Array.isArray(enrichment.themes) ? enrichment.themes : [],
        sentiment:           sanitizeEnum('sentiment', enrichment.sentiment, VALID_SENTIMENTS),
        mood_tags:           Array.isArray(enrichment.mood_tags) ? enrichment.mood_tags : [],
        energy_level:        sanitizeEnum('energy_level', enrichment.energy_level, VALID_ENERGY_LEVELS),
        capture_intent:      sanitizeEnum('capture_intent', enrichment.capture_intent, VALID_CAPTURE_INTENTS),
        questions_raised:    Array.isArray(enrichment.questions_raised) ? enrichment.questions_raised : [],
        people_mentioned:    Array.isArray(enrichment.people_mentioned) ? enrichment.people_mentioned : [],
        key_quotes:          Array.isArray(enrichment.key_quotes) ? enrichment.key_quotes : [],
        entities:            enrichment.entities ?? {},
        time_of_day_cat:     timeOfDayCat,
        embedding,
        pursuit_connections: pursuitConnections.length > 0 ? pursuitConnections : null,
        enrichment_status:   extractionOk ? 'complete' : 'failed',
        processed_at:        new Date().toISOString(),
        model_used:          HAIKU_MODEL,
      })
      .eq('capture_id', captureId)

    if (enrichErr) throw enrichErr

    // Auto-set title if the capture didn't have one
    if (extractionOk && !capture.title && enrichment.summary) {
      await supabase
        .from('captures')
        .update({ title: firstSentence(enrichment.summary as string) })
        .eq('id', captureId)
    }

    console.log(`enrich-capture: complete for ${captureId}`)
    return new Response('ok', { status: 200 })

  } catch (err) {
    console.error(`enrich-capture: failed for ${captureId}`, err)

    // Mark as failed — never leave it pending
    if (captureId) {
      try {
        await supabase
          .from('enrichments')
          .update({ enrichment_status: 'failed' })
          .eq('capture_id', captureId)
      } catch (e) {
        console.error('failed to set failed status', e)
      }
    }

    // Return 200 so the webhook doesn't retry indefinitely
    return new Response('failed', { status: 200 })
  }
})
