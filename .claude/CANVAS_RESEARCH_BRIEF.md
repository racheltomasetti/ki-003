# Ki — Canvas Research Brief
## Web Interface & Agent-Canvas Integration
*For the research team — April 2025*

---

## What Ki Is

Ki is a thinking tool for builders and creators. The core loop: **capture a thought → organize it → distill it into action.**

Mobile is the intake valve — voice-first, zero friction, always with you. Web is the laboratory — where you sit down with purpose, spread your thinking out in front of you, and synthesize it into something you can build from.

The canvas is the primary web surface. It is not a nice-to-have — it is the reason the web surface exists.

---

## Current Build State

### What is working today

**Mobile (Expo SDK 55, new arch):**
- Voice capture → Whisper transcription → post-capture review (edit transcript, assign to project, add tags, save)
- Enrichment pipeline fires async on every capture: Claude Haiku extracts structured metadata (summary, themes, sentiment, mood, energy level, intent, questions raised, people, key quotes, entities) + OpenAI `text-embedding-3-small` generates 1536-dim vectors
- Library screen: all captures feed with search (full-text via Postgres `tsvector`) + capture detail screen showing full enrichment panel
- Projects: create, list, tap into project detail (captures filtered by tag, horizontal tag filter pills)
- Project Brief: Ki-generated markdown document per project synthesized from all captures — includes "Context for Claude" section designed to be pasted into any LLM
- Chat with Ki: RAG-grounded conversational interface, Claude Sonnet, returns response + citations

**Web (Next.js 15, App Router):**
- Auth: email/password sign-in + sign-up (working, deployed)
- Middleware: session protection via `@supabase/ssr`
- Library page: stub (authenticated, shows user email, captures coming next)
- No canvas yet — this is what the research team is evaluating

**Backend (Supabase):**
- All schema migrations pushed to production
- 3 Edge Functions deployed: `enrich-capture`, `chat-with-ki`, `generate-brief`
- pgvector enabled, 1536-dim embeddings on every enriched capture
- RLS active on all tables

---

## Tech Stack

### Monorepo
```
ki-003/
├── apps/
│   ├── mobile/     Expo SDK 55 — React Native, new arch
│   └── web/        Next.js 15 App Router
├── packages/
│   ├── types/      Shared TypeScript types (app.ts + Supabase-generated database.ts)
│   ├── services/   All Supabase CRUD logic — client-injected pattern
│   └── utils/      Shared utilities
├── supabase/
│   ├── migrations/ 7 migrations, all pushed
│   └── functions/  3 Edge Functions (Deno runtime)
└── package.json    pnpm workspaces root
```

### Web stack specifically
| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 15 App Router | RSC + client components |
| Language | TypeScript strict | No `any` |
| Styling | Tailwind CSS v4 | Custom tokens below |
| State | Zustand | Not yet set up on web |
| Data fetching | TanStack Query | Not yet set up on web — will mirror mobile |
| Auth client | `@supabase/ssr` | Browser client for client components, server client for RSC/route handlers |
| Canvas | **TBD — this is what you're evaluating** | |

---

## Design System

These are locked. The canvas library must work within them or be styled to match.

```
// Colors
background (light): #f6f1e6   // Cream
background (dark):  #1a1a1a   // Charcoal
foreground (light): #1a1a1a
foreground (dark):  #f6f1e6

// Accents — same in both modes
terra:   #9e2a2b   // Primary CTA, active states
ray:     #efcb68   // Highlights, warmth
pacific: #58a4b0   // Secondary actions, links
sage:    #67934d   // Positive states

// Typography
serif: Merriweather  // Capture body text, display headings — "the thinking"
sans:  Poppins       // UI chrome — nav, labels, buttons — "the scaffolding"
```

Dark and light mode both required. Canvas must respect this.

---

## Data Schema

All tables in Postgres (Supabase). RLS on everything.

### `profiles`
```
id                uuid PK → auth.users
display_name      text
avatar_url        text
bio               text
memory_document   text   -- living narrative document; first context layer for all AI calls
memory_updated_at timestamptz
```

