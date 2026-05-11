# PURSUIT_MODEL.md
## The Pursuit — Entity Model, Data Schema, and Mechanics
*Locked: May 2026*

---

## The Entity

A pursuit is the central organizational unit in Ki.

It is not a project with a deadline. It is not a goal with a finish line. It is something you are carrying — a question you are living, a thing you are building, a direction you are moving in. At its center is a **core question**: the guiding light that gives the pursuit its meaning and makes new information relevant or not.

Pursuits and curiosities are the same kind of thing at different stages of crystallization. They live in one table, differentiated by status.

---

## Status Lifecycle

```
curiosity ──→ active ──→ archived
                 ↑            │
                 └────────────┘  (can be reopened if a slot is available)
```

### curiosity
A vague interest. A question not yet live enough to carry. No core question required. Does not directly receive captures. Uncapped — a user can have as many curiosities as they want. The antechamber.

### active
An antenna. Has a core question. Receives captures and resonance matches. Maximum three at any time. This is where thinking deepens.

### archived
A pursuit that has run its course, or been set down. Read-only. Its corpus remains fully accessible. Can be reactivated if a slot opens. Archiving is not failure — it is completion of a phase.

---

## The Three-Slot Constraint

At any given time, a user carries a maximum of **three active pursuits**.

This is a hard constraint, not a soft recommendation. Three is enough to hold the complexity of a life in motion. It is not so many that attention fragments and nothing receives what it deserves. Constraints create focus. Focus creates depth.

### Promotion conditions

A curiosity becomes active when all three are true:

1. A slot is available (fewer than three active pursuits)
2. The user explicitly promotes it
3. A core question is defined

All three conditions matter. The core question is not optional for active pursuits — it is what transforms a vague interest into an active antenna and what powers resonance matching.

### Ki's role in promotion

Ki reflects patterns back without pushing. If a curiosity's name or themes keep appearing in new captures, Ki may surface: "You've returned to this curiosity several times recently — is it ready to become a pursuit?" This is a reflection, not a recommendation.

---

## The Core Question

Every active pursuit has a core question. Curiosities do not.

The core question is the guiding light that gives the pursuit its meaning. It is what makes new information relevant or not. It is the antenna's frequency.

**Examples:**
- "What does it look like to build software that is deeply alive?"
- "What is my relationship with risk, and how is it shaping my decisions?"
- "How do I become someone who follows through?"
- "What kind of creator do I actually want to be?"

The core question is:
- User-defined when a curiosity is promoted, or at creation if creating directly as active
- Editable — a pursuit's question can deepen as understanding deepens
- Embedded as a vector (1536 dimensions) at write time — the embedding powers resonance matching
- Stored as both text and embedding on the pursuit row

---

## Data Schema

### `pursuits` table (renamed from `projects`)

Existing columns retained: `id`, `user_id`, `name`, `description`, `color`, `what`, `why`, `success_looks_like`, `open_question`, `created_at`, `updated_at`

New columns:

```sql
status                    text          NOT NULL DEFAULT 'active'
-- 'active' | 'curiosity' | 'archived'
-- Existing rows after rename migration default to 'active'

core_question             text
-- null for curiosities
-- required before status can be set to 'active'

core_question_embedding   vector(1536)
-- generated (OpenAI text-embedding-3-small) when core_question is set or updated
-- null when core_question is null
```

### `capture_pursuits` table (renamed from `capture_projects`)

Structure unchanged. Rename only.

```sql
capture_id   uuid  NOT NULL  REFERENCES captures(id)  ON DELETE CASCADE
pursuit_id   uuid  NOT NULL  REFERENCES pursuits(id)  ON DELETE CASCADE
user_id      uuid  NOT NULL  REFERENCES auth.users(id)
PRIMARY KEY (capture_id, pursuit_id)
```

### `enrichments` table — new column

```sql
pursuit_connections   jsonb
-- [{pursuit_id, reason, confidence, matched_at}]
-- null until enrichment pipeline populates it
-- appended to (not replaced) during retroactive passes
```

**Shape of each connection object:**

```ts
interface PursuitConnection {
  pursuit_id: string   // uuid — which pursuit this capture resonates with
  reason:     string   // "This connects to your pursuit of X because it touches your question around Y"
  confidence: number   // 0–1 float — similarity signal
  matched_at: string   // ISO timestamp
                       // ≈ captured_at → matched at enrichment time (live)
                       // > captured_at → matched during a retroactive pass
}
```

The `matched_at` timestamp is the key signal. It distinguishes a connection made at capture time (the thought arrived and Ki immediately saw where it belonged) from a retroactive connection (a new pursuit crystallized and Ki looked back). Both are valuable. The distinction is meaningful.

---

## Resonance Matching

### At enrichment time (live match)

Every new capture goes through the existing `enrich-capture` Edge Function. As an additional step, after enrichment:

1. The capture's embedding (already generated for pgvector) is compared via cosine similarity to each active pursuit's `core_question_embedding`
2. Matches above a confidence threshold trigger a Haiku call to generate the `reason` explanation
3. The resulting `PursuitConnection` objects are written to `enrichments.pursuit_connections`
4. `matched_at` is set to the enrichment timestamp

This does not block the capture. It runs as part of the same Edge Function invocation, after the primary enrichment is complete.

### At pursuit-creation time (retroactive pass)

When a pursuit is promoted from curiosity → active (or created directly as active):

1. The `core_question_embedding` is generated and stored on the pursuit
2. A background Edge Function (`match-corpus-to-pursuit`) is triggered asynchronously
3. It reads all captures in the user's corpus, computes similarity against the new pursuit's embedding
4. For matches above threshold, generates `reason` via Haiku and writes a `PursuitConnection` into `enrichments.pursuit_connections` for that capture
5. `matched_at` is set to the time the pass ran — later than the captures' `captured_at`, making it identifiable as retroactive

The retroactive pass runs asynchronously and does not block the UI. The past reorganizes around the present — silently, in the background.

### Confidence thresholds

Calibrated at implementation time. Start high (≥ 0.80) to keep connections meaningful, and lower through testing if useful connections are being missed. The `reason` explanation is only generated for matches above threshold — below-threshold matches are discarded, not stored.

---

## What This Renames

The rename from `projects` → `pursuits` touches every layer. The full scope:

| Layer | Before | After |
|---|---|---|
| Database table | `projects` | `pursuits` |
| Database junction | `capture_projects` | `capture_pursuits` |
| RLS policies | reference `projects` | updated to reference `pursuits` |
| Types package | `Project` type | `Pursuit` type |
| Services package | `projects.ts` | `pursuits.ts` |
| Service functions | `getProjects`, `createProject`, etc. | `getPursuits`, `createPursuit`, etc. |
| New service functions | — | `getActivePursuits`, `getCuriosities`, `promoteToPursuit`, `archivePursuit`, `updateCoreQuestion` |
| Web routes | `/projects/[id]` | `/pursuits/[id]` |
| Web components | `ProjectDetailClient`, etc. | `PursuitDetailClient`, etc. |
| Edge functions | `project-agent` | `pursuit-agent` (or renamed internally) |
| CLAUDE.md schema | `projects` table | `pursuits` table |

The rename is complete — no "projects" terminology remains in any user-facing surface or in any code after the migration.

---

## Migration Sequence

One migration covers all schema changes (migration 012 — the next one after current state). Everything below goes in a single file: `supabase/migrations/20260510000000_pursuits.sql` (or whatever timestamp is next).

**Migration 012 — pursuits rename + status + core question + pursuit_connections**
```sql
-- Rename tables
ALTER TABLE public.projects         RENAME TO pursuits;
ALTER TABLE public.capture_projects RENAME TO capture_pursuits;

-- Add status
ALTER TABLE public.pursuits
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Add core question fields
ALTER TABLE public.pursuits
  ADD COLUMN IF NOT EXISTS core_question           text,
  ADD COLUMN IF NOT EXISTS core_question_embedding vector(1536);

-- Constraint: active pursuits must have a core_question
-- (enforced at the service layer, not DB level, to allow graceful migration of existing rows)

-- Update RLS policies to reference renamed tables
-- (policy SQL not shown here — regenerate from Supabase dashboard after rename)
```

-- Pursuit connections on enrichments (same migration)
ALTER TABLE public.enrichments
  ADD COLUMN IF NOT EXISTS pursuit_connections jsonb;

After migration: existing `pursuits` rows have `status = 'active'` and `core_question = null`. The three-slot cap is enforced only going forward. Existing rows are grandfathered without core questions — Ki may prompt users to add one when they open a pursuit workspace.

---

## Relationship to Build Plans

**ARTIFACTS_BUILD_PLAN.md** — The artifact surface is pursuit-scoped. `ProjectDetailClient` → `PursuitDetailClient`. `project_artifacts` table stays as-is or renames to `pursuit_artifacts` (decide at migration time). All agent prompts reference "pursuit" and "core question."

**PROJECTS_AS_SYSTEMS.md** — The state synthesis is pursuit-scoped. The `synthesize-state` Edge Function receives the pursuit's core question as a primary input alongside the corpus. The `system_state` jsonb on the `pursuits` table (to be added in that plan's migration) is the cached synthesis output.

**CLAUDE.md** — Data schema section requires a full update to reflect `pursuits`, `capture_pursuits`, the new columns, and the `pursuit_connections` enrichment field.
