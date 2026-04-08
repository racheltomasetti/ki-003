# Ki — Product Requirements Document

---

## What Ki Is

Ki is a personal intelligence system — a living extension of your mind.

You feed it everything that matters to you: thoughts captured by voice or text, files and documents from the world you find significant enough to hold onto, anything that matters.

Ki ingests all of it, enriches it, connects it, and makes it explorable. Over time it becomes the most complete portrait of a mind ever assembled — not by a therapist, not by a researcher, but by you, for you.

**The core thesis:** Ki only knows what you give it. There is no hallucination. When Ki tells you something about yourself, it is because you said it, saved it, or chose it.

The more you feed Ki, the smarter it gets about you specifically. It compounds. A week of captures is a log. A year is a self-portrait. A decade is a map of how a mind evolves.

---

## The Two Surfaces

Ki is a system where two surfaces serve fundamentally different purposes, designed to work in tandem. Both are complete and fully usable on their own — but each makes the other more powerful.

Mobile is optimized for capture and immediacy. Web is optimized for exploration and depth. They are two expressions of the same system, not a primary app and a companion. They share the same corpus, the same auth, the same backend. The difference is context and form factor, not capability.

**Mobile — intimate and immediate**

Your phone is always with you. Mobile is optimized for speed, single-handed use, and the moment. Friction is near zero because thoughts and moments do not wait.

**Web — expansive and intentional**

Your laptop is where you sit down with purpose. You have a file to process. You want to spend an hour in your corpus. You want to see your knowledge graph at full scale. Optimized for depth, real estate, and the kind of thinking that needs space.

---

## The Capture Surface

Both mobile and web support the full capture surface. The experience is adapted to the form factor but the capability is identical.

**Voice** — speak a thought, transcribed automatically via Whisper API, enriched as a personal capture. The most natural and frictionless capture type. The soul of Ki.

**Text** — free-form brain dump, paste anything, no structure imposed.

**File** — upload a PDF, doc, or any text-extractable document. Extracted, chunked if large, enriched as a knowledge artifact. Available on both mobile and web in Phase 1.

**URL** — paste a link, Ki fetches and extracts the content, enriches it as a knowledge artifact. Phase 2 — cut from Phase 1 due to edge cases with paywalls, timeouts, and extraction failures.

**Media** — images attached as optional context to any capture. A photo of a whiteboard, a screenshot, something visual that anchors a thought. Stored but not independently enriched — the meaning comes from your words. Vision enrichment is a future phase.

**External artifacts with annotation** — any file capture can have a voice memo or text note attached as `user_context`. The artifact is the world. The annotation is you. Both stored as linked captures, enriched separately, always connected.

**The significance moment** — when ingesting a file, Ki surfaces a lightweight optional prompt: why does this matter to you? Non-blocking — the capture saves immediately, the prompt is a second step. This `user_context` is stored on the capture and enriched separately under the personal profile. Surfaced in the UI as "add context" or "description" — same field, friendlier label. Over time Ki surfaces not just what you saved but why you kept saving certain kinds of things.

---

## The Corpus

Every capture — regardless of type or source — lives in the same `captures` table. A voice memo and a PDF chapter and a text note are the same thing at the database level: a unit of meaning with an owner. The type is metadata. The pipeline is universal.

**Chunking for large documents** — Large files are split into chunks. Each chunk is its own capture row linked to a `parent_id` capture that holds the source metadata. Chunk size: ~2000 tokens with 200-token overlap. Chunks are individually searchable and embeddable. The parent is always traceable.

**Tags** — Captures can be tagged with freeform labels. Tags are the only organization mechanism in Phase 1. The library filters by tag. Collections as a concept is deferred — potentially to Phase 2 as named clusters that emerge from the knowledge graph rather than manual boxes.

**Biometric data** — Oura, Whoop, Apple Health integrations are Phase 3. When built, they live in dedicated tables outside the corpus. Connected to the corpus in the exploration layer only.

---

## The Memory Document