### `captures`
```
id                uuid PK
user_id           uuid → profiles
type              text  CHECK ('voice' | 'text' | 'file')
source_type       text  CHECK ('voice' | 'text' | 'file' | 'oura' | 'apple_health' | 'manual')
title             text  -- auto-set by pipeline from enrichment summary if blank
body              text  -- IMMUTABLE after write. The raw thought. Never altered.
media_paths       text[]
user_context      text  -- user's significance note
is_starred        boolean  -- quality signal; starred captures surface first in RAG
enrichment_profile text  CHECK ('personal' | 'artifact')
status            text  CHECK ('active' | 'archived' | 'deleted')
captured_at       timestamptz
fts_body          tsvector GENERATED  -- full-text search index
```

### `enrichments`
One-to-one with captures. Written by pipeline only — never by the app.

```
id                uuid PK
capture_id        uuid → captures (unique)
summary           text
themes            text[]
sentiment         text  CHECK ('positive' | 'neutral' | 'negative' | 'mixed')
mood_tags         text[]
energy_level      text  CHECK ('low' | 'medium' | 'high')
capture_intent    text  CHECK ('reflection' | 'idea' | 'question' | 'observation' | 'gratitude' | 'processing')
questions_raised  text[]
people_mentioned  text[]
key_quotes        text[]
entities          jsonb
time_of_day_cat   text  CHECK ('morning' | 'afternoon' | 'evening' | 'night')
embedding         vector(1536)  -- OpenAI text-embedding-3-small
enrichment_status text  CHECK ('pending' | 'complete' | 'failed')
model_used        text
```

### `tags`
```
id       uuid PK
user_id  uuid → profiles
name     text
UNIQUE (user_id, name)
```

### `capture_tags` (junction)
```
capture_id  uuid → captures
tag_id      uuid → tags
PRIMARY KEY (capture_id, tag_id)
```

### `projects`
```
id                  uuid PK
user_id             uuid → profiles
name                text
description         text   -- "what are you building or figuring out?"
color               text   -- hex, chosen at creation
brief               text   -- Ki-generated markdown document
brief_generated_at  timestamptz
```

### `capture_projects` (junction — many-to-many)
```
capture_id  uuid → captures
project_id  uuid → projects
user_id     uuid → profiles
PRIMARY KEY (capture_id, project_id)
```

A capture can belong to multiple projects. A project can contain many captures.

---

## Edge Functions (Supabase Deno runtime)

All functions use `SUPABASE_SERVICE_ROLE_KEY` for DB access. Auth is validated by passing the user's JWT directly to `serviceClient.auth.getUser(token)` — this is the reliable pattern (not user client creation).

### `enrich-capture`
**Trigger:** Postgres webhook on `captures` INSERT

Flow:
1. Receives capture record from webhook payload
2. Fetches user's `memory_document` from profiles for context
3. Calls Claude Haiku (`claude-haiku-4-5-20251001`) — extracts: summary, themes, sentiment, mood_tags, energy_level, capture_intent, questions_raised, people_mentioned, key_quotes, entities
4. Calls OpenAI `text-embedding-3-small` — 1536-dim vector
5. Updates `enrichments` row (pending row auto-created by Postgres trigger on captures INSERT)
6. Auto-sets `captures.title` from summary first sentence if title was blank

Never blocks the capture. Errors set `enrichment_status = 'failed'` — never propagate.

### `chat-with-ki`
**Called from:** mobile chat tab, web chat (planned)

Context architecture:
- Layer 1 (~800 tokens): `profiles.memory_document` — who this person is
- Layer 2 (~2500 tokens): top 10 captures via `match_captures` pgvector RPC

`match_captures` ordering: `is_starred DESC → cosine_similarity ASC → captured_at DESC`

Returns: `{ response: string, citations: Array<{ id, title, captured_at, similarity }> }`

Model: Claude Sonnet (`claude-sonnet-4-6`). No hallucination — every response grounded in corpus. If answer isn't in corpus, Ki says so.

### `generate-brief`
**Called from:** mobile project detail screen (button)

