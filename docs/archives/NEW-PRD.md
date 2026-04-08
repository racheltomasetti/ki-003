# Ki — Mind Extension
### Product Requirements Document

---

## What Ki Is

Ki is a personal intelligence system — a living extension of your mind.

You feed it everything that matters to you. Your own thoughts captured by voice or text in the moment. External knowledge that moves you — articles, books, files, documents. Any artifact from the world that you find significant enough to hold onto.

Ki ingests all of it, enriches it, connects it, and makes it explorable. Over time it becomes the most complete portrait of a mind ever assembled — not by a therapist, not by a researcher, but by you, for you.

The core thesis: **Ki only knows what you give it. There is no hallucination. When Ki tells you something about yourself, it is because you said it, saved it, or chose it.**

The more you feed Ki, the smarter it gets about you specifically. It compounds. A week of captures is a log. A year is a self-portrait. A decade is a map of how a mind evolves.

---

## The Two Surfaces

Ki is not a mobile app with a web companion. It is a system where two surfaces serve fundamentally different purposes and work in constant tandem — but also stand completely alone.

You should be able to live entirely in the mobile app if that is your flow. You should be able to live entirely on the web if that is your flow. Both surfaces are full-featured. Neither depends on the other. They share the same corpus, the same auth, the same backend. The difference is context and form factor, not capability.

**Mobile — intimate and immediate**

Your phone is always with you. Mobile is optimized for speed, single-handed use, and the moment. The thought that hits you walking down the street. The article you just read. The voice memo at 11pm. Friction is near zero because thoughts and moments do not wait.

**Web — expansive and intentional**

Your laptop is where you sit down with purpose. You have a file to process. You want to spend an hour in your corpus. You want to see your knowledge graph at full scale. Optimized for depth, real estate, and the kind of thinking that needs space.

---

## The Capture Surface

Both mobile and web support the full capture surface. The experience is adapted to the form factor but the capability is identical.

**Voice** — speak a thought, transcribed automatically, enriched as a personal capture. The most natural and frictionless capture type. The soul of Ki.

**Text** — free-form brain dump, paste anything, no structure imposed. The fallback for everything.

**URL** — paste a link, Ki fetches and extracts the content, enriches it as a knowledge artifact. The web flows into your corpus.

**File** — upload a PDF, doc, or any text-extractable document. Extracted, chunked if large, enriched as a knowledge artifact. Covers books, exported notes, research papers, anything that lives on your computer.

**Media** — images attached as optional context to any capture. A photo of a whiteboard, a screenshot, something visual that anchors a thought. Stored but not independently enriched — the meaning comes from your words, not the image itself. Vision-based enrichment is a future phase.

**External artifacts with annotation** — any URL or file capture can have a voice memo or text note attached to it. The artifact is the world. The annotation is you. Both are stored as linked captures, enriched separately, always connected. You are not just saving things, you are saving your relationship to them.

**The significance moment** — when ingesting an external artifact, Ki surfaces a lightweight prompt: why does this matter to you? One line, a voice note, a connection to something else. Optional but encouraged. This user context is the most valuable signal in the enrichment pipeline. Over time Ki can surface not just what you saved but why you kept saving certain kinds of things.

---

## The Corpus

The corpus is the heart of Ki. A unified, ever-growing body of knowledge that belongs entirely to you.

**One table for everything**

Every capture — regardless of type or source — lives in the same captures table. A voice memo and a PDF chapter and a URL are the same thing at the database level: a unit of meaning with an owner. The type is metadata. The pipeline is the same. This keeps the corpus unified and queryable as a single body of knowledge.

**Chunking for large documents**

Large files are split into chunks. Each chunk is its own capture row linked to a parent capture that holds the source metadata. Chunks are individually searchable and embeddable. The parent is always traceable. The corpus view shows the parent as a single node. Drill in to see the chunks.

**Collections**

Captures can be organized into collections — curated sets around a theme, a project, a period of time. A collection is a garden bed. You choose what goes in it, you prune it, you tend it. Collections become nodes in the knowledge graph.

**Biometric data**

Oura, Whoop, Apple Health and similar integrations live in separate tables — not in the corpus. Body data is passively collected, not mind-generated. It belongs structurally apart. The exploration tools can overlay biometric data against the corpus but the tables stay clean and distinct.

---

## The Enrichment Pipeline

One pipeline. Two enrichment profiles based on who authored the content. Same embedding at the end.

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
- `time_of_day_cat` — derived from captured_at, not from Claude
- `key_quotes` — most significant phrases
- `entities` — named entities as structured JSON

**Artifact profile** — URL and file captures. External knowledge artifacts.