Every user has a living memory document stored as a text field on their profile (`profiles.memory_document`). This is the foundational context layer for every Chat with Ki interaction. It represents who the user is at a deep level and stays current as they grow.

The memory document is the first thing passed to the model in every chat. It is always included, at a fixed budget of ~800 tokens.

**Sections:**

- **Who you are** — values, essence, how you see yourself
- **What you are building or working toward** — current focus and goals
- **What you are processing** — open questions, tensions, unresolved threads
- **People in your world** — key relationships that appear in their thinking
- **Your patterns** — when you are at your best, what drains you, how your energy moves
- **Recurring themes** — concepts and questions that keep surfacing across captures
- **Current chapter** — where they are right now in the larger arc of their life

The user owns this document entirely. Each section is presented as a readable card on the Profile screen — tappable to expand and edit. Updates take effect immediately for all future chat interactions.

**Seeded at onboarding.** For the first cohort, the memory document is written by the operator and seeded into the user's profile before they log in for the first time. Their first Ki experience is Ki already knowing them.

---

## The Enrichment Pipeline

One pipeline. Two enrichment profiles based on who authored the content. Embedding at the end of both.

**Personal profile** — voice and text captures. Anything the user generated themselves.

Extracted:
- `summary` — 1-2 sentence distillation
- `themes` — 2-5 concept strings
- `sentiment` — positive, neutral, negative, mixed
- `mood_tags` — inferred emotional language
- `energy_level` — low, medium, high
- `capture_intent` — reflection, idea, question, observation, gratitude, processing
- `questions_raised` — implicit or explicit questions in the capture
- `people_mentioned` — first names or roles
- `time_of_day_cat` — derived from `captured_at`, never from Claude
- `key_quotes` — most significant phrases
- `entities` — named entities as structured JSON

**Artifact profile** — file captures. External knowledge artifacts.

Extracted:
- `summary` — distillation of the source content
- `themes` — concepts present in the artifact
- `key_quotes` — most significant passages
- `entities` — people, organizations, books, concepts mentioned
- `questions_raised` — questions the content addresses or opens
- `source_sentiment` — tone of the source material itself
- `user_context` — the user's significance note, enriched separately using the personal profile
- `title` — auto-populated from first line of summary if the user left the title blank

**The pipeline flow**

```
Capture enters (any type, any surface)
→ Pre-processing by type
    voice  → transcribe (Whisper API; Deepgram is the post-launch upgrade path)
    text   → body directly
    file   → extract text, chunk at ~2000 tokens / 200 overlap, create parent + children
→ Store in captures table
→ Postgres webhook fires on INSERT
→ enrich-capture Edge Function runs async
    → determine enrichment profile from capture.enrichment_profile
    → single Claude Haiku call, structured JSON response
    → if captures.title is blank, set title from first line of summary
    → write to enrichments table (enrichment_status: 'complete' | 'failed')
    → generate vector embedding (text-embedding-3-small, 1536 dims)
    → write embedding to enrichments.embedding
→ user never waits for any of this
```

**Failure handling** — If enrichment fails, `enrichment_status` is set to `'failed'` on the enrichments row. A background job can retry failed enrichments. The capture is never blocked.

**Rate limiting** — Edge Function checks capture count in the last 24 hours before enriching. If over threshold, enrichment is queued rather than run immediately. Captures are never blocked by this.

---

## The Exploration Layer

**Chat with Ki** — Conversational exploration grounded entirely in the corpus. No hallucination. Every response cites specific captures with dates and sources. If the answer is not in the corpus, Ki says so.

Every chat interaction passes exactly two layers to the model. This architecture is a constant — it does not change as the corpus grows.

**Layer 1 — Memory document** (~800 tokens, always included)
Who this person is right now. Always the first thing in context.

**Layer 2 — RAG retrieval** (~2500 tokens)
Top 10 semantically relevant captures to the question.
Weighted by: starred status first → semantic similarity second → recency as tiebreaker.