Flow:
1. Verifies project ownership
2. Fetches all captures in project with enrichments
3. Rejects if < 3 captures
4. Calls Claude Sonnet with all captures + enrichment data
5. Produces structured markdown brief:
   - What I'm Building
   - Key Decisions
   - Open Questions
   - Recurring Themes
   - **Context for Claude** — dense paragraph designed to be pasted into any LLM
6. Saves to `projects.brief` + `projects.brief_generated_at`

The Brief is the "express" step — the portable context artifact.

---

## Shared Packages

### `packages/services`
All Supabase logic lives here. Functions accept a Supabase client as first param — this is how mobile (`@supabase/supabase-js`) and web (`@supabase/ssr`) share the same service layer.

```
captures.ts    — getCaptures, getCapture, createCapture, updateCaptureStatus, starCapture
enrichments.ts — getEnrichment (read only — never write from app)
projects.ts    — getProjects, createProject, addCaptureToProject, removeCaptureFromProject, getProjectCaptures
storage.ts     — uploadMedia, getSignedUrl
profiles.ts    — getProfile, updateProfile, updateMemoryDocument
```

### `packages/types`
```
app.ts         — Capture, Enrichment, Tag, Project, CaptureProject, CaptureWithEnrichment, etc.
database.ts    — Supabase CLI generated — never hand-edit
```

---

## Web Folder Structure (current + planned)

```
src/app/
├── (auth)/
│   ├── sign-in/         ✅ working
│   └── sign-up/         ✅ working
├── (app)/
│   ├── layout.tsx       ✅ auth guard
│   ├── library/         🔲 stub — full implementation next
│   ├── projects/
│   │   ├── index/       🔲 projects list
│   │   └── [id]/        🔲 project detail + CANVAS ← this is the core surface
│   └── chat/            🔲 global chat with Ki
└── layout.tsx           ✅ fonts, providers
```

---

## The Canvas — What the Research Team Needs to Evaluate

### What the canvas is

The canvas is a **freeform node-based workspace** per project. It starts empty. The user builds it intentionally.

This is a critical distinction: **captures are not automatically added as nodes.** The user decides what goes on the canvas. They might pull in a specific capture they want to think with, write a new synthesis node from scratch, or let the agent create content. The canvas is curated, not a dump.

