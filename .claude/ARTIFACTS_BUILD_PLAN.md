# Ki — Artifacts Build Plan
## Multi-medium creation space
*Locked: May 2026*
*Refined: May 8, 2026 — after technical review (see "Refinements From Review" below)*

---

## What We're Building

The thought distiller today is one slot, one type. The user converses with Ki in the right panel and a single textarea in the center fills with prose when something crystallizes. That works for prose. It does not work for everything.

We are widening the creation space into a polymorphic surface that can hold any kind of artifact — prose, outline, diagram, and more over time — chosen and shaped through conversation. The conversational shape of the workspace does not change. The chat panel stays. The captures panel stays. The surface keeps the same header (label, clear, save, copy). What changes is what the surface *can render*, what the agent *can produce*, and how the two are wired through a typed contract that lets new artifact kinds ship without restructuring the surface, the database, or the agent.

This is an additive expansion built on infrastructure that already exists (`pursuit_artifacts` table, `source_metadata` jsonb on captures, the agent's existing crystallization judgment). No existing capability is removed.

**v1 scope is generation validation.** The goal is to see whether multi-kind artifact emission feels right — does Ki pick the right form? Do users iterate on the surface? Does it match how thinking actually wants to take shape? Retrieval (gallery, save-back, reopen) is sketched at v1.5 below and is the immediate next phase. v1 saves artifacts to the database but does not surface them again — this is intentional and acknowledged, not an oversight.

---

## The Two Flows of Artifact Creation

Both flows are first-class. The user has power to decide the direction, always.

### Flow 1 — User-initiated (primary)

The user comes to Ki and tells it what they want.

- **At the start of a conversation:** "I want to map out how a capture goes from voice to enriched data." Ki reads the corpus, picks or asks for the form, and emits the artifact.
- **Mid-conversation:** "Help me distill this." / "Make this a flowchart." / "Outline what we just figured out."
- **Iterating on what's already there:** "Add a step for X." / "Make the second box clearer." / "Actually, let me see this as an outline instead." The agent receives the current artifact state and emits a replacement.

The user can name the form, the topic, or both. If the user names a form, the agent complies. If the form is ambiguous, the agent asks once, then acts.

### Flow 2 — Agent-suggested (secondary)

The conversation produces something concrete that wants a shape. The agent sees the opportunity and proposes the artifact unprompted. This is exactly today's "should I distill?" judgment, expanded to "should I crystallize, and into what form?"

The bias stays conservative. Most messages remain conversational only. Agent-suggested emission is allowed but rare.

### Same machinery, different trigger

Both flows produce the same output: a `propose_artifact` tool call from the agent. Both flows route through the same surface, the same renderer, the same save action. The user has the same controls regardless of who initiated.

---

## Refinements From Review

This plan was refined on May 8, 2026 after a technical review. The following decisions changed from the original draft:

1. **Tool calling replaces XML envelopes.** The original plan had the agent emit `<artifact kind="…">{ json }</artifact>` and parse it via regex. JSON inside XML inside a streamed Claude response is fragile (escaped quotes, nested tags, multiline strings). Anthropic's native tool calling validates structured input against a JSON schema at the API boundary. We use it.
2. **Grounding rule relaxed.** Originally `referenced_capture_ids` was required non-empty. That breaks the legitimate "give me a blank scaffold" case. Now: empty is acceptable only when the user explicitly asks for a fresh template; the agent's behavior is governed by the prompt, not parser rejection.
3. **Outline editor simplified.** Originally a custom tree editor with tab/shift-tab/enter/backspace handling. That's a week of edge cases. Replaced with the Mermaid-style render-plus-source pattern: display as styled bullets, edit as Markdown bullets in a textarea. Universal, robust, no custom keybindings.
4. **Mermaid SSR handled explicitly.** Wrap the renderer in `next/dynamic({ ssr: false })` to avoid hydration mismatches in App Router.
5. **Mermaid theme reactivity addressed.** A `useEffect` watches the theme token and re-renders SVG when it changes.
6. **`emptyState()` removed from the renderer interface.** Dead code in v1 — the agent always emits the initial artifact; the user never starts from blank. Add back in v1.5 if a manual kind picker ships.
7. **`current_artifact` size capped.** 30KB serialized cap on the request body field, with truncation + log when exceeded. For typical artifacts this never trips.
8. **Migration audit step added to PR 1.** Before pushing the migration that drops the `type` default, audit all callers of `createPursuitArtifact` and make `type` a required parameter at the function signature.
9. **Saved-artifact retrieval sketched at v1.5.** v1 is generation-validation; v1.5 closes the loop. See "v1.5 Retrieval Sketch" below.
10. **`citations` and `referenced_capture_ids` unified.** The Edge Function returns a single `referenced_capture_ids` array (the artifact's grounding when present) — used for highlighting. Removes the ambiguity. Non-artifact messages don't drive highlights in v1; today's behavior of "highlight the first capture" was effectively useless and is dropped.
11. **`ArtifactSurface` no longer knows about the captures panel.** The "open captures" button hoists out to `PursuitDetailClient` as a floating affordance when the panel is collapsed. The surface's props are tightened.
12. **`text` becomes a snapshot, not a synced field.** `toCopyText(artifact)` is the single source of truth at copy and save time. Renderers mutate `data` freely without worrying about syncing `text`.
13. **Mobile degradation documented.** Prose artifacts (distilled captures) appear on mobile as today via existing library code. Non-prose artifacts in `pursuit_artifacts` are invisible on mobile in v1 — they exist in the database but are not queried by mobile UI. Documented in "What's Deferred."

---

## Locked Decisions

### 1. The `Artifact` type contract

A discriminated union with a portable text representation on every kind. Lives in `packages/types/src/app.ts`.

```ts
export type ArtifactKind = 'prose' | 'outline' | 'mermaid'

export interface OutlineNode {
  text: string
  children?: OutlineNode[]
}

export type MermaidDiagramType = 'flowchart' | 'sequence' | 'mindmap' | 'state'

interface ArtifactBase {
  kind: ArtifactKind
  title?: string
  text: string                       // canonical text snapshot from the agent. Not auto-synced — toCopyText is the source of truth at copy/save time.
  referenced_capture_ids: string[]   // grounding. Strongly preferred non-empty; empty acceptable when user explicitly asks for a blank scaffold.
}

export type Artifact =
  | (ArtifactBase & { kind: 'prose' })
  | (ArtifactBase & { kind: 'outline'; data: { tree: OutlineNode[] } })
  | (ArtifactBase & {
      kind: 'mermaid'
      data: { diagram_type: MermaidDiagramType; source: string }
    })
```

`text` is the agent's emitted snapshot. `toCopyText(artifact)` (defined per renderer) is the canonical text at copy and save time. They may diverge after user edits. That's intentional: renderers don't have to maintain sync, and the user's edit is always what gets copied or saved.

### 2. Storage rule

Two homes, by kind:

- **`prose`** → `captures` table, `source_type='distilled'`, `enrichment_profile='distilled'`. Exact parity with today. Preserves the corpus loop — distilled prose is re-enriched and becomes second-layer thinking. The `body` field is set to `toCopyText(artifact)`, not `artifact.text` directly.
- **Everything else** → `pursuit_artifacts` table, with `type = artifact.kind`, `content = toCopyText(artifact)`, `data = artifact.data`.

The split is intentional. Prose semantically re-enters the corpus. Other artifacts live alongside in `pursuit_artifacts`. If we ever want non-prose artifacts to re-enter the corpus, we generate a parallel summary capture pointing at the artifact via `source_metadata.artifact_id`. Deferred.

### 3. Schema migration — artifact data column

Single migration, additive. The `type` default is dropped only after auditing all callers (see PR 1).

```sql
-- Ki — migration 012: artifact data column
--
-- Extends pursuit_artifacts to carry kind-specific structured content
-- alongside the portable text representation in `content`.

ALTER TABLE public.pursuit_artifacts
  ADD COLUMN IF NOT EXISTS data jsonb;

ALTER TABLE public.pursuit_artifacts
  ALTER COLUMN type DROP DEFAULT;

CREATE INDEX IF NOT EXISTS pursuit_artifacts_project_created_idx
  ON public.pursuit_artifacts (project_id, created_at DESC);
```

That is the entire migration. RLS, updated_at trigger, and existing columns are unchanged.

### 4. The agent contract — Anthropic tool calling

The Edge Function uses **Anthropic tool calling** for artifact emission, not XML envelopes. This avoids JSON-in-XML parsing fragility entirely — Anthropic validates tool inputs against a JSON schema before returning them to us.

**Tool definition:**

```ts
const proposeArtifactTool = {
  name: 'propose_artifact',
  description:
    'Propose an artifact to display in the user\'s thought distiller. ' +
    'Call this only when the user has explicitly asked for an artifact, ' +
    'or when the conversation has produced something concrete that wants a tangible form. ' +
    'Most messages should not call this tool.',
  input_schema: {
    type: 'object',
    properties: {
      kind: {
        type: 'string',
        enum: ['prose', 'outline', 'mermaid'],
        description: 'The form of the artifact. Pick based on what the user is expressing or asked for.',
      },
      title: {
        type: 'string',
        description: 'A short title (under 60 chars). Optional.',
      },
      text: {
        type: 'string',
        description:
          'Canonical readable text representation. For prose, this IS the artifact. ' +
          'For outline and mermaid, this is a brief summary the user could read aloud — not the structured data.',
      },
      data: {
        type: 'object',
        description:
          'Kind-specific structured content. Required for outline (tree) and mermaid (diagram_type + source). Omit for prose.',
        properties: {
          tree: { type: 'array' },
          diagram_type: { type: 'string', enum: ['flowchart', 'sequence', 'mindmap', 'state'] },
          source: { type: 'string' },
        },
      },
      referenced_capture_ids: {
        type: 'array',
        items: { type: 'string' },
        description:
          'UUIDs of captures the artifact draws from. Strongly preferred non-empty when the artifact ' +
          'distills or summarizes captured thinking. An empty list is acceptable only when the user ' +
          'explicitly asks for a fresh scaffold, blank template, or starting structure. Do not invent UUIDs.',
      },
    },
    required: ['kind', 'text', 'referenced_capture_ids'],
  },
}
```

**Request shape:**

```ts
const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { /* unchanged */ },
  body: JSON.stringify({
    model: SONNET_MODEL,
    max_tokens: 2000,                    // raised from 1500 to comfortably hold artifact + reply
    system: systemPrompt,
    tools: [proposeArtifactTool],
    messages: [
      ...conversation_history,
      { role: 'user', content: message },
    ],
  }),
})
```

**Response parsing — typed, no regex:**

```ts
interface AnthropicContentBlock {
  type: 'text' | 'tool_use'
  text?: string
  id?: string
  name?: string
  input?: unknown
}

const claudeData = await claudeRes.json() as { content?: AnthropicContentBlock[] }
const blocks = claudeData.content ?? []

const responseText = blocks
  .filter(b => b.type === 'text')
  .map(b => b.text ?? '')
  .join('')
  .trim()

const toolUse = blocks.find(b => b.type === 'tool_use' && b.name === 'propose_artifact')
const artifact = toolUse ? validateArtifact(toolUse.input) : undefined
```

**Runtime validation** (one shape check beyond what Anthropic enforces):

```ts
function validateArtifact(input: unknown): Artifact | undefined {
  if (!input || typeof input !== 'object') return undefined
  const a = input as Record<string, unknown>
  if (a.kind !== 'prose' && a.kind !== 'outline' && a.kind !== 'mermaid') return undefined
  if (typeof a.text !== 'string' || !Array.isArray(a.referenced_capture_ids)) return undefined
  if (a.kind === 'outline' && !(a.data && Array.isArray((a.data as { tree?: unknown }).tree))) return undefined
  if (a.kind === 'mermaid') {
    const d = a.data as { diagram_type?: unknown; source?: unknown } | undefined
    if (!d || typeof d.source !== 'string' || typeof d.diagram_type !== 'string') return undefined
  }
  return a as unknown as Artifact
}
```

**Output shape:**

```ts
return new Response(
  JSON.stringify({
    response: responseText,
    artifact,                            // Artifact | undefined
    referenced_capture_ids: artifact?.referenced_capture_ids ?? [],
  }),
  { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
)
```

**Backwards compatibility window:** during PR 3's transitional release, if the response contains no `tool_use` block, the parser also checks `responseText` for a legacy `<distilled>...</distilled>` tag and treats its content as `{ kind: 'prose', text, referenced_capture_ids: [] }`. Drop fallback in PR 4 once the new path is verified.

### 5. Pending state lives in client memory

Today the distiller content is React state until the user hits "save to Ki." Keep that. The artifact in the surface is `currentArtifact: Artifact | null` in the React tree, persisted only when saved.

We do **not** adopt the canvas's DB-level `pending` status for the surface. Reason: tldraw needs DB-pending because shape mutations persist live; the surface doesn't have that constraint.

### 6. Renderer registry interface

```ts
export interface ArtifactRenderer<K extends ArtifactKind> {
  Render: (props: {
    artifact: Extract<Artifact, { kind: K }>
    onChange: (next: Extract<Artifact, { kind: K }>) => void
  }) => JSX.Element
  toCopyText: (a: Extract<Artifact, { kind: K }>) => string
}

export const ARTIFACT_RENDERERS: { [K in ArtifactKind]: ArtifactRenderer<K> } = {
  prose:   ProseArtifactRenderer,
  outline: OutlineArtifactRenderer,
  mermaid: MermaidArtifactRenderer,
}
```

Two methods per renderer:

- `Render` — the editor for this kind
- `toCopyText` — produces the canonical portable string. Called at copy and save time. Single source of truth for what `content` becomes in the database.

`emptyState()` was removed — in v1 the agent always emits the initial artifact; nothing creates a blank-from-scratch one. If a manual kind picker ships in v1.5, we add it back.

Every renderer is editable in-surface (parity with today's textarea). No read-only renderers in v1.

### 7. Save routing

```ts
async function saveArtifact(a: Artifact, projectId: string, userId: string) {
  const renderer = ARTIFACT_RENDERERS[a.kind]
  const portableText = renderer.toCopyText(a)        // canonical text from current state

  if (a.kind === 'prose') {
    // existing path — captures table
    return saveDistilledCapture(supabase, {
      user_id: userId,
      body: portableText,
      source_metadata: {
        project_id: projectId,
        distilled_at: new Date().toISOString(),
        referenced_capture_ids: a.referenced_capture_ids,
      },
    })
  }

  return createPursuitArtifact(supabase, {
    project_id: projectId,
    user_id: userId,
    type: a.kind,
    title: a.title ?? '',
    content: portableText,                            // toCopyText, not a.text
    data: a.data,
  })
}
```

Routing is one if-statement. Renderers don't have to keep `text` in sync — `toCopyText` is called at save time.

### 8. v1 kind set: `prose`, `outline`, `mermaid`

Three kinds. `prose` for parity. `outline` for structured artifacts. `mermaid` for visual artifacts. Anything else is v2.

### 9. Naming

- **User-facing label:** "thought distiller" stays in the surface header. The metaphor stays.
- **Component:** `ThoughtDistiller` → `ArtifactSurface`. State `distillerContent: string` → `currentArtifact: Artifact | null`.
- **DB:** unchanged.
- **Type:** `Artifact` (the discriminated union).

### 10. Fallback for unknown kinds

If the client receives a `kind` it doesn't have a renderer for, render `artifact.text` in a read-only prose view with a small notice ("This artifact type isn't fully supported in your client yet — text representation shown."). The agent can experiment with new kinds without breaking the UI.

### 11. One artifact at a time

When a new artifact arrives while one is already in the surface, replace it. No queue, no inbox. Manual user edits are preserved within the same artifact instance until the agent emits a replacement.

---

## What Changes in the Edge Function

### File: `supabase/functions/pursuit-agent/index.ts`

#### Input changes

```ts
const { project_id, message, conversation_history = [], current_artifact = null } = await req.json() as {
  project_id: string
  message: string
  conversation_history: Array<{ role: 'user' | 'assistant'; content: string }>
  current_artifact: Artifact | null
}

// Bound the size of current_artifact in the request body
const MAX_ARTIFACT_BYTES = 30_000
const serialized = current_artifact ? JSON.stringify(current_artifact) : null
const truncated = serialized && serialized.length > MAX_ARTIFACT_BYTES
const artifactForPrompt = truncated
  ? `[current_artifact was ${serialized.length} bytes; truncated. The user is iterating on a large ${current_artifact?.kind ?? 'unknown'} artifact.]`
  : serialized
```

If truncated, the agent is told the artifact is too large to embed and is asked to act on the user's instruction without seeing the full prior content. In practice, even a 100-node outline serializes well under 30KB.

#### The new system prompt

Sections in **bold** are additions. Everything else carries forward from today's prompt structure.

```
You are Ki — a thinking partner built for builders and creators.

You are working inside a specific project. The user has captured raw thoughts here — voice recordings, observations, ideas. Your job is to help them think: surface what they're actually saying, find the threads that matter, and help them arrive at clarity.

[memory document, project context, captures — unchanged]

---

You are working with the user inside their creation space. The space has three zones:
- Their captured thoughts on the left
- The artifact surface in the center — the user calls it the "thought distiller". This is where you and the user shape something tangible together.
- This conversation on the right

The artifact surface can hold one of several kinds of artifact at a time:

- **prose** — clean, standalone written prose. The default form. Use for stances, essays, distillations, context blocks, paragraphs the user could paste into another tool.
- **outline** — a hierarchical tree of points. Use for structural, sequential thinking — a syllabus, an argument with sub-points, a breakdown of a system into parts.
- **mermaid** — a Mermaid.js diagram. Use for visual or relational thinking — a process flow, a sequence of events, a mind map, a state machine.

There are two ways an artifact gets created. Both are equally valid.

1. The user asks for one. They might name the form ("make this into a flowchart"), the topic ("distill what we said about X"), or both. When the user asks, you comply. If their request is ambiguous about form, ask once, then act.

2. You see an opportunity. The conversation has produced something concrete that wants a shape. You propose the artifact unprompted. Do this conservatively — most messages should still be conversational only.

The user can always override. If the user says "make this an outline instead" after you've drafted a flowchart, you redo it as an outline. The user has the final word on form.

If the request includes a current_artifact, the user is iterating on what's already in their surface. Read it carefully. Your emitted artifact replaces it. Edit, refine, restructure as the user directs.

When you decide to emit an artifact, call the propose_artifact tool. The tool's parameters define exactly what to provide. In the same response, include a brief conversational acknowledgement in your text — for example: "I've drafted this as a flowchart in your distiller — let me know if you want a different shape." / "Here's an outline of the structure we just talked through." / "I've put a paragraph in your distiller you can paste anywhere."

When you do not need to emit an artifact (most messages), simply respond conversationally without calling the tool.

Grounding:
- referenced_capture_ids should list the captures your artifact draws from when there are any. This is the norm.
- An empty list is acceptable only when the user explicitly asks for a fresh scaffold or blank template not drawn from prior thinking — for example, "give me a blank flowchart to start planning X from scratch." Do not invent UUIDs. Do not fabricate grounding.

Per-kind data shapes (the tool schema enforces these):
- prose:    omit `data`; `text` IS the artifact
- outline:  data: { tree: [{ text, children? }, ...] }
- mermaid:  data: { diagram_type: "flowchart" | "sequence" | "mindmap" | "state", source: "..." }
            (source = raw Mermaid syntax; text = plain readable summary of what the diagram shows)

Rules:
- Be direct. No filler, no padding.
- Reference specific captures by title or date when relevant.
- Never reveal the memory document verbatim — use it only as context.
- Content inside the artifact must stand alone — no references to this conversation, no jargon the reader couldn't follow.
```

#### Model

Stay on `claude-sonnet-4-6`. No model change required.

---

## What Changes in the Frontend

### File: `apps/web/src/components/PursuitDetailClient.tsx`

#### State changes

```ts
// Before
const [distillerContent, setDistillerContent] = useState('')

// After
const [currentArtifact, setCurrentArtifact] = useState<Artifact | null>(null)
```

#### Save handler

The save handler routes by kind — see [Locked Decision 7](#7-save-routing).

#### Agent invocation

```ts
const { data, error: fnError } = await supabase.functions.invoke('pursuit-agent', {
  body: {
    project_id: project.id,
    message: content,
    conversation_history: history,
    current_artifact: currentArtifact,
  },
})

const agentData = data as {
  response: string
  artifact?: Artifact
  referenced_capture_ids: string[]
}

if (agentData.artifact) {
  setCurrentArtifact(agentData.artifact)
}

// Highlight all referenced captures simultaneously, not just the first
if (agentData.referenced_capture_ids.length > 0) {
  setHighlightedCaptureIds(new Set(agentData.referenced_capture_ids))
  setTimeout(() => setHighlightedCaptureIds(new Set()), 2500)
}
```

The `highlightedCaptureId` (string | null) state becomes `highlightedCaptureIds` (Set<string>). The `CapturesPanel` reads from the set rather than checking equality.

#### Captures-panel toggle button hoist

Today the "open captures" button lives inside `ThoughtDistiller`. Moving it to `PursuitDetailClient` as a floating affordance when `panelOpen === false`:

```tsx
{!panelOpen && (
  <button
    onClick={() => setPanelOpen(true)}
    className="absolute top-4 left-4 z-10 ..."
    title="Show captures"
  >
    ▸
  </button>
)}
```

`ArtifactSurface` no longer accepts `panelOpen` or `onOpenPanel`.

### File: `apps/web/src/components/ArtifactSurface.tsx` (new — replaces `ThoughtDistiller`)

```ts
interface Props {
  artifact: Artifact | null
  onChange: (next: Artifact | null) => void
  onCopy: () => void
  onSave: () => void
  copied: boolean
  saving: boolean
}
```

Tightened — no captures-panel knowledge.

The component renders a header (label "thought distiller", clear / save / copy actions) and a body. The body picks a renderer from `ARTIFACT_RENDERERS[artifact.kind]` and delegates rendering. When `artifact === null`, the body shows the same italic placeholder as today.

Copy handler: `navigator.clipboard.writeText(ARTIFACT_RENDERERS[a.kind].toCopyText(a))`.
Clear handler: `onChange(null)`.
Save handler: `onSave()` (parent routes by kind).

### File: `apps/web/src/components/artifacts/types.ts` (new)

The `ArtifactRenderer` interface — see [Locked Decision 6](#6-renderer-registry-interface).

### File: `apps/web/src/components/artifacts/registry.ts` (new)

Exports `ARTIFACT_RENDERERS`. PR 2 registers only `prose`. PR 4 adds `outline`. PR 5 adds `mermaid`.

### File: `apps/web/src/components/artifacts/ProseArtifact.tsx` (new)

A near-direct lift of today's textarea body:

```tsx
export const ProseArtifactRenderer: ArtifactRenderer<'prose'> = {
  Render: ({ artifact, onChange }) => (
    <textarea
      value={artifact.text}
      onChange={e => onChange({ ...artifact, text: e.target.value })}
      placeholder="Ki will help shape your thinking here as you converse. You can also write directly — edit, refine, build on it together."
      className="w-full h-full bg-transparent border-none outline-none font-serif text-sm text-charcoal dark:text-[#f0ede8] placeholder:text-charcoal/25 dark:placeholder:text-[#5c5a57] placeholder:italic resize-none leading-relaxed"
    />
  ),
  toCopyText: a => a.text,
}
```

Must achieve byte-identical UX to today's distiller before any other renderer ships.

### File: `apps/web/src/components/artifacts/OutlineArtifact.tsx` (new)

Renders the outline as a styled hierarchical bullet list. Editing happens in a Markdown textarea via a "view source" toggle — same pattern as Mermaid. Robust round-trip, no custom keybindings, leverages universal Markdown literacy.

```tsx
type Mode = 'rendered' | 'source'

export const OutlineArtifactRenderer: ArtifactRenderer<'outline'> = {
  Render: ({ artifact, onChange }) => {
    const [mode, setMode] = useState<Mode>('rendered')
    const [draftText, setDraftText] = useState(treeToMarkdown(artifact.data.tree))

    const commitDraft = () => {
      const tree = markdownToTree(draftText)
      onChange({ ...artifact, data: { tree }, text: draftText })
    }

    return (
      <div className="flex flex-col h-full">
        <div className="flex justify-end px-2 pb-1">
          <button
            onClick={() => {
              if (mode === 'source') commitDraft()
              setMode(m => (m === 'rendered' ? 'source' : 'rendered'))
            }}
            className="text-[10px] text-charcoal/40 dark:text-[#5c5a57] hover:text-charcoal"
          >
            {mode === 'rendered' ? 'edit' : 'preview'}
          </button>
        </div>
        {mode === 'rendered' ? (
          <div className="flex-1 overflow-y-auto px-3 py-2 font-serif text-sm">
            <OutlineTreeView tree={artifact.data.tree} />
          </div>
        ) : (
          <textarea
            value={draftText}
            onChange={e => setDraftText(e.target.value)}
            onBlur={commitDraft}
            className="w-full h-full font-mono text-xs bg-transparent border-none outline-none resize-none p-3"
          />
        )}
      </div>
    )
  },
  toCopyText: a => treeToMarkdown(a.data.tree),
}

function treeToMarkdown(tree: OutlineNode[], depth = 0): string {
  return tree
    .map(node => {
      const line = `${'  '.repeat(depth)}- ${node.text}`
      const children = node.children?.length ? '\n' + treeToMarkdown(node.children, depth + 1) : ''
      return line + children
    })
    .join('\n')
}

function markdownToTree(markdown: string): OutlineNode[] {
  // Parse `^(\s*)- (.+)$` lines, build tree from indent depth.
  // Reasonable parser — 30-50 lines. Falls back to a single flat node if no bullets present.
}
```

The Markdown ↔ tree round-trip is the only nontrivial code. It's bounded (maybe 50 lines) and well-tested by experimentation: paste known input, verify the round-trip is idempotent.

### File: `apps/web/src/components/artifacts/MermaidArtifact.tsx` (new)

SSR-safe via `next/dynamic`. Renders the diagram as SVG by default with a "view source" toggle for editing the underlying syntax.

```tsx
// File: apps/web/src/components/artifacts/MermaidArtifact.tsx
// Loaded via next/dynamic({ ssr: false }) where used (in registry.ts — see below).

import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

let initialized = false

function initMermaid(theme: 'default' | 'dark') {
  mermaid.initialize({ startOnLoad: false, theme, securityLevel: 'strict' })
  initialized = true
}

export function MermaidEditor({ artifact, onChange }: ...) {
  const [mode, setMode] = useState<'rendered' | 'source'>('rendered')
  const [svg, setSvg] = useState<string | null>(null)
  const [renderError, setRenderError] = useState<string | null>(null)
  const theme = useThemeToken()       // returns 'dark' | 'default'
  const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    if (!initialized) initMermaid(theme)
    else mermaid.initialize({ theme })

    let cancelled = false
    mermaid.render(idRef.current, artifact.data.source)
      .then(({ svg }) => { if (!cancelled) { setSvg(svg); setRenderError(null) } })
      .catch(err => { if (!cancelled) setRenderError(err.message ?? String(err)) })

    return () => { cancelled = true }
  }, [artifact.data.source, theme])

  // ... mode toggle, source textarea, error fallback ...
}

export const MermaidArtifactRenderer: ArtifactRenderer<'mermaid'> = {
  Render: MermaidEditor,
  toCopyText: a => a.data.source,
}
```

Registry import:

```ts
// File: apps/web/src/components/artifacts/registry.ts
import dynamic from 'next/dynamic'

const MermaidArtifactRenderer = dynamic(
  () => import('./MermaidArtifact').then(m => ({ default: m.MermaidArtifactRenderer })),
  { ssr: false },
)
```

(Or wrap the consuming component in `ArtifactSurface` rather than the renderer object — pick the cleanest place. The point is: Mermaid never runs server-side.)

**Theme reactivity:** the `useEffect` watches `theme` and re-calls `mermaid.render`, so light↔dark switches re-render the SVG immediately.

**Render errors:** caught and shown above the source textarea with the exact error message. The diagram view falls back to the source view automatically. The user can edit the source and the SVG re-renders on every change.

### Iteration handling

When the agent emits an artifact while one is already in the surface, the parent calls `setCurrentArtifact(agentData.artifact)`. The renderer for the new artifact mounts, the old one unmounts. No special "this replaced your previous" affordance in v1 — the conversational reply acknowledges the change.

If the user has manually edited the surface and then asks the agent to refine, the request body includes the edited state (up to the 30KB cap) in `current_artifact`. The agent reads it, refines it, returns a replacement.

---

## Build Sequence

PRs are sequenced so each one is independently mergeable and reversible. After every PR, the surface user-experience must work end-to-end. No half-shipped state.

### PR 1 — Foundation (additive, zero behavior change)

1. **Audit step (run before writing the migration):**
   - Grep all callers of `createPursuitArtifact` in the codebase.
   - Confirm every caller passes an explicit `type`.
   - Update `createPursuitArtifact` signature so `type` is **required** (no default arg).
   - Add `data?: Record<string, unknown>` as a new optional parameter.
2. Migration — artifact data: add `data jsonb` to `pursuit_artifacts`, drop `type` default, add index. (Migration number determined at execution time.)
3. `Artifact` discriminated union + `OutlineNode` + `ArtifactKind` + `MermaidDiagramType` exported from `packages/types/src/app.ts`.
4. Update `packages/services/src/pursuit_artifacts.ts`:
   - `createPursuitArtifact(client, { project_id, user_id, type, title, content, data? })`
   - `getProjectArtifact(client, id)` (will need it for v1.5; harmless to add now)
5. Regenerate `packages/types/src/database.ts` via `supabase gen types typescript --linked`.

**Acceptance:** existing distiller still works exactly as before. No code in `apps/web` changes user-visibly. CI green. Migration applied to production safely. Audit confirms no caller broke.

### PR 2 — Surface parity with `ProseArtifact`

1. Create `apps/web/src/components/artifacts/types.ts` — the `ArtifactRenderer` interface.
2. Create `apps/web/src/components/artifacts/ProseArtifact.tsx`.
3. Create `apps/web/src/components/artifacts/registry.ts` — exports `ARTIFACT_RENDERERS` with only `prose` registered.
4. Create `apps/web/src/components/ArtifactSurface.tsx` (no captures-panel knowledge).
5. In `PursuitDetailClient.tsx`:
   - Replace `distillerContent: string` with `currentArtifact: Artifact | null`.
   - Replace `ThoughtDistiller` with `ArtifactSurface`.
   - Hoist the "open captures" button up to `PursuitDetailClient` as a floating affordance.
   - Update `handleCopy` and `handleSave` to use the registry / kind-routed path.
   - Replace `highlightedCaptureId: string | null` with `highlightedCaptureIds: Set<string>`.
   - In `handleSendMessage`: read `agentData.artifact` if present; otherwise wrap legacy `distilled_text` (still returned by today's Edge Function) as `{ kind: 'prose', text, referenced_capture_ids: [] }`.
6. Delete the inline `ThoughtDistiller` function from `PursuitDetailClient.tsx`.

**Acceptance:** the surface looks and behaves identically to before. Same placeholder, same actions, same save behavior, same copy behavior. The user cannot tell anything changed. The architecture is now ready to add new kinds without touching `ArtifactSurface` or `PursuitDetailClient`. The "open captures" button still works when the panel is collapsed.

### PR 3 — Agent contract on tool calling

1. Update `supabase/functions/pursuit-agent/index.ts`:
   - Accept `current_artifact` in the request body, with the 30KB truncation logic.
   - Replace the system prompt with the new version.
   - Add the `proposeArtifactTool` definition and pass it in the `tools` array.
   - Replace `<distilled>` regex parsing with the typed `content[]` blocks parser (text + tool_use).
   - Add `validateArtifact` runtime check.
   - Keep `<distilled>` as a single fallback for one release (parse the response text if no tool_use was returned).
   - Return `{ response, artifact, referenced_capture_ids }`.
2. Update `PursuitDetailClient.handleSendMessage`:
   - Pass `current_artifact: currentArtifact`.
   - Read `agentData.artifact` directly; remove the `distilled_text` wrap from PR 2.
3. Deploy the Edge Function.

**Acceptance:**
- End-to-end, the user has the same prose-distillation experience.
- No new kinds yet.
- The agent now knows about the surface state and supports iteration via `current_artifact`.
- **Iteration test:** distill a prose block, manually edit it, ask Ki to "make it tighter" — Ki's output is a refinement of the *edited* text, not a fresh generation from corpus.
- **Conversational test:** a normal chat message that doesn't warrant an artifact returns no `artifact` field in the response — the surface stays as-is.

### PR 4 — `OutlineArtifact`

1. `pnpm add` no new packages required (Markdown round-trip is hand-rolled).
2. Create `apps/web/src/components/artifacts/OutlineArtifact.tsx` with the render-plus-source toggle.
3. Implement `markdownToTree` and `treeToMarkdown` with idempotent round-trip.
4. Register in `registry.ts`.
5. Drop the `<distilled>` fallback parser from `pursuit-agent` — new contract is verified.
6. Manual verification: open a project, ask "outline what we've talked about here" → an outline appears in the surface, edit-as-Markdown works, save produces a `pursuit_artifacts` row with `type='outline'`, valid `data.tree`, `content` matching the Markdown copy.

**Acceptance:** the user can ask for an outline and get one. Toggle to edit shows Markdown bullets. Toggle back rebuilds the styled view. Copy produces the Markdown. Save writes correctly. No regressions on prose path.

### PR 5 — `MermaidArtifact`

1. `pnpm add mermaid` in `apps/web`.
2. Create `apps/web/src/components/artifacts/MermaidArtifact.tsx` with SVG render + source toggle + render-error fallback + theme-reactive `useEffect`.
3. Register in `registry.ts` via `next/dynamic({ ssr: false })`.
4. Manual verification across all four `diagram_type` values (flowchart, sequence, mindmap, state).
5. Verify dark↔light theme switch re-renders existing diagrams.
6. Verify bad source produces a graceful error, not a crash.

**Acceptance:** the user can ask for a flowchart, sequence, mindmap, or state diagram and get one. SVG renders. Source toggle shows the underlying Mermaid syntax in an editable textarea. Bad source shows the error inline. Copy produces the Mermaid syntax. Save writes correctly. Theme changes re-render. No SSR errors in dev or prod.

---

## Acceptance Criteria (apply to every PR)

- TypeScript strict, no `any` types
- RLS preserved on every new table or column
- Captures remain immutable
- **Grounding rule (relaxed):** every agent-emitted artifact carries `referenced_capture_ids`. Empty is acceptable when the user explicitly asked for a fresh scaffold; the prompt governs this. The Edge Function does not reject artifacts based on grounding.
- Conversational fluency unchanged — Ki's prose responses must feel the same as today
- Surface user-experience is byte-identical to today on the prose path until the user explicitly asks for a non-prose artifact
- Dark mode and light mode both work for every new renderer
- Every renderer respects design tokens (Cream / Charcoal palette, Merriweather / Poppins typography)
- All Supabase access via `packages/services` — no inline client calls in components

---

## Architecture Rules (non-negotiable)

These extend the existing rules in `.claude/CLAUDE.md`.

1. **The user has power to decide the direction, always.** The agent never overrides an explicit user request for a form. If the user says "outline," the agent outlines.
2. **Artifacts are grounded by default.** Agent-emitted artifacts carry `referenced_capture_ids` listing the captures they draw from. Empty is the explicit exception case (user asked for a fresh scaffold). Fabricated UUIDs are never acceptable.
3. **The surface is single-artifact.** One artifact at a time. Replace, don't queue.
4. **Pending state is client-only.** Until "save to Ki" is clicked, the artifact lives in React state.
5. **Renderers are independent.** Adding a new artifact kind is one new file in `apps/web/src/components/artifacts/` plus one line in `registry.ts`. It does not touch `ArtifactSurface`, `PursuitDetailClient`, or any other renderer.
6. **`toCopyText` is the source of truth at copy / save time.** `Artifact.text` is the agent's emitted snapshot — useful as a starting point, but never authoritative. Renderers mutate `data` freely.
7. **Storage rule is fixed.** Prose → `captures` (`source_type='distilled'`). Everything else → `pursuit_artifacts`. No exceptions in v1.
8. **The agent contract is a discriminated union, not a per-kind API.** Adding a new kind expands the `Artifact` union, the prompt's kind catalog, and the tool's `input_schema.properties.kind` enum. It does not add new fields to the Edge Function response or new endpoints.

---

## Risks and Mitigations

### Agent picks the wrong kind

**Risk:** user wanted prose, agent picks an outline.
**Mitigation:** the user-initiated flow is first-class. The user can always say "actually, prose this." The conversational reply acknowledges the form, so the user catches the choice immediately. Monitor real conversations after PR 4 ships and tune the prompt if the agent over-picks structured forms.

### Tool input fails Anthropic schema validation

**Risk:** the model produces a tool call that doesn't match the schema.
**Mitigation:** Anthropic returns an error block instead of `tool_use`; we treat that as "no artifact" and the conversational reply still lands. Log for prompt tuning. This is rare in practice with a well-defined schema — much rarer than JSON-in-XML failures would be.

### Mermaid render fails on bad source

**Risk:** the agent emits Mermaid syntax that doesn't parse.
**Mitigation:** the renderer catches the error from `mermaid.render`, shows the source as text with the error message, and lets the user edit. The user can also ask Ki conversationally to fix it ("there's a bracket error on line 3 — can you fix it?").

### Iteration breaks because agent doesn't read `current_artifact`

**Risk:** agent regenerates from scratch instead of editing.
**Mitigation:** the prompt explicitly instructs the agent to read `current_artifact` and replace it. PR 3's iteration test verifies behavior end-to-end.

### `current_artifact` exceeds the size cap

**Risk:** a very large artifact forces truncation, agent loses context.
**Mitigation:** when truncated, the agent receives a placeholder noting the truncation and the kind. The agent should ask the user to clarify what to change rather than guessing. In practice, even a 100-node outline serializes well under 30KB.

### Markdown↔tree round-trip drift in outline

**Risk:** `markdownToTree(treeToMarkdown(tree)) !== tree` for some edge case (mixed indent, unusual characters).
**Mitigation:** keep the parser narrow — only `^(\s*)- (.+)$` lines. Anything else falls back to a single flat node containing the original text. Verified by experimentation with realistic agent output.

### Mermaid SSR crash in production

**Risk:** Mermaid touches `document` during import.
**Mitigation:** registry uses `next/dynamic({ ssr: false })`. Verified manually in PR 5 by running `pnpm build && pnpm start` and opening a project with a Mermaid artifact.

### Backwards-compat fallback left in too long

**Risk:** the `<distilled>` fallback parser stays forever and confuses future contributors.
**Mitigation:** drop the fallback in PR 4 with an explicit step in the PR. Add a comment in the fallback code pointing at this plan.

### Long-form prose loses the editorial feel

**Risk:** wrapping prose in a typed object feels different even though it's still a textarea.
**Mitigation:** PR 2's acceptance bar is byte-identical UX to today. Test by hand before merge.

### Save-to-Ki creates a dead end in v1

**Risk:** users hit "save" and the artifact appears to vanish.
**Mitigation:** v1.5 retrieval is sketched immediately (see below) and ships right after v1. v1 acceptance includes a small toast / inline confirmation ("saved to your project") so the click feels acknowledged. The artifact also stays in the surface after save (rather than clearing) until the user explicitly clears or generates a new one.

---

## v1.5 Retrieval Sketch

This is not built in v1, but it's part of the same body of work — sketched here so we know exactly how the loop closes.

### What v1.5 adds

A "saved artifacts" surface within the project, plus the ability to reopen any saved artifact in the creation surface.

### Where it lives

In `PursuitDetailClient.tsx`, below the chat panel or as a sliding drawer from the captures panel. Shows a chronological list of:
- Distilled prose captures (`captures` filtered by `source_type='distilled'` AND `source_metadata->>'project_id' = project.id`)
- Project artifacts (`pursuit_artifacts` filtered by project)

Mixed and sorted by date, each with a small kind badge and preview.

### What clicking does

Loads the artifact into the surface (`setCurrentArtifact(...)`). For prose it reconstructs `{ kind: 'prose', text: capture.body, referenced_capture_ids: capture.source_metadata.referenced_capture_ids }`. For non-prose it reads from `pursuit_artifacts` and reconstructs from `data` and `content`.

### What changes about saving

The save action stays the same. The only addition is that after save, the new entry appears in the saved-artifacts list immediately (optimistic update + invalidation).

### What's intentionally minimal

- No editing of saved artifacts in v1.5 — clicking opens them, edits live in the surface, "save" creates a new entry. (Editing in place is a later choice.)
- No cross-project gallery in v1.5 — project-scoped only.
- No tags or organization beyond chronology.

This is the immediate next phase, not a far-future feature. The data is already there in v1 because saving works.

---

## What's Deferred

- **`system_map` / canvas embedded in the surface.** The canvas at `/projects/[id]/canvas` stays as its own page.
- **`slide_deck`, `script`, `table`, `image_prompt`.** v2 conversations.
- **PNG / PDF / SVG export.** Copy-as-text is sufficient for v1.
- **Multimedia output history feed (cross-project).** v2.
- **Image generation.** v2 — needs separate orchestration path.
- **Mobile creation space.** Web only in v1. Mobile remains the intake valve.
- **Mobile artifact display.** Prose artifacts (distilled captures) appear on mobile via existing library code as today. Non-prose artifacts in `pursuit_artifacts` are not queried by mobile UI in v1 — they exist in the database but are invisible on mobile. If a user expects to see a Mermaid diagram on mobile after creating it on web, they won't (and that's acceptable for v1; mobile isn't a creation surface).
- **Non-prose artifacts re-entering the corpus.** Currently only `prose` re-enters as a distilled capture.
- **Manual kind picker UI.** Conversation is the only interface in v1.
- **Read-back of saved artifacts within v1.** Deliberately deferred to v1.5 (see retrieval sketch above) — v1's purpose is to validate generation.

---

## Open Questions to Revisit After v1 Ships

- **Should non-prose artifacts also re-enter the corpus?** Generate an auto-summary capture pointing at the artifact? Decide based on whether users start asking "find that flowchart I made about X."
- **Should the agent ever ask before emitting?** The prompt says "ask once if ambiguous, then act." Some users may prefer "always act, I'll iterate." Tune.
- **Should agent-emitted artifacts auto-save?** Today's "save to Ki" is explicit. Keep explicit save for v1; revisit if users complain about losing artifacts when switching projects.
- **Should the surface show a small "X" or "undo" affordance when the agent replaces an existing artifact?** Today's behavior is silent replacement.
- **Should non-artifact responses also drive capture highlights?** v1 only highlights when an artifact is emitted. The chat-with-ki function does proper RAG citations — borrow that pattern if highlights on plain conversations prove useful.

---

## The Design Principle to Hold

The thought distiller is not a tool that produces artifacts. The conversation is the tool. The artifact is the residue of the conversation made tangible.

The user always has the final word on form. The agent may suggest. The agent may offer. The agent never decides over the user's stated preference. When in doubt, the agent asks. When asked, the agent acts.

What lives in the surface is always the user's thinking, taking the shape the user wanted. The agent helps it find that shape. That is the entire job.
