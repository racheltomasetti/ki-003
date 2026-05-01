// Ki — generate-brief Edge Function
//
// Synthesizes a Project Brief from everything a user has captured in a project.
//
// The Brief is a structured markdown document that:
//   1. Distills the core of what the user is building or figuring out
//   2. Surfaces key decisions, open questions, and recurring themes from their captures
//   3. Produces a "Context for Claude" paragraph — paste it into any LLM to
//      bring it fully up to speed on this project
//
// The brief is grounded entirely in the user's own captures. No hallucination.
// Requires at least 3 captures in the project to generate.
//
// Writes the result to projects.brief + projects.brief_generated_at.

import { createClient } from 'npm:@supabase/supabase-js@2'

const SONNET_MODEL = 'claude-sonnet-4-6'

// ─── Format captures for the prompt ──────────────────────────────────────────

function formatCapturesForBrief(captures: Array<{
  body: string | null
  title: string | null
  captured_at: string
  is_starred: boolean
  enrichments: {
    summary: string | null
    themes: string[] | null
    capture_intent: string | null
    questions_raised: string[] | null
  } | null
}>): string {
  return captures.map((c, i) => {
    const date = new Date(c.captured_at).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
    const starred = c.is_starred ? ' ★' : ''
    const label = c.title ? `"${c.title}"` : `Capture ${i + 1}`
    const summary = c.enrichments?.summary ? `\nSummary: ${c.enrichments.summary}` : ''
    const themes = c.enrichments?.themes?.length
      ? `\nThemes: ${c.enrichments.themes.join(', ')}`
      : ''
    const questions = c.enrichments?.questions_raised?.length
      ? `\nQuestions: ${c.enrichments.questions_raised.join(' / ')}`
      : ''

    return `[${label}${starred} — ${date}]${summary}${themes}${questions}\n\n${c.body ?? ''}`
  }).join('\n\n---\n\n')
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

  // Auth
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim()
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  const { data: { user }, error: authError } = await serviceClient.auth.getUser(token)
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  try {
    const { project_id } = await req.json() as { project_id: string }
    if (!project_id) {
      return new Response(JSON.stringify({ error: 'project_id required' }), { status: 400 })
    }

    // Fetch the project — verify ownership
    const { data: project, error: projectErr } = await serviceClient
      .from('projects')
      .select('id, name, description')
      .eq('id', project_id)
      .eq('user_id', user.id)
      .single()

    if (projectErr || !project) {
      return new Response(JSON.stringify({ error: 'Project not found' }), { status: 404 })
    }

    // Fetch all captures in this project with their enrichments
    const { data: rows, error: capturesErr } = await serviceClient
      .from('capture_projects')
      .select(`
        captures (
          id, body, title, captured_at, is_starred,
          enrichments ( summary, themes, capture_intent, questions_raised )
        )
      `)
      .eq('project_id', project_id)

    if (capturesErr) throw capturesErr

    const captures = (rows ?? [])
      .map((r: { captures: unknown }) => r.captures)
      .filter(Boolean) as Array<{
        body: string | null
        title: string | null
        captured_at: string
        is_starred: boolean
        enrichments: {
          summary: string | null
          themes: string[] | null
          capture_intent: string | null
          questions_raised: string[] | null
        } | null
      }>

    if (captures.length < 3) {
      return new Response(
        JSON.stringify({ error: 'Not enough captures. Add at least 3 captures to this project before generating a brief.' }),
        { status: 422 }
      )
    }

    // Sort: starred first, then by captured_at desc
    captures.sort((a, b) => {
      if (a.is_starred !== b.is_starred) return a.is_starred ? -1 : 1
      return new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
    })

    const captureText = formatCapturesForBrief(captures)
    const hasGoal = project.description?.trim()

    const systemPrompt = `You are Ki — a thinking tool for builders and creators. Your job is to read everything someone has captured about a project and synthesize it into a Project Brief.

The Brief serves two purposes:
1. It helps the user see the shape of their own thinking — the decisions made, the questions still open, the recurring themes.
2. It produces a "Context for Claude" section: a dense paragraph the user can paste into any LLM (Claude, GPT, Cursor, etc.) to bring it fully up to speed on this project without any explanation.

Rules:
- Ground every claim in the captures. Do not invent.
- Be direct and specific. No padding, no filler.
- If a section is empty (no decisions made yet, no people mentioned), omit it — don't write placeholder text.
- The "Context for Claude" section should be written in first person from the user's perspective, dense and complete.
- Use markdown formatting.`

    const userMessage = `Project: "${project.name}"
${hasGoal ? `Goal: ${project.description}\n` : ''}
${captures.length} captures spanning their thinking on this project.

---

${captureText}

---

Generate the Project Brief now. Use this structure:

## What I'm Building
[1-3 sentences synthesizing the core of what this project is and what problem it solves or question it answers — drawn from their captures, not invented]

## Key Decisions
[Bulleted list of conclusions or choices that appear settled in their thinking. Only include if clearly present in captures.]

## Open Questions
[Bulleted list of unresolved questions that appear across captures. Only include if clearly present.]

## Recurring Themes
[Short bulleted list of ideas, concepts, or tensions that appear repeatedly]

## Context for Claude
[A single dense paragraph written in first person — "I'm building X. The core insight is Y. Key decisions made: Z. Still figuring out: W." — everything someone would need to paste into a new Claude conversation to pick up exactly where this thinking left off]`

    // Call Claude Sonnet
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: SONNET_MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!claudeRes.ok) {
      const txt = await claudeRes.text()
      throw new Error(`Claude error ${claudeRes.status}: ${txt}`)
    }

    const claudeData = await claudeRes.json()
    const ki = claudeData.content?.[0]?.text ?? ''

    // Save to the project
    const { error: updateErr } = await serviceClient
      .from('projects')
      .update({ ki, ki_updated_at: new Date().toISOString() })
      .eq('id', project_id)
      .eq('user_id', user.id)

    if (updateErr) throw updateErr

    return new Response(
      JSON.stringify({ ki, capture_count: captures.length }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('generate-brief error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
