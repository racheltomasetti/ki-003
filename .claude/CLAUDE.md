# Ki — Claude Code Context

## What We're Building

Ki is intentional software for creating the life you desire. It is not a note-taking app, a journal, or a second brain. It is the space where raw, unfinished thinking becomes something you can work with — where captures accumulate into clarity, and clarity becomes action.

The central entity is a **pursuit**: something you are carrying — a question you are living, a thing you are building, a direction you are moving in. At its center is a core question that gives the pursuit its meaning. Users carry a maximum of three active pursuits at a time. Anything not yet ready to carry lives as a **curiosity** (uncapped, no core question, same table, different status).

The loop: **capture a thought → connect it to a pursuit → distill it into action.**

Full product context: `docs/MISSION.md` (north star — read before any product decision) and `docs/PURSUIT_MODEL.md` (entity model, data schema, resonance matching).

---

## The Two Surfaces

Ki uses mobile and web for what each is genuinely best at. They are not the same app on two screens — they are two different relationships with your thinking.
ok
**Mobile — the intake valve.**
Voice-first. Always with you. One tap, speak, done. The goal is zero friction between a thought and the corpus. V1 is voice-only on mobile. Text and file capture come later, on mobile and web.

**Web — the laboratory.**
Where you sit down with purpose to think. The primary surface is a node-based canvas — a mind map workspace where you pull up a project, see your captured thoughts as nodes, arrange them, connect them, and distill your thinking into something you can act on. The agent lives here too, reading your corpus and helping you synthesize.

```
ki-003/
├── apps/
│   ├── mobile/     Expo SDK 55 — voice capture, intake valve
│   └── web/        Next.js 14 App Router — canvas, exploration, synthesis
├── packages/
│   ├── types/      Supabase-generated types + shared app types
│   ├── services/   All Supabase service logic — client-injected
│   └── utils/      Shared utilities
├── supabase/
│   ├── migrations/ All schema migrations
│   └── functions/  Edge Functions
└── package.json    pnpm workspace root
```

---

## Tech Stack

### Shared
| Layer | Technology |
|---|---|
| Language | TypeScript throughout — no `any`, no shortcuts |
| Monorepo | pnpm workspaces |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) |
| State | Zustand |
| Data fetching | TanStack Query |
| Enrichment AI | Claude Haiku (via Supabase Edge Functions) |
| Chat / Agent AI | Claude Sonnet |
| Vector search | pgvector via Supabase |

### Mobile (`apps/mobile`)
| Layer | Technology |
|---|---|
| Framework | Expo SDK 55, new architecture only |
| Navigation | Expo Router (file-based) |
| Styling | NativeWind (Tailwind for React Native) |
| Supabase client | `@supabase/supabase-js` with SecureStore session |
| Auth | Email/password + Sign in with Apple + Sign in with Google |
| Voice recording | expo-audio |
| Transcription | OpenAI Whisper API |

### Web (`apps/web`)
| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router |
| Styling | Tailwind CSS |
| Canvas | React Flow — node-based mind map workspace |
| Supabase client | `@supabase/ssr` — browser client for client components, server client for RSC/route handlers |
| Auth | Email/password + Sign in with Google |

---

## Design System

### Colors

```ts
// Light mode
background: '#f6f1e6'  // Cream
foreground: '#1a1a1a'  // Charcoal

// Dark mode
background: '#1a1a1a'  // Charcoal
foreground: '#f6f1e6'  // Cream

// Accents (same in both modes)
terra:   '#9e2a2b'  // Primary CTA, destructive
ray:     '#efcb68'  // Highlights, streaks, warmth
pacific: '#58a4b0'  // Secondary actions, links, calm states
sage:    '#67934d'  // Positive states, growth indicators
```

### Typography

```ts
serif: 'Merriweather'   // Capture body text, editorial moments, display headings
sans:  'Poppins'        // UI chrome — nav, labels, metadata, buttons
```

Serif = the thinking. Sans = the scaffolding around it.