What the user can do on the canvas:
- **Create nodes** — write a new thought directly on the canvas, or deliberately pull in a specific capture from their project
- **Arrange nodes spatially** — cluster related ideas, spread competing concepts
- **Draw connections** (edges) — manual links the user creates between nodes
- **Create free-form annotation nodes** — synthesis, questions, decisions written in the moment
- **Invoke the agent** — Ki reads the project corpus (not just what's on the canvas) and produces structured content: new nodes, suggested connections, synthesis clusters

This is where the value of everything captured on mobile is realized — not by dumping it all out, but by deliberately selecting and arranging what matters right now.

### What the canvas is NOT

The canvas is not a visualization of the entire project corpus. That is a different surface — the **knowledge graph** — described below. Do not conflate them.

### Data model for canvas state

The canvas state (node positions, connections, annotation nodes, agent-created content) needs to be persisted. This is **not yet in the schema** — the research team should recommend a storage model.

Because the canvas is freeform and curated (not auto-populated), nodes fall into distinct types:
- **Capture nodes**: a reference to a specific capture (`capture_id` + position + visual state)
- **Annotation nodes**: user-written text created directly on the canvas (no capture reference)
- **Agent nodes**: content created by Ki (marked as agent-created, editable/deletable by the user)

Options to evaluate:
1. A `canvas_nodes` table + `canvas_edges` table (structured, queryable)
2. A `canvas_state` JSONB column on the `projects` table (simpler, fine if canvas state is always loaded whole)
3. A hybrid: structured `canvas_nodes` table with a `type` column, JSONB for edge data

Key constraint: **captures are immutable**. A capture node is a *reference* to a capture — its position and visual state are canvas metadata, not stored on the capture itself.

### Agent-canvas interaction

The agent (Claude Sonnet) operates in the canvas context. When invoked:
1. User optionally selects a subset of nodes (or the agent reads all project captures)
2. Agent receives: selected captures + their enrichments + project brief (if exists)
3. Agent returns **structured canvas operations**: create new nodes, suggest edges, cluster nodes, write synthesis annotations
4. User reviews agent output — everything agent creates is editable and deletable

The agent creates. The user curates. Nothing the agent does is permanent without user acceptance.

This interaction model will require a new edge function (e.g., `canvas-agent`) and a defined response schema for canvas operations.

### Canvas library evaluation criteria

The team should evaluate options against these requirements:

**Must-have:**
- Node-based rendering with custom node components (React) — captures render as styled cards, not generic boxes
- Draggable nodes with position persistence
- User-drawn edges between nodes
- Pan and zoom (infinite canvas)
- Programmatic node/edge creation (for agent output)
- Can be styled to match Ki's design system (cream/charcoal, terra accent, Merriweather/Poppins)
- Works within Next.js App Router (client component — canvas cannot be SSR)
- Active maintenance and good TypeScript support

**Nice-to-have:**
- Node grouping / clustering visual affordances
- Minimap for large canvases
- Selection of multiple nodes (for agent invocation on a subset)
- History / undo

**Known candidates to evaluate:**
- **React Flow** — the current plan-of-record. Mature, excellent TypeScript, custom nodes, active. MIT licensed. Good fit for the use case. Verify Next.js 15 / React 19 compatibility.
- **Xyflow** (the org behind React Flow) — same library, just rebranded
- **tldraw** — more whiteboard-oriented, heavier, opinionated UI. Evaluate if freeform annotation matters a lot.
- **Excalidraw** — open source whiteboard. Very freeform, less structured node graph.
- **Konva / react-konva** — canvas-based (HTML Canvas, not DOM). More control, more work. Worth evaluating if React Flow has performance issues at scale.

**Key question for the research team:** The canvas is curated — the user intentionally adds nodes rather than having all project captures auto-loaded. Realistic canvas sizes are likely 10–100 nodes in active use. Performance at 500+ is less critical than the quality of the interaction at 20–50. Evaluate libraries for interaction quality first, raw scale second.

---

## Architecture Rules the Canvas Must Respect

These are non-negotiable:

1. **Supabase client pattern.** No direct Supabase calls in canvas components. All data access via `packages/services`, client injected.
2. **Captures are immutable.** Canvas can store node *positions* and *visual metadata* — it cannot alter `captures.body` or any capture field.
3. **RLS always on.** Any new canvas tables must have RLS. Users can only read/write their own canvas state.
4. **No hallucination.** Agent-created canvas content must be grounded in the user's captures. Agent cannot invent nodes that reference captures that don't exist.
5. **No `any` types.** TypeScript strict throughout.
6. **Canvas is web-only.** Mobile is capture. Web is the laboratory. Do not try to build canvas on mobile.

---

## Questions the Research Team Should Answer

1. **Canvas library:** Which library best fits the requirements? What are the trade-offs?
2. **Schema for canvas state:** `canvas_nodes` + `canvas_edges` tables, or JSONB on projects? What are the querying needs?
3. **Agent response schema:** What does a `canvas-agent` edge function response look like? How do we represent "create node at position X", "suggest edge between A and B", "create cluster containing [A, B, C]"?
4. **Real-time:** Do we need collaborative real-time canvas (multiple users editing the same canvas)? Not in V1, but the architecture choice may constrain it later. Supabase Realtime (Postgres changes) is available if needed.
5. **Interaction quality at 10–50 nodes:** The canvas is intentionally curated — not auto-populated. Evaluate libraries at realistic canvas sizes. What does the drag, connect, and arrange experience feel like at this scale?

---

## Where to Start When We Resume

The agreed build sequence:

1. Web library page — full captures feed with search (unblocks testing the web corpus)
2. Web projects list — mirrors mobile, same data
3. Web project detail — captures list + brief display
4. Canvas — the primary web surface, per project
5. Agent in canvas — invoke Ki from within the canvas

The canvas library decision gates step 4. That's what the research team is unblocking.

---

*Ki codebase: `ki-003/` monorepo. Full product context: `.claude/PRD.md`. Full dev context: `.claude/CLAUDE.md`.*
