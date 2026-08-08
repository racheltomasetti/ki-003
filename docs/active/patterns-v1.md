# Patterns View — v1 Hardening

*Status: Active spec. Extends `docs/active/cycle-tracker.md` Phase C.*
*v0 shipped: Aug 2026 (commit `629516a`). This doc: what's next, not yet started.*

---

## What v0 Is

`/patterns` (`apps/web/src/app/(app)/patterns/page.tsx`) fetches up to 500 captures, up to 90 daily logs, and all period logs client-side, then `usePatternsData` (`apps/web/src/hooks/usePatternsData.ts`) aggregates in a `useMemo`:

- **Gate**: cycle opted in → period logged → ≥5 stamped captures + ≥1 recurring label. Honest empty states at each stage, not a blank page.
- **Energy by phase** — stacked high/med/low bars from `enrichments.energy_level`, bucketed by phase.
- **What keeps coming up** — `mood_tags` + `themes` merged, lowercased, counted per `(phase, label)`, threshold ≥2 occurrences.
- **From your daily check-ins** — same shape from `daily_logs.emotions`/`body_signals`. Almost always empty — nothing in the app writes to `daily_logs` yet (see the voice check-in backlog item in `.claude/CLAUDE.md`).

No AI, no SQL aggregator, no drill-down, no day-level view. Agents (`chat-with-ki`/`pursuit-agent`) don't see any of this — they still only get RAG top-N + ambient today's day/phase.

This is useful scaffolding. It is not yet *"you've captured this doubt three times — always late luteal"* as a lived interface — it's the count, not the recognition.

---

## What's Working

- Correct architecture split: Postgres stamps `cycle_day` → utils derive phase → UI tallies. Nothing new stored, everything derived, consistent with the whole cycle layer's design principle.
- Honest empty states — doesn't fake a pattern that isn't there.
- Shared phase vocabulary/styling with Explore (`@/lib/enrichmentStyles`).
- Conservative recurrence threshold (2×) so noise doesn't read as insight.

## What's Weak or Missing

