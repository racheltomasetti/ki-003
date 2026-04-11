// Ki — enrich-capture Edge Function
//
// Triggered by a Postgres webhook on captures INSERT.
// Fetches the capture body + user memory document, calls Claude Haiku for
// structured enrichment, generates a vector embedding, and writes everything
// to the enrichments row. The pending row already exists (created by the
// create_pending_enrichment trigger), so this always UPDATEs, never INSERTs.
//
// The capture is never touched on failure — only enrichment_status is set to
// 'failed'. The capture pipeline is always unblocked.

import { createClient } from 'npm:@supabase/supabase-js@2'

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'
const EMBEDDING_MODEL = 'text-embedding-3-small'

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

// ─── JSON extraction ──────────────────────────────────────────────────────────
// Claude sometimes wraps JSON in markdown fences — strip them.

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  return fenced ? fenced[1] : text.trim()
}

// ─── Enum sanitizers ──────────────────────────────────────────────────────────
// Claude occasionally returns values outside the DB check constraints.
// Null out anything that doesn't match — never let it crash the write.

const VALID_SENTIMENTS = ['positive', 'neutral', 'negative', 'mixed']
const VALID_ENERGY_LEVELS = ['low', 'medium', 'high']
const VALID_CAPTURE_INTENTS = [
  'reflection', 'idea', 'question', 'observation', 'gratitude', 'processing',
]

function sanitizeEnum<T extends string>(value: unknown, valid: T[]): T | null {
  return typeof value === 'string' && valid.includes(value as T)
    ? (value as T)
    : null
}

// ─── Claude Haiku ─────────────────────────────────────────────────────────────

async function callClaudeHaiku(
  body: string,
  memoryDocument: string,
): Promise<Record<string, unknown>> {
  const systemPrompt = `You are Ki's enrichment engine. Extract structured intelligence from this capture.

Here is who this user is — use this as context to inform what you surface. Do not reference it in your output:

${memoryDocument}

Extract what is genuinely present. Return null for fields that don't honestly apply. Return valid JSON only — no explanation, no markdown:

{
  "summary": "1-2 sentence distillation",
  "themes": [],
  "sentiment": null,
  "mood_tags": [],
  "energy_level": null,
  "capture_intent": null,
  "questions_raised": [],
  "people_mentioned": [],
  "key_quotes": [],
  "entities": {}
}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: body }],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Claude API error ${res.status}: ${text}`)
  }

  const data = await res.json()
  const content = data.content?.[0]?.text ?? ''
  return JSON.parse(extractJson(content))
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

    // Enrich via Claude Haiku
    const enrichment = await callClaudeHaiku(capture.body, memoryDocument)

    // Generate vector embedding
    const embedding = await generateEmbedding(capture.body)

    // Write enrichment
    const { error: enrichErr } = await supabase
      .from('enrichments')
      .update({
        summary:          enrichment.summary   ?? null,
        themes:           Array.isArray(enrichment.themes) ? enrichment.themes : [],
        sentiment:        sanitizeEnum(enrichment.sentiment, VALID_SENTIMENTS),
        mood_tags:        Array.isArray(enrichment.mood_tags) ? enrichment.mood_tags : [],
        energy_level:     sanitizeEnum(enrichment.energy_level, VALID_ENERGY_LEVELS),
        capture_intent:   sanitizeEnum(enrichment.capture_intent, VALID_CAPTURE_INTENTS),
        questions_raised: Array.isArray(enrichment.questions_raised) ? enrichment.questions_raised : [],
        people_mentioned: Array.isArray(enrichment.people_mentioned) ? enrichment.people_mentioned : [],
        key_quotes:       Array.isArray(enrichment.key_quotes) ? enrichment.key_quotes : [],
        entities:         enrichment.entities ?? {},
        time_of_day_cat:  timeOfDayCat,
        embedding,
        enrichment_status: 'complete',
        processed_at:     new Date().toISOString(),
        model_used:       HAIKU_MODEL,
      })
      .eq('capture_id', captureId)

    if (enrichErr) throw enrichErr

    // Auto-set title if the capture didn't have one
    if (!capture.title && enrichment.summary) {
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