### Dark / Light Mode

Both modes supported. Respect system preference, manual override in Profile. Mobile: NativeWind `dark:` variants. Web: Tailwind `dark:` variants. Never hardcode colors.

---

## Mobile Folder Structure

```
app/
├── (auth)/
│   ├── sign-in.tsx
│   └── sign-up.tsx
└── (tabs)/
    ├── home/
    │   └── index.tsx           # Pursuits overview
    ├── library/
    │   ├── index.tsx           # All captures feed + search
    │   └── captures/[id].tsx   # Capture detail + enrichment
    ├── capture/
    │   └── index.tsx           # Voice capture screen
    ├── chat/
    │   └── index.tsx           # Chat with Ki
    └── profile/
        └── index.tsx           # Profile + settings

store/
├── captureStore.ts
└── authStore.ts

hooks/
├── useCaptures.ts
├── usePursuits.ts
└── useEnrichments.ts
```

### Tab Bar
Five items: Home · Library · [Ki Logo center] · Chat · Profile. The Ki logo is the capture button — no label, raised above the bar, tapping it enters voice capture. Tab bar stays visible throughout capture.

---

## Web Folder Structure

```
app/
├── (auth)/
│   ├── sign-in/
│   └── sign-up/
└── (app)/
    ├── library/        # Corpus feed — all captures, searchable
    ├── pursuits/
    │   ├── index/      # Pursuits list (active + curiosities)
    │   └── [id]/       # Pursuit workspace — the primary thinking environment
    └── chat/           # Chat with Ki (global, not pursuit-scoped)
```

---

## Shared Packages

```
packages/types/src/
├── database.ts   # Generated by Supabase CLI — never hand-edit
└── app.ts        # Shared UI-level types

packages/services/src/
├── captures.ts   # All capture CRUD
├── enrichments.ts # Read only
├── pursuits.ts   # Pursuit CRUD + capture-pursuit relationships (renamed from projects.ts)
├── storage.ts    # Signed URLs, media upload
├── profiles.ts   # Profile + memory document
└── index.ts
```

---

## Architecture Rules

**Service client injection.** `packages/services` functions accept a Supabase client as their first parameter. Mobile uses `@supabase/supabase-js`. Web uses `@supabase/ssr`.

**Captures are immutable after write.** `body` is never altered once saved. Enrichment lives in a separate `enrichments` table.

**Enrichments are written by the pipeline only.** The app reads enrichments, never writes them. All writes happen via the `enrich-capture` Edge Function triggered by Postgres webhook on captures INSERT.

**`packages/services` is the only place Supabase logic lives.** No direct Supabase calls in screens or components.

**RLS is always on.** Every table has row-level security.

**Audio is ephemeral.** Record → transcribe → store transcript → delete audio. Audio never persists.

**Pursuits are the primary organizational unit.** A capture can belong to multiple pursuits. Tags are cross-cutting labels that work inside and across pursuits. Both exist — they are different tools. Maximum three active pursuits per user (hard constraint). Curiosities are uncapped and live in the same table with `status='curiosity'`.

**The pursuit workspace is pursuit-scoped on web.** Each pursuit has a workspace. Captures assigned to that pursuit are available as context. The agent reads the pursuit's corpus and core question when operating in a pursuit workspace.

**Memory document is the first chat context layer.** Always included in every Chat with Ki interaction at ~800 tokens. Layer 2 is RAG: top 10 captures via pgvector, weighted starred first → similarity → recency.

**`is_starred` is the quality signal.** Starred captures surface first in RAG. Never use `is_pinned`.

---

## Capture Lifecycle

```
active   → default, visible in library
archived → hidden from feed, preserved
deleted  → permanent, cascades to enrichments
```

---

## Enrichment Profile

- `personal` — voice and text captures. Haiku extracts: summary, themes, sentiment, mood_tags, energy_level, capture_intent, questions_raised, people_mentioned, key_quotes, entities.
- `artifact` — file captures. Haiku extracts: summary, themes, key_quotes, entities, questions_raised, source_sentiment, user_context. Also auto-sets `captures.title` from summary if title was blank.