1. **It counts words, it doesn't surface patterns.** `mood_tags`/`themes` are free-text bags; synonyms fragment (`anxious` / `anxiety` / `on edge` count separately). No sentiment, no `capture_intent`, no "this cluster is resistance / doubt / ambition" — frequency ≠ recognition.
2. **No drill-down.** A card says "anxious · 3× · Release" — there's no way to open those three captures, see their actual days, or ask Ki about that specific set. The payoff of a pattern is the evidence, not the count.
3. **Phase-level, not day-level.** The spec asks for sentiment/energy/intent mapped against cycle *day*, with logged overlays. v0 only has phase buckets — day 24 and day 18 both collapse into "Release." The sharp claim ("always late luteal") dies at this resolution.
4. **Daily-log section is a dead wing.** Nothing writes `daily_logs`, so it stays empty indefinitely with no path to filling — and separately, the section ignores `daily_logs.energy_level` (1–5) entirely even when present, since `EnergyByPhase` only reads the categorical `enrichments.energy_level`. Two energy models, neither reconciled.
5. **Agents and Patterns don't share a brain.** Chat narrates from RAG top-N; Patterns computes full-corpus tallies in a React hook. Neither feeds the other — Explore's "what patterns do you see?" and `/patterns` can disagree, and any future artifact recipe can't ground on "the luteal doubt cluster" as a first-class object.
6. **Passive.** No filters (phase, date range, pursuit), no "this cycle vs. last 3," no CTA into chat or artifacts. A dashboard to glance at, not a laboratory to use.
7. **Scale & single-source-of-truth.** Client-side 500-capture cap, no tests, phase-derivation logic duplicated into both Deno edge functions (necessary today — they can't import `packages/utils` — but a second duplication site if this moves server-side later).

---

## How to Push It (ordered by leverage, not by ease)

### A. Make a pattern a first-class object (highest leverage)

Elevate from `{ phase, label, count }` to something the UI and, eventually, agents can act on:

```ts
interface SurfacedPattern {
  kind: 'theme' | 'mood' | 'sentiment' | 'intent' | 'emotion' | 'body_signal'
  label: string
  phase: CyclePhase
  cycle_days: number[]      // actual days, not just phase
  count: number
  capture_ids: string[]     // drill-down + grounding — the actual unlock
}
```

`capture_ids` is nearly free — `usePatternsData` already walks every capture to build the counts; it just discards the IDs today. This is the one change that unblocks both drill-down (weakness 2) and any future chat/artifact grounding (E below). Skip a `strength`/lift-vs-baseline field for now — it needs a real definition of "baseline" (per-phase capture volume? historical average?) that hasn't been designed; add it once that's real, not speculatively.

### B. A day-level view, not only phase-level

One additional view: cycle day 1…N on the X axis, capture energy/sentiment/intent density as the series, logged energy overlaid when `daily_logs` has data. Phase cards stay as the summary; the day chart is the proof. Sequence *after* C (below) — a noisy, unnormalized day-level chart can read as a regression next to the cleaner phase cards.

### C. Stop merging label bags

Split themes / mood / sentiment / intent into distinct sections (or tabs) instead of one merged pile — `SurfacedPattern.kind` in (A) already carries this distinction, so it's largely free once A ships. Light label normalization (a synonym/taxonomy map) can come later — don't block on NLP.

### D. Daily-log section: wire it or hide it, not both-neither

Wiring it means shipping the voice check-in — which is a separate, still-undecided backlog item (the enrichment-profile shape for a check-in capture isn't settled). Until that's resolved, lean toward **hiding** the section rather than showing a permanently-empty peer section — an honest absence is better than a dead wing. When the check-in ships: overlay logged `energy_level` on the day chart (B), keep emotion/body-signal recurrence as a second band.

### E. Close the loop with chat + artifacts — two different costs

- **Cheap, doable soon:** pre-bind a pattern's `capture_ids` into a `chat-with-ki` message ("Ask Ki about this") — the edge function already accepts context; this is a UI affordance passing IDs through, no new backend contract.
- **Blocked:** recipe tools that take a `SurfacedPattern` as input (e.g. "turn this into a release meditation") depend on the artifacts pipeline existing first — see the separate reconciliation pass on `.claude/ARTIFACTS_BUILD_PLAN.md` (that plan's v1 — tool calling, kind registry — isn't built yet; recipes are a layer on top of it).

### F. Move aggregation to Postgres — when it hurts, not before

A shared RPC (`/patterns` + both edge functions) over the full corpus, not a 500-row client fetch, not duplicated Deno logic. Do this once (A) and (E) need a stable server-side object to share — not as a preemptive optimization. Already noted in `.claude/CLAUDE.md`'s Backlog, gated on the enrichment pipeline stabilizing first (same reasoning applies here: one query to update instead of three codebases).

---

## Product North Star for This Surface

The page should answer three questions in one glance, then invite action:

1. **Where does my energy actually go across the cycle?** (day + phase)
2. **What thinking recurs, and when?** (clusters with evidence)
3. **What should I do with that?** (chat / artifact — not another chart)

v0 has a soft version of (1) and (2). (3) doesn't exist yet. That's the gap between "dashboard" and "Ki."

---

## Suggested Near-Term Slice

Don't rebuild terra-001's `EnergyGraph` yet. Ship the spine:

1. `SurfacedPattern` objects carrying `capture_ids` (A)
2. Click a card → evidence drawer (the actual captures)
3. "Ask Ki about this" with those IDs bound (E, cheap half only)
4. One day-level energy or sentiment strip (B)
5. Hide the daily-logs section until it's wired (D)

That's enough for the eventual artifact conversation to be grounded in something real: a recipe consumes a pattern, not a vibe.

---

## Open Sequencing Question

This work and the `.claude/ARTIFACTS_BUILD_PLAN.md` reconciliation pass are both queued. Not yet decided which comes first, or whether they interleave — revisit before starting either.