Extracted:
- `summary` — distillation of the source content
- `themes` — concepts present in the artifact
- `key_quotes` — most significant passages
- `entities` — people, organizations, books, concepts mentioned
- `questions_raised` — questions the content addresses or opens
- `source_sentiment` — tone of the source material itself
- `user_context` — the user's significance note, enriched separately using the personal profile

**The pipeline flow**

```
Capture enters (any type, any surface)
→ Pre-processing by type
    voice  → transcribe (Whisper → Deepgram)
    text   → body directly
    url    → fetch + extract main content
    file   → extract text, chunk if large, create parent + children
→ Store in captures table
→ Postgres webhook fires on insert
→ enrich-capture Edge Function runs async
    → determine enrichment profile from capture.enrichment_profile
    → single Claude Haiku call, structured JSON response
    → write to enrichments table
    → generate vector embedding (text-embedding-3-small)
    → write embedding to enrichments table
→ user never waits for any of this
```

---

## The Exploration Layer

The corpus is the foundation. The exploration layer is the toolbox — different lenses on the same underlying data. Tools are additive. New ones get built based on what people actually want to do with their data.

**Chat with Ki**

Conversational exploration grounded entirely in the corpus. No hallucination. Every response cites specific captures with dates and sources.

```
User asks a question
→ Embed the question
→ Hybrid search: BM25 (keyword) + pgvector cosine similarity (semantic)
→ Retrieve top N most relevant captures
→ Pass as context to Claude
→ Stream response with citations
→ Model switcher: Haiku | Sonnet | Opus
```

**Knowledge graph**

A visual mind map of the entire corpus. Nodes are captures, concepts, entities, questions, collections. Edges are AI suggested, semantically discovered, or manually drawn. The graph builds itself during enrichment. Entity resolution identifies that the same person appears across many captures under different names. The user can drag, link, label, and forge connections on the canvas. Inspired by Webb's entity resolution and knowledge graph — applied to a personal corpus.

**Timeline**

The corpus on a time axis. Zoom from a single day to years. Overlay biometric data against thought captures. Watch a belief evolve. See what you were thinking when you made a decision.

**Corpus explorer**

Browse everything by type, source, date, theme, entity, collection. The complete picture of what is in your Ki.

**Canvas**

Freeform spatial workspace. Drag captures, arrange them, draw connections, build something from raw material. Export as image.

**Pattern dashboard**

Ki's synthesis surfaced to you. Recurring themes. Questions you keep raising. People who appear in your thinking. Beliefs that are shifting. What Ki is noticing that you might not have consciously seen yet.

---

## Data Architecture

### Stack

| Layer | Technology |
|---|---|
| Mobile | Expo + React Native (new architecture) |
| Web | Next.js 14 App Router |
| Styling mobile | NativeWind |
| Styling web | Tailwind CSS |
| Backend | Supabase — Postgres, Auth, Storage, Edge Functions |
| State | Zustand |
| Data fetching | TanStack Query |
| Auth | Supabase Auth — unified session across mobile and web |
| Transcription | Whisper API → Deepgram (post-launch) |
| URL extraction | Edge Function — fetch + content extraction |
| File processing | Edge Function — pdf-parse, mammoth |
| Enrichment AI | Claude Haiku |
| Chat AI | Claude Sonnet (model switcher) |
| Vector search | pgvector via Supabase |
| Knowledge graph | React Flow (web) |
| Deployment | Vercel (web), EAS (mobile) |

### Monorepo Structure

```
ki-003/
├── apps/
│   ├── mobile/               Expo app
│   └── web/                  Next.js app
├── packages/
│   ├── types/                shared TypeScript types
│   ├── services/             shared Supabase service logic
│   └── utils/                shared utilities
├── supabase/
│   ├── migrations/           all schema migrations
│   └── functions/            Edge Functions
├── .claude/
│   ├── PRD.md                this document
│   └── CLAUDE.md             Claude Code context
└── README.md
```

### Database Schema

**profiles**
```
id              uuid PK     = auth.users.id
display_name    text
avatar_url      text
created_at      timestamptz
```

**captures**
```
id                  uuid PK
user_id             uuid FK → profiles.id
type                text    'voice' | 'text' | 'url' | 'file'
source_type         text    freeform — 'manual' | 'web' | 'readwise' etc.
source_url          text    origin URL if from web
source_title        text    article title, book name, document name
source_metadata     jsonb   flexible per-source structured data
body                text    always text, never altered after write
media_paths         text[]  storage paths for attached images
user_context        text    why this matters to the user
parent_id           uuid FK → captures.id
chunk_index         int     order within chunked document
is_chunked          boolean
enrichment_profile  text    'personal' | 'artifact'
collection_id       uuid FK → collections.id
visibility          text    'private' | 'friends' | 'public' default private
is_pinned           boolean
captured_at         timestamptz
created_at          timestamptz
```