`time_of_day_cat` is derived from `captured_at` in the Edge Function — never from Claude.

---

## Data Schema (current)

**profiles** — id, display_name, avatar_url, bio, memory_document, memory_updated_at

**captures** — id, user_id, type, source_type, title, body, media_paths, user_context, parent_id, is_chunked, enrichment_profile, status, visibility, is_starred, captured_at

**enrichments** — id, capture_id, summary, themes, sentiment, mood_tags, energy_level, capture_intent, questions_raised, people_mentioned, key_quotes, entities, source_sentiment, time_of_day_cat, embedding (vector 1536), enrichment_status, processed_at, model_used, **pursuit_connections** (jsonb — `[{pursuit_id, reason, confidence, matched_at}]`)

**tags** — id, user_id, name

**capture_tags** — capture_id, tag_id, user_id

**pursuits** — id, user_id, name, description, color, **status** ('active'|'curiosity'|'archived'), **core_question** (text, null for curiosities), **core_question_embedding** (vector 1536), what, why, success_looks_like, open_question
— Max 3 active pursuits per user. See `docs/PURSUIT_MODEL.md` for full spec.

**capture_pursuits** — capture_id, pursuit_id, user_id

**pursuit_artifacts** — id, pursuit_id, user_id, type, title, content, data (jsonb), created_at

---

## Edge Functions

**enrich-capture** — triggered by Postgres webhook on captures INSERT. Claude Haiku enrichment + OpenAI embedding + pursuit resonance matching (writes `pursuit_connections` to enrichments). Never blocks the capture.

**match-corpus-to-pursuit** — triggered when a pursuit is promoted from curiosity → active. Retroactive resonance pass across the user's full corpus. Writes `pursuit_connections` entries for matches above threshold. Runs asynchronously.

**chat-with-ki** — called from mobile chat tab and web. Embeds question → match_captures RPC (pgvector) → layers memory document → Claude Sonnet → returns response + citations.

**pursuit-agent** — called from the pursuit workspace. Reads pursuit corpus + core question + memory document → Claude Sonnet with tool calling → returns response + optional artifact + referenced_capture_ids.

---

## Supabase Workflow

```bash
supabase login
supabase link --project-ref <project-ref>

# After schema changes
supabase gen types typescript --linked > packages/types/src/database.ts

# Push migrations
supabase db push

# Deploy edge functions
supabase functions deploy <function-name>
```

---

## Key Commands

```bash
pnpm install                          # Install all dependencies
pnpm --filter mobile start            # Mobile dev server
pnpm --filter web dev                 # Web dev server
pnpm -r exec tsc --noEmit            # Type check all packages
cd apps/mobile && npx expo run:ios   # Run on iOS simulator
```

---

## What Not To Do

- Do not add `any` types
- Do not write enrichments from the app — pipeline only
- Do not alter `captures.body` after initial write
- Do not scatter Supabase calls across screens — use `packages/services`
- Do not hardcode colors — use NativeWind / Tailwind tokens with `dark:` variants
- Do not hand-edit `packages/types/src/database.ts`
- Do not add URL capture on mobile — Phase 2
- Do not add text or file capture on mobile yet — nail voice first
- Do not use `is_pinned` — the field is `is_starred`
- Do not create a Supabase client inline in a component — use the injected client pattern
- Do not use "project" terminology anywhere — the entity is "pursuit". Tables: `pursuits`, `capture_pursuits`. Routes: `/pursuits/[id]`. Services: `pursuits.ts`.
- Do not allow more than 3 active pursuits per user — enforce at the service layer
- Do not write `pursuit_connections` from the app — only `enrich-capture` and `match-corpus-to-pursuit` Edge Functions write this field
- Read `docs/MISSION.md` before any product decision. Read `docs/PURSUIT_MODEL.md` before any schema or service work.