Total context budget: ~3300 tokens. Always.

No separate recent captures layer — recency is handled as a retrieval tiebreaker and through the memory document's current chapter. No hard rate limits on capture frequency ever. The user is never told they are capturing too much.

```
User asks a question
→ Layer 1: memory document fetched from profiles.memory_document
→ Layer 2: embed the question (text-embedding-3-small)
          → pgvector cosine similarity search
          → retrieve top 10, weighted: starred first → similarity → recency
→ Pass both layers to Claude Sonnet
→ Stream response with citations (capture date + source)
→ Model switcher: Haiku | Sonnet | Opus
→ Hybrid search upgrade in Phase 2: BM25 + pgvector
```

Phase 1 search in the Library: Postgres full-text search with GIN index on a generated `tsvector` column. Fast, no external dependency, bridges cleanly to Phase 2 hybrid.

---

## The Profile Screen

Profile is not a settings screen. It is a mirror of the user's mind.

The memory document sections are presented as individual readable cards — not a wall of text. Each card is tappable to expand and edit. The user owns this document and can update any section manually at any time.

```
Top
  Name, avatar, member since

Memory cards — one per section
  [ Who you are           ]
  [ What you're building  ]
  [ What you're processing]
  [ People in your world  ]
  [ Your patterns         ]
  [ Recurring themes      ]
  [ Current chapter       ]

Stats
  Total captures, days active, top themes, streak
```

---

## Onboarding — First Cohort

The first cohort is onboarded through a real conversation — a call or in-person meeting. After that conversation the memory document is written by the operator and seeded into their profile before they log in for the first time. Their first Ki experience is Ki already knowing them. This is the product moment.

For Phase 1 the operator creates user accounts and writes memory documents directly in the Supabase dashboard. No custom admin interface needed yet. Build a proper admin UI in Phase 2 when managing users manually becomes the bottleneck.

**Knowledge graph** — A visual mind map of the corpus. Phase 2+. Schema is in place from day one.

**Timeline** — The corpus on a time axis. Phase 2.

**Pattern dashboard** — Ki's synthesis surfaced to you. Phase 2.

---

## Data Architecture

### Stack

| Layer | Technology |
|---|---|
| Mobile | Expo SDK 55 + React Native (new architecture only) |
| Web | Next.js 14 App Router |
| Styling mobile | NativeWind |
| Styling web | Tailwind CSS |
| Backend | Supabase — Postgres, Auth, Storage, Edge Functions |
| Monorepo | pnpm workspaces |
| State | Zustand |
| Data fetching | TanStack Query |
| Auth | Supabase Auth — unified session. Mobile: email + Apple + Google. Web: email + Google. |
| Transcription | Whisper API (Phase 1) → Deepgram (post-launch upgrade) |
| File processing | Edge Function — pdf-parse, mammoth |
| URL extraction | Phase 2 — Edge Function, fetch + content extraction |
| Enrichment AI | Claude Haiku |
| Chat AI | Claude Sonnet (model switcher: Haiku \| Sonnet \| Opus) |
| Vector search | pgvector via Supabase |
| Knowledge graph | React Flow (web, Phase 2) |
| Deployment | Vercel (web), EAS (mobile) |

### Monorepo Structure

```
ki-003/
├── apps/
│   ├── mobile/               Expo app
│   └── web/                  Next.js app
├── packages/
│   ├── types/                shared TypeScript types (Supabase-generated + app types)
│   ├── services/             shared Supabase service logic (client-injected)
│   └── utils/                shared utilities
├── supabase/
│   ├── migrations/           all schema migrations
│   └── functions/            Edge Functions
├── .claude/
│   ├── PRD.md                this document
│   └── CLAUDE.md             Claude Code context
├── docs/
│   └── NEW-PRD.md            source PRD (reference, do not modify)
└── README.md
```

### Service Client Injection Pattern

`packages/services` functions accept a Supabase client as a parameter. Each surface creates its own client and passes it in. This resolves the mobile vs web Supabase client difference:

- **Mobile**: `@supabase/supabase-js` — standard client with AsyncStorage session
- **Web**: `@supabase/ssr` — `createBrowserClient` for client components, `createServerClient` for server components and route handlers

Services contain the business logic. Apps own the client lifecycle.

```ts
// packages/services/captures.ts
export async function getCaptures(client: SupabaseClient, userId: string) { ... }

// apps/mobile — passes its own client
// apps/web — passes its own client (browser or server)
```

### Database Schema

**profiles**
```
id                  uuid PK     = auth.users.id
display_name        text
avatar_url          text        storage path, not URL
bio                 text
memory_document     text        living memory document — foundational chat context
memory_updated_at   timestamptz last time memory document was updated
created_at          timestamptz
```
*Auto-created via Postgres trigger on `auth.users` INSERT.*

**captures**
```
id                  uuid PK
user_id             uuid FK → profiles.id
type                text    'voice' | 'text' | 'file'   (URL is Phase 2)
source_type         text    'voice' | 'text' | 'file' | 'oura' | 'apple_health' | 'manual'
source_url          text    origin URL if from web
source_title        text    article title, book name, document name
source_metadata     jsonb   flexible per-source structured data
title               text    optional user title; auto-set from summary if blank after enrichment
body                text    always text, never altered after write
media_paths         text[]  storage paths for attached images
user_context        text    why this matters to the user — surfaced in UI as "add context"
parent_id           uuid FK → captures.id (for file chunks, null if standalone)
chunk_index         int     order within chunked document
is_chunked          boolean default false
enrichment_profile  text    'personal' | 'artifact'
status              text    'active' | 'archived' | 'deleted' default 'active'
visibility          text    'private' | 'friends' | 'public' default 'private'
is_starred          boolean default false    (starred captures weighted highest in RAG retrieval)
captured_at         timestamptz device time
created_at          timestamptz server insert time
```

**enrichments** *(written by pipeline only — never by the app)*
```
id                uuid PK
capture_id        uuid FK → captures.id
summary           text
themes            text[]
sentiment         text
mood_tags         text[]
energy_level      text
capture_intent    text
questions_raised  text[]
people_mentioned  text[]
time_of_day_cat   text
key_quotes        text[]
entities          jsonb
source_sentiment  text
user_context      text    AI-processed interpretation of captures.user_context (artifact profile)
embedding         vector(1536)
enrichment_status text    'pending' | 'complete' | 'failed' default 'pending'
processed_at      timestamptz
model_used        text
```

**tags**
```
id        uuid PK
user_id   uuid FK → profiles.id
name      text
unique(user_id, name)
```

**capture_tags** *(junction)*
```
capture_id    uuid FK → captures.id
tag_id        uuid FK → tags.id
primary key (capture_id, tag_id)
```

*Phase 2+ tables (graph, integrations, connections, joint sessions) will be added as new migrations when those phases begin. No schema-in-place.*

---

## Build Phases

### Phase 1 — The core loop

One working loop across both surfaces. Capture on either surface, find it in the corpus, talk to Ki about it.

**Both surfaces:**
- Auth — sign up, sign in, onboarding
- Voice capture — record, transcribe, store, enrich
- Text capture — input, store, enrich
- File upload — extract, chunk, enrich (available on both mobile and web)
- Media attachment on any capture
- Library — feed, full-text search (Postgres FTS + GIN), filter by tag
- Tags — create, apply, filter
- Profile screen — memory document cards (readable, tappable, editable per section), stats

**Web additionally:**
- Basic chat with Ki — two-layer context (memory document + RAG), citations, model switcher

**Supabase:**
- Phase 1 schema: profiles, captures, enrichments, tags, capture_tags — RLS on all
- Both enrichment profiles working
- Chunking pipeline for files
- Vector embeddings on all captures (from day one)
- `enrich-capture` Edge Function

### Phase 1.5 — Memory update suggestions

After enrichment completes on a new capture, a secondary `suggest-memory-updates` Edge Function runs. It compares the enrichment against the existing memory document and surfaces a suggestion to the user if something significant, new, or contradictory emerges.

```
Ki noticed something. Want to update your memory?

"You have mentioned feeling uncertain about your
direction 4 times this week. Add this to your
current processing?"

[ Accept ]  [ Edit ]  [ Dismiss ]
```

If accepted, `profiles.memory_document` updates immediately and all future chat interactions reflect it.

Build this after the core loop is working — not in the initial Phase 1 build, but the immediate next thing.

### Phase 2 — Intelligence

- URL ingestion — fetch, extract, significance moment, enrich (deferred from Phase 1)
- Hybrid search — BM25 + pgvector
- Knowledge graph first pass — AI suggested connections
- Timeline view
- Pattern dashboard
- Oura integration
- Chat with Ki deepened — conversation history, follow-up
- Ki Pro subscription launched (Chat with Ki + semantic search + pattern synthesis)

### Phase 3 — The laboratory

- Full knowledge graph canvas
- Canvas tool — freeform spatial workspace
- Biometric integrations — Oura, Whoop, Apple Health
- Additional integrations based on user demand
- Vision enrichment for images
- New exploration tools based on what users actually want

### Phase 4 — Connections

Ki is not a social network. Phase 4 is the space where two minds choose to think together — mutual, intentional, intimate.

- **Connections** — mutual relationships, both parties accept. No followers, no audience, no one-sided feed.
- **Joint sessions** — a shared space where two connected users think together. Each user explicitly selects which of their captures enters the session. Nothing included by default.
- **Public profile layer** — users choose which parts of their memory document are visible publicly. The connection itself remains mutual and private.
- Shared knowledge graph exploration between connected users

---

## Key Decisions — Locked

- **Bundle ID:** com.unlockki.ki
- **Supabase project:** ki-003
- **Domain:** unlock-ki.com
- **No hallucination policy:** Ki never generates knowledge about the user. Every insight cites a real capture.
- **Raw is permanent:** Captures never altered after write. Enrichment lives alongside, never on top.
- **Private by default:** All captures default to private. Community infrastructure exists in schema from day one.
- **One corpus table:** All capture types in one table. Type is metadata. Pipeline is universal.
- **Biometric data separate:** Body data lives in its own tables when built. Connected in the exploration layer, not the corpus.
- **Tags only in Phase 1:** No collections UI. Collections revisited in Phase 2+ as knowledge graph clusters.
- **Embeddings from day one:** Generated in the Phase 1 enrichment pipeline. Required for Phase 1 web chat.
- **Client injection:** packages/services accepts a Supabase client as a parameter. Apps own their client.
- **Phase 1 search:** Postgres full-text search (GIN index on tsvector). Hybrid search is Phase 2.
- **Enrichment failures tracked:** `enrichment_status` field. Failed enrichments are retryable without re-saving the capture.
- **URL capture is Phase 2:** Cut from Phase 1 due to edge cases with paywalls, timeouts, and extraction failures. Phase 1 capture types are voice, text, and file only.
- **Starring over pinning:** `is_starred` signals the user consciously marked this capture as significant. Starred captures are weighted highest in RAG retrieval — quality floats to the top without rate limiting.
- **Memory document is Phase 1:** `profiles.memory_document` is foundational, not deferred. It is the first context layer in every Chat with Ki interaction.
- **Capture title auto-generated:** `captures.title` is optional for the user. If blank, the enrichment pipeline sets it from the first line of the enrichment summary. The user can always override.

---

## What Ki Is Not

- Not a productivity tool. No tasks, no to-dos, no projects.
- Not a note-taking app. Notes are structured. Ki is not.
- Not a search engine. Ki understands meaning, not just keywords.
- Not a therapy app. Ki surfaces patterns. It does not diagnose or advise.
- Not a hallucination machine. If it is not in your corpus, Ki does not know it.
- Not finished. Ki grows with its users and with what emerges from building it.