**enrichments**
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
embedding         vector(1536)
processed_at      timestamptz
model_used        text
```

**collections**
```
id            uuid PK
user_id       uuid FK → profiles.id
name          text
description   text
cover_color   text
is_pinned     boolean
created_at    timestamptz
```

**tags**
```
id        uuid PK
user_id   uuid FK → profiles.id
name      text
unique(user_id, name)
```

**capture_tags**
```
capture_id    uuid FK → captures.id
tag_id        uuid FK → tags.id
primary key (capture_id, tag_id)
```

**graph_nodes**
```
id            uuid PK
user_id       uuid FK
capture_id    uuid FK → captures.id
node_type     text    'capture' | 'concept' | 'entity' | 'question' | 'collection'
label         text
position_x    float
position_y    float
```

**graph_edges**
```
id                uuid PK
user_id           uuid FK
source_node_id    uuid FK → graph_nodes.id
target_node_id    uuid FK → graph_nodes.id
edge_type         text    'ai_suggested' | 'user_created' | 'semantic' | 'temporal' | 'entity_shared'
strength          float
label             text
```

**connections**
```
capture_a_id    uuid FK → captures.id
capture_b_id    uuid FK → captures.id
strength        float
confirmed       boolean default false
primary key (capture_a_id, capture_b_id)
```

**follows** *(phase 4)*
```
follower_id     uuid FK → profiles.id
following_id    uuid FK → profiles.id
created_at      timestamptz
primary key (follower_id, following_id)
```

**Biometric tables** *(phase 3 — built at integration time)*

Oura, Whoop, Apple Health and similar integrations will have dedicated tables built when each integration is built — not before. Schema will be defined at that time. These tables live outside the corpus and connect to it in the exploration layer only.

---

## Build Phases

### Phase 1 — The core loop

One working loop across both surfaces. Capture on either surface, find it in the corpus, talk to Ki about it.

**Both surfaces:**
- Auth — sign up, sign in, onboarding
- Voice capture — record, transcribe, store, enrich
- Text capture — input, store, enrich
- URL capture — fetch, extract, significance moment, enrich
- Media attachment on any capture
- Library — chronological feed, search, filter
- Collections — create, organize, browse

**Web additionally:**
- File upload — extract, chunk, enrich
- Basic chat with Ki — RAG, citations, model switcher

**Supabase:**
- Full schema with all tables and RLS
- Both enrichment profiles working
- Chunking pipeline for files
- Vector embeddings on all captures

### Phase 2 — Intelligence

- Hybrid search — BM25 + pgvector
- Knowledge graph first pass — AI suggested connections
- Timeline view
- Pattern dashboard deepened
- Oura integration — connect, sync, biometric overlay
- Chat with Ki deepened — conversation history, follow-up

### Phase 3 — The laboratory

- Full knowledge graph canvas
- Canvas tool — freeform spatial workspace
- Biometric integrations — Oura, Whoop, Apple Health. Dedicated tables built at integration time, not before. Connected to the corpus in the exploration layer.
- Additional integrations based on user demand
- Vision enrichment for images
- New exploration tools based on what users actually want to do with their data

### Phase 4 — Community

- Public profiles
- Shared knowledge graphs
- Community exploration tools

---

## Key Decisions — Locked

- **Bundle ID:** com.unlockki.ki
- **Supabase project:** ki-003
- **Repo:** ki-003 (private, GitHub)
- **App Store name:** TBD — decided with Hannah
- **Domain:** unlock-ki.com
- **No hallucination policy:** Ki never generates knowledge about the user. Every insight cites a real capture.
- **Raw is permanent:** Captures never altered after write. Enrichment lives alongside, never on top.
- **Private by default:** All captures default to private. Community infrastructure exists in schema from day one.
- **One corpus table:** All capture types in one table. Type is metadata. Pipeline is universal.
- **Biometric data separate:** Body data lives in its own tables. Connected in the exploration layer, not the corpus.

---

## What Ki Is Not

- Not a productivity tool. No tasks, no to-dos, no projects.
- Not a note-taking app. Notes are structured. Ki is not.
- Not a search engine. Ki understands meaning, not just keywords.
- Not a therapy app. Ki surfaces patterns. It does not diagnose or advise.
- Not a hallucination machine. If it is not in your corpus, Ki does not know it.
- Not finished. Ki grows with its users and with what emerges from building it.