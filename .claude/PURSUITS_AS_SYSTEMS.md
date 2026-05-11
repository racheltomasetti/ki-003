# Ki — Pursuits as Systems
## A reframing of what a pursuit is and what the workspace does
*Drafted: May 2026*
*Renamed: May 2026 — entity is "pursuit" not "project". See docs/PURSUIT_MODEL.md for the locked data model.*
*Status: thesis + design space — precedes a build plan*

---

## The Thesis

**We are building a system that builds systems.**

Each pursuit in Ki is a system the user is operating. It has a goal state (anchored by the core question), a current state, a gap between the two, decisions in motion, questions still open, things working, things blocked. The captures are the system's history. The agent is the operator that helps the user run it. What comes out of the workspace is the next move, articulated.

This reframes Ki from "AI that helps you think about your captures" to "the operating layer for the pursuits you're running." The first description is what Claude is already pretty good at. The second is what nothing else does, because nothing else has both the corpus and the time dimension.

---

## What This Replaces

Today's mental model treats a pursuit as a **container for related captures**. The pursuit name is a noun. The workspace shows captures, a chat, and a distiller. The user does the operating — pulls the relevant captures into mind, talks to the agent about them, distills.

The system mental model treats a pursuit as a **running thing with state, a core question, and direction**. The pursuit name is a verb phrase or a live question ("build ki", "what is my relationship with risk?"). The workspace shows the pursuit's current state by default. The agent operates with the user — surfaces state, surfaces drift, surfaces patterns, proposes the next move, all grounded in the corpus.

| Pursuit as container | Pursuit as system |
|---|---|
| Name is a noun | Name is a verb phrase or question |
| About a thing | For doing or understanding a thing |
| Captures are the content | Captures are the history |
| Workspace opens empty | Workspace opens with current state |
| Agent answers questions | Agent operates the system |
| Distillation is the output | The next move is the output |
| Could be a Claude conversation | Cannot be a Claude conversation |

The reframe doesn't invalidate any of the existing infrastructure. It re-uses it differently.

---

## What a System Has

Five primitives. Some are user-defined; some are derived from the corpus by the agent. All five exist whether we model them explicitly or not. Modeling them explicitly is what unlocks the operating-layer behavior.

### 1. Goal state (user-defined)
What this system is for. The destination. Today's `what` / `why` / `success_looks_like` cover this. Stays mostly as-is.

### 2. Current state (derived)
Where the system is right now. What's the active focus, what's been settled recently, what's still open, what's blocked, what's working. Synthesized from the corpus + recent conversations by the agent. Cached on the project; refreshable on demand.

### 3. The gap (derived)
Goal state minus current state. What's between here and there. Surfaced in the workspace as the implicit context for everything the user does.

### 4. Open questions (derived + user-maintained)
What's unresolved. The agent surfaces questions raised across captures. The user can pin or dismiss specific ones. The biggest one is today's `open_question` field on projects — keeps that, adds many more from the corpus.

### 5. Decisions made (derived from the corpus, user-confirmable)
What's been settled, when, based on what. The system's policy log. The agent identifies decisions that appear settled across captures; the user can confirm or correct.

The first is the project's contract with itself. The other four are what the agent operates over.

---

## The Pursuit Model

### What stays
`id`, `user_id`, `name`, `description`, `color`, `what`, `why`, `success_looks_like`, `open_question`, `created_at`, `updated_at`. All of these continue to mean what they mean today.

### What was added (locked in docs/PURSUIT_MODEL.md)
`status` ('active'|'curiosity'|'archived'), `core_question` (text), `core_question_embedding` (vector 1536). These are migration 013.

### What's added here
A `system_state` JSONB column on `pursuits` holding the derived state, plus a `system_state_at` timestamp.

```sql
ALTER TABLE public.pursuits
  ADD COLUMN IF NOT EXISTS system_state    jsonb,
  ADD COLUMN IF NOT EXISTS system_state_at timestamptz;
```

Where `system_state` is shaped:

```ts
interface SystemState {
  current_focus: string                  // a sentence — what's actively in motion
  recent_decisions: string[]             // settled choices, with implicit grounding from corpus
  open_questions: string[]               // unresolved tensions surfaced from captures
  blocked_on: string[] | null            // things stalling progress, if any
  working_well: string[]                 // momentum signals
  summary: string                        // a short paragraph the user can read in one breath
  generated_from_capture_ids: string[]   // grounding — which captures informed this state
}
```

This is a snapshot, not authoritative truth. It gets regenerated when the user asks for a refresh, or automatically when N new captures arrive in the project (threshold TBD — probably 5).

### What we may need later (not for first build)
- `status` — `in_motion` | `stalled` | `shipped` | `on_hold`. Useful for the home dashboard. Could be derived from activity recency + user input.
- `last_meaningful_movement_at` — for stall detection.
- A separate `decision_log` table — if decision tracking becomes more than a list-of-strings inside `system_state`.

Don't add these until we know we need them.

### What we may want to remove
The `ki` / `ki_updated_at` columns from migration 009 — the one-shot brief — were already deprioritized in `ki_direction_summary.md`. The `system_state` field replaces what that was reaching for. Leave the columns for now; remove in a later cleanup migration once nothing reads them.

---

## The Workspace

The three zones stay. What changes is what the center surface shows by default.

### Today
Open a project → captures left, **empty distiller in the middle**, empty chat right. The user has to start something to get anything.

### After
Open a project → captures left, **`system_state` rendered as the default artifact in the surface**, empty chat right. The user reads where the system is and reacts.

Mechanics:
- `system_state` is rendered using a new artifact kind (`state_snapshot`) — see "System-Shaped Artifacts" below.
- The renderer shows the state as a structured, readable layout (current focus, decisions, questions, blocks, momentum).
- The user can iterate on it via chat ("the open question about pricing isn't actually open anymore — I decided last week"), clear it to start a new artifact, or click into specific items to drill in.
- A small "refresh" affordance regenerates state from the current corpus.

This is a structural shift in what the surface is *for* — it's not just a place where artifacts get crystallized, it's also the resting view of the system itself.

The captures panel and chat panel are unchanged.

---

## The Agent's Job

Today the agent's prompt frames it as a "thinking partner" in a conversation. That's good but underspecified. The agent has no explicit job to do beyond responding well.

System-aware framing gives the agent a job description:

> You are operating a project. The project is a system the user is running. Your job is to help them see where the system is right now, what needs deciding, what's drifting, and what to do next — all grounded in the captures they have made over time.

This shapes:
- **What the agent surfaces unprompted.** Notice contradictions across captures. Notice when an open question has gone three weeks without movement. Notice when decisions appear to be implicitly being made. Surface these in conversation, not just when the user asks.
- **How the agent responds to vague messages.** "What should I be working on?" used to be hard to answer. Now it has a structured answer: read current state, look at the gap, look at what's blocked, propose the next move.
- **Which artifact kinds the agent reaches for.** When a system-level question is asked ("what have I decided about X?"), the agent reaches for a `decision_log` artifact, not a paragraph.

The system prompt update is meaningful but not a rewrite. It builds on the projects-as-systems framing on top of the existing structure.

---

## The Categorical Operations

These are the operations only Ki can perform — corpus-and-time-shaped, impossible to fake by pasting context into Claude. Each one is a candidate for both a conversational invocation and a system-shaped artifact kind.

### State synthesis
*"Where is this system right now?"* Reads the corpus, returns the current state. Defines the `state_snapshot` artifact and the `system_state` field on projects. The foundational operation — everything else builds on this.

### Decision tracing
*"What have I decided, when, based on what?"* Reads the corpus chronologically, identifies statements that read as resolutions, returns a chronological log with grounding. The `decision_log` artifact.

### Next-move synthesis
*"What's the most useful next thing to do?"* Reads current state + open questions + recent direction, proposes 1-3 candidate next moves with rationale grounded in captures. The `next_moves` artifact.

### Drift detection
*"What am I saying now that contradicts what I said before?"* Compares recent captures to older ones on the same theme. Flags contradictions or shifts. Could surface proactively or on user invocation.

### Pattern surfacing
*"What's coming up across this project?"* Reads enrichment themes across captures, identifies recurring tensions, returns a synthesis. Cross-cutting, not chronological.

### Evolution tracing
*"How has my thinking on X shifted over time?"* Filters captures to a theme, returns a time-ordered narrative of how the user's stance has changed.

### Continuously-current context handoff
*"Generate the exact paragraph someone would need to be fully caught up on this system right now."* Reaches `current_state` + active context fields + most recent meaningful captures, produces a dense paragraph for handoff to another agent or human. The `context_handoff` artifact — what the brief was reaching for, except always-current.

These seven operations are the differentiating surface. Everything else (chat, distillation into prose, diagrams, outlines) is supporting infrastructure. These are the categorical advantage.

---

## System-Shaped Artifacts

The artifacts plan locked three kinds: `prose`, `outline`, `mermaid`. Those are general expression vehicles. They stay.

System-shaped artifacts extend the same `Artifact` discriminated union with kinds whose existence only makes sense in Ki:

```ts
export type ArtifactKind =
  | 'prose'           // v1 — locked
  | 'outline'         // v1 — locked
  | 'mermaid'         // v1 — locked
  | 'state_snapshot'  // v1.1 — see below; ships first because the workspace needs it
  | 'decision_log'    // v2
  | 'next_moves'      // v2
  | 'context_handoff' // v2
  | 'pattern_report'  // v3
  | 'drift_report'    // v3
  | 'evolution_trace' // v3
```

Each new kind is one renderer, one tool-schema variant, one prompt update. The architecture from the artifacts plan is exactly the right substrate.

`state_snapshot` is the one we ship first because the workspace's default view depends on it. The others come in waves as they prove useful.

Per-kind data shapes (sketched, not yet locked):

```ts
| (ArtifactBase & {
    kind: 'state_snapshot'
    data: {
      current_focus: string
      recent_decisions: string[]
      open_questions: string[]
      blocked_on: string[] | null
      working_well: string[]
      generated_at: string
    }
  })
| (ArtifactBase & {
    kind: 'decision_log'
    data: {
      entries: Array<{
        decision: string
        decided_at_capture_id: string  // the capture where this resolution appears
        decided_at: string             // timestamp from the capture
        context: string                // brief surrounding context
      }>
    }
  })
| (ArtifactBase & {
    kind: 'next_moves'
    data: {
      moves: Array<{
        move: string
        rationale: string
        grounded_in_capture_ids: string[]
      }>
    }
  })
| (ArtifactBase & {
    kind: 'context_handoff'
    data: {
      paragraph: string                // dense, first-person, paste-anywhere
      destination_hint?: string        // "for Cursor" / "for a contractor" / etc.
    }
  })
```

These follow the same `text` + `data` + `referenced_capture_ids` shape as v1 kinds. The renderer registry handles them with the same interface. The save routing puts them in `project_artifacts` exactly like outline and mermaid.

---

## Naming and Conventions

### Project names should be verb phrases

Today: "ki", "raybuilds021"
Tomorrow: "build ki", "share ki"

The project creation flow should suggest this. Probably a placeholder ("e.g., 'build ki', 'ship the rebrand', 'figure out comp'") and a gentle copy nudge ("a verb phrase usually works better than a topic"). No enforcement — the user owns their naming.

This single change shifts the agent's posture meaningfully. The agent's prompt receives the project name verbatim. "build ki" tells the agent there's a system being built. "ki" tells the agent very little.

### Project creation should elicit system shape

Today the creation flow asks: name, color, mode, what, why, success_looks_like, open_question. This is reasonable but doesn't yet ask about the *current* state of the system.

Possible additions (not yet locked, design call needed):
- "Where are you with this right now?" → seeds initial `system_state.current_focus`
- "What's the next thing you're trying to do?" → seeds initial `system_state.recent_decisions[0]` or a "next move"
- "What's blocked, if anything?" → seeds `system_state.blocked_on`

These could be optional. Even one or two of them, captured at project birth, give the agent enough to start operating immediately rather than asking the user to bootstrap.

---

## What Changes Elsewhere

### Capture flow
Nothing changes at intake. Voice / text / file capture all work the same. The corpus accumulates. What changes is what gets done *with* the corpus on the workspace side.

### Library
Unchanged in v1.1. In v2 we may add filtering or chronological views that play well with system operations (e.g., "captures relevant to this open question").

### Mobile
Mobile remains the intake valve. No changes to mobile in this reframe. Eventually the mobile project view might show the cached `system_state` as a read-only summary, but that's a deliberate separate decision.

### Home dashboard
The "Active projects" stat could become more meaningful with a system-status concept later (in motion / stalled / shipped). Not in scope for the first build.

---

## Build Sequence (Provisional)

This is a sketch, not a locked plan. A real build plan would follow once the design space is settled.

### Wave 1 — The minimum that makes Ki feel categorically different

1. **Migration — system_state** — add `system_state jsonb` and `system_state_at timestamptz` to `pursuits`. (Migration number determined at execution time — follows the pursuit rename migration.)
2. **`Artifact` union extension** — add `state_snapshot` kind to the existing artifacts plan's discriminated union.
3. **`StateSnapshotRenderer`** — a new renderer in `apps/web/src/components/artifacts/StateSnapshot.tsx`. Renders the structured fields (current focus, decisions, questions, etc.) as a readable layout. Editable per-section.
4. **`synthesize-state` Edge Function** — reads memory + project context + corpus, returns a `state_snapshot` artifact. Called explicitly via a "refresh state" button in the workspace; called automatically when a project is opened with no cached state.
5. **Workspace default view** — when a project is opened and `system_state` is non-null, the surface loads with the cached state as a `state_snapshot` artifact. The user can clear it to start a new artifact, or iterate on it via chat.
6. **`pursuit-agent` prompt update** — frame the agent as a system operator. Add awareness of the current `system_state` to the agent's context.
7. **Project creation copy** — verb-phrase suggestion at the name field.

This wave alone is enough to make Ki feel like a different category of tool. State is visible. The agent is operating. The user reacts to state instead of bootstrapping every session.

### Wave 2 — The rest of the categorical operations as artifact kinds

8. `decision_log` artifact + renderer + invocation path.
9. `next_moves` artifact + renderer + invocation path.
10. `context_handoff` artifact + renderer + invocation path.
11. Auto-refresh of `system_state` after N new captures arrive in a project.

### Wave 3 — Cross-time operations

12. `drift_report` and `pattern_report` artifacts.
13. `evolution_trace` artifact.
14. Proactive surfacing — the agent notices drift or stalled questions and brings them up unprompted.

The artifacts plan ships first (v1 kinds + the substrate). Wave 1 above immediately follows it and uses the substrate to ship `state_snapshot`. Waves 2 and 3 add the rest as time and feedback warrant.

---

## Relationship to the Artifacts Plan

The artifacts plan is the **substrate**: the polymorphic surface, the renderer registry, the agent contract for emitting typed artifacts.

This plan is the **operating layer**: what gets done with that substrate to make Ki operate the systems users are running.

Specifically:

- The `Artifact` discriminated union in `packages/types/src/app.ts` extends with system-shaped kinds (`state_snapshot`, `decision_log`, `next_moves`, etc.). No structural change.
- The `ARTIFACT_RENDERERS` registry adds entries. No structural change.
- The `pursuit-agent` Edge Function expands its tool surface and prompt. No new endpoints.
- The `synthesize-state` Edge Function is new — separate from `pursuit-agent` because it runs on demand without a chat message in the loop.
- The `system_state` field on `projects` is new persistent state — distinct from artifacts in `project_artifacts`, because it represents the project's *current* shape rather than a saved output.

The artifacts plan should ship as planned. This plan rides on top of it. Nothing in this document requires the artifacts plan to change retroactively.

---

## Open Questions

These are real uncertainties — not deferrals. They need calls before this becomes a build plan.

### Q1 — Is `system_state` stored as one JSONB blob or normalized into tables?
JSONB is simpler and matches the artifact-data pattern. Normalized tables would let us query individual decisions, questions, etc. across projects. v1.1 should probably go with JSONB for speed; revisit if cross-project querying becomes important.

### Q2 — What's the refresh trigger for `system_state`?
Manual refresh button is required. Auto-refresh on N new captures is appealing but has cost (a Sonnet call per refresh). Possible policy: auto-refresh if 5+ new captures since last generation AND it's been >24h since the user last opened the project. Decide after watching real usage.

### Q3 — Does the user edit `system_state` directly or only through the agent?
Probably both. The renderer makes each section editable (just like prose is editable). The user's edits persist in the cached state. The next agent-driven refresh respects user edits where possible (e.g., a manually pinned open question stays pinned).

### Q4 — How does `state_snapshot` differ from a regular artifact in storage?
Two options:
- (a) Store it on `projects.system_state` only; it doesn't go into `project_artifacts`.
- (b) Store it in both — `projects.system_state` for the active cache, `project_artifacts` as historical snapshots over time.
Option (b) is interesting because a chronological history of state snapshots IS the evolution trace. Worth considering.

### Q5 — What does the agent's prompt actually look like for `synthesize-state`?
Different from pursuit-agent (conversational). Closer to enrich-capture (extraction). Probably uses tool calling to return structured `SystemState`. Needs drafting.

### Q6 — Does verb-phrase naming get enforced or only suggested?
Soft suggestion is right for now. If users actively resist it, the friction would damage the friction-free posture Ki holds. Let it remain a copy nudge.

### Q7 — When does `state_snapshot` first appear in a project?
Two options:
- (a) Generated automatically the first time a project has 3+ captures (matching the `generate-brief` threshold today).
- (b) Generated only on user invocation ("refresh state").
Option (a) is more magical — the user opens a young project and Ki has already started operating. Option (b) is more deliberate. Probably (a), with a small "Ki is sensing your project's state…" indicator on first generation so the user knows it's happening.

### Q8 — Does the workspace open with state in the surface, or does state live in its own zone?
Two designs were considered above:
- State *replaces* the empty surface as the default content.
- State lives in a *new top zone* above the existing three-zone layout.

The first is more elegant (no new zones). The second is more permanent (state never gets cleared by accident). My instinct is the first — state is just the default artifact, and clearing it isn't a big deal because it can always be regenerated. Worth a design pass before locking.

---

## The Design Principle to Hold

A project is not a topic. A project is a system the user is running.

Ki's job is to operate that system with them — to read its history, surface its current state, notice its drift, propose its next move. Everything Ki does should serve this. Anything Ki does that a session-with-Claude could do as well is borrowed time.

The corpus is what makes operation possible. The time dimension is what makes it categorical. The system shape is what gives the agent something concrete to work over. Together they are Ki.

We are building a system that builds systems. The thing we are building is an instance of the thing it builds. That is not a coincidence — it is the test. If we are not using Ki to build Ki, we have not built Ki yet.
