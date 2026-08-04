# CYCLE — The Body Layer

*Status: Active spec. Extends MISSION.md and PURSUIT_MODEL.md.*
*Decided: July 31, 2026*

---

## What This Is

Cycle tracking inside Ki — not as a standalone feature, but as a layer that runs under everything already being captured.

The insight that makes this powerful: mapping what a user captures — thoughts, energy, emotional state, inspiration, resistance — against where they are in their cycle. That correlation is the feature no other tool has. It lives inside Ki, not beside it.

The mind spans everything. Thoughts, energy, emotions, the body, the cycle. All of it is data. All of it is connected.

---

## The Core Decision — Stamp the Day, Derive the Phase

Every enrichment is stamped with **`cycle_day`** — the same way `time_of_day_cat` is already derived from `captured_at`. Phases are **never stored**. They are derived at runtime from cycle day + the user's cycle length, and eventually from the user's own logged patterns.

Why the day and not the phase:

1. **Transition days are honest.** A capture made in the morning stamps as the last day of the old cycle. The user's period starts that evening; a capture after stamps as day 1. Both stamps are true. There is no conflict to resolve — the day was genuinely a threshold.
2. **Nothing stored goes stale.** Phase boundaries depend on cycle length, and later on what Ki learns about this specific person's patterns. If phases were stamped at write time, every improvement in understanding would leave stale labels behind. Derived at runtime, every capture's phase refines automatically as Ki knows the user better.
3. **The stamp is a cache, not a truth.** `period_logs` are the only source of truth. `cycle_day` is always recomputable from them. If a user backdates a period ("it actually started Tuesday"), the affected captures simply re-stamp. Re-stamping is pure date math — idempotent, cheap, no AI involved.

---

## Menstrual First — Start Specific, Then Scope Outward

This phase builds one cycle type: **menstrual**, derived from the user's own period logs. Not because it's the only cycle that matters — because starting specific and proven beats starting general and unproven. Women's menstrual cycle is the sharpest, most concrete version of "capture correlates with biological cycle." Prove that the correlation is real and valuable there first.

`profiles.cycle_type` : `'menstrual' | null` for now. Null means not opted in — captures stamp null, nothing else changes. Opting in later back-stamps the full corpus (it's just date math). The type is written to widen, not to be reworked: `compute_cycle_day()` and every consumer already branch on `cycle_type`, so adding a second value later is additive.

### Next: Lunar, then Universal Cyclic Living

Once menstrual cycle tracking is working and the correlation is proven, the next cycle type is **lunar** — derived from the sky, ~29.5 days, anchored at the new moon, zero logging, zero setup. It's the natural universal fallback: for anyone who doesn't menstruate, doesn't want to track, or just wants a rhythm to move with. Same stamp, same queries, same correlation views, same agent context — `cycle_day` already means "day of your cycle" regardless of which cycle it is.

Beyond that: Ki as a tool built around **cyclic living** generally — not just two cycle types, but the design principle that a mind (and a life) moves in rhythms, and a tool that understands where you are in yours can meet you there. Starting with women and the menstrual cycle and scoping outward from a proven, specific case to that universal principle is the intended arc — not the other way around.

---

## Data Model (migration 017_cycle.sql)

**profiles** — add:
- `cycle_type` text — `'menstrual' | null`
- `average_cycle_length` int — seeded at onboarding, updated as real cycles complete (rolling average)
- `average_period_length` int — seeded at onboarding

**period_logs** — one row per bleeding day. The immutable source of truth.
- `id`, `user_id`, `date` (date, `UNIQUE(user_id, date)`), `created_at`
- Insert and delete only — never update. Cycles are **derived**, not stored: consecutive bleeding days cluster into a period; the first day of a cluster is a cycle start. (Port of terra-001's `rebuildCyclesFromPeriodLogs` / `clusterDates` logic.)
- Onboarding writes the first row: the reported last-period start date. Stamping works from minute one.

**daily_logs** — one structured check-in per day. The logged (vs. inferred) body signal.
- `id`, `user_id`, `log_date` (date, `UNIQUE(user_id, log_date)`)
- `energy_level` int 1–5 (nullable)
- `emotions` text[] — from the taxonomy below
- `body_signals` text[] — from the taxonomy below
- At least one field must be filled to save. Available to all users regardless of `cycle_type`.

**enrichments** — add:
- `cycle_day` int (nullable)
- `cycle_start_date` date (nullable) — which cycle instance this belongs to; makes re-stamp checks and per-cycle grouping trivial

RLS on every new table, per house rules.

---

## Stamping Mechanics

Stamping is **pure Postgres** — no AI, no app code:

- **On enrichment row creation** (the existing `create_pending_enrichment` trigger path): stamp `cycle_day` + `cycle_start_date` from `captured_at` — latest cycle start ≤ `captured_at` (a period_log date with no log on the previous day). `cycle_day` = days between + 1. No period logs yet → null.
- **On period_logs insert/delete:** re-stamp the user's affected enrichments. A single UPDATE with date math — cheap enough to re-stamp the user's whole corpus if simpler than computing the window.
- **Rules:** the app never writes cycle stamps. Claude never writes cycle stamps. Postgres does. (Mirrors `time_of_day_cat`: derived, never from the model.)

Rejected alternative: stamping inside the `enrich-capture` edge function. It would work for the initial stamp, but backdate re-stamps would then need edge-function invocations. Keeping stamp + re-stamp in SQL keeps one mechanism in one place.

---

## Phase Derivation (runtime, `packages/utils`)

Port terra-001's `phaseUtils.ts` + `cycleUtils.ts` — pure functions, zero app dependencies.

- **4-phase resolution** (menstruation / follicular / ovulation / luteal) from `cycle_day` + `average_cycle_length` + `average_period_length`. Ovulation estimated at length − 14; fertile window ~3 days before to 1 day after.
- Returns `{ phase, label, day, length }`, where `phase` is an abstracted vocabulary — rest / build / peak / release — rather than the clinical term. Reads better in Ki's voice, and is the vocabulary lunar phases will map onto when that phase starts, so nothing here needs rework later — just a second branch.

**v2 — personalized phases:** boundaries adjusted from the user's own accumulated data (logged body signals, energy patterns across completed cycles) rather than population averages. This is why phases are never stored: when this lands, every capture's phase everywhere refines instantly.

---

## Build Order

**Phase A — the data layer.** Migration 017, utils port, SQL stamping. Ship before any UI — correlation data compounds silently from the day this lands, and every week of delay is a week of uncorrelated captures. Back-stamp the existing corpus once period data exists.

**Phase B — input.**
- **Onboarding is a new `/onboarding` route — ki-003's first true first-run flow.** Today, sign-up drops straight into the app with no sequence at all. This is the natural home for "connect to your cycle" (last period start, avg cycle length, avg period length / skip), and — since it's being built anyway — the place to finally give new users a first pursuit + core question prompt and a first capture, rather than an empty Home. Full flow design happens when Phase B starts, not before.
- Period logging: start / ended, with backdating. (terra-001's onboarding + logging flows are the reference; its period-ended edge cases are already solved there.)
- Daily log widget on Home: energy, emotions, body signals — 30 seconds, once a day.
- Sidebar indicator: cycle day + derived phase.

**Phase C — the correlation. This is the feature.**
- Corpus table: `cycle_day` / derived-phase column + filter (it's just another enrichment field — LibraryClient and Explore already know this pattern).
- `chat-with-ki` + `pursuit-agent` context: current cycle day/phase + recent daily logs join the memory document. Ki can now say *"you've captured this doubt three times — always late luteal."* That sentence is the product.
- Patterns view: captured sentiment / energy / intent mapped against cycle day, overlaid with logged energy and body signals. terra-001's EnergyGraph and EmotionMap, finally fed real correlated data instead of mocks.

---

## Taxonomies (from terra-001, verbatim — they're well-curated)

**Emotions — 5 categories:**
- *Calm:* Peaceful, Content, Grounded, Grateful, Reflective, Present
- *Bright:* Joyful, Playful, Curious, Outgoing, Radiant, Zesty
- *Driven:* Ambitious, Sharp, Decisive, Confident, Motivated, Focused
- *Tender:* Vulnerable, Raw, Loving, Sensitive, Sad, Melancholy
- *Overwhelmed:* Anxious, Irritable, Stressed, Scattered, Reactive, On Edge

**Body signals — 5 categories:**
- *Sleep:* Well rested, Vivid dreams, Tired, Insomnia, Restless, Woke early, Hard to wake
- *Head & Senses:* Headache, Migraine, Brain fog, Clear-headed, Light sensitivity, Dizziness, Forgetful
- *Skin & Face:* Skin breakout, Puffy, Clear skin, Dry skin, Oily skin, Glowing
- *Body:* Achy, Tight, Breast tenderness, Heavy, Strong, Back pain, High libido, Low libido
- *Digestion:* Bloated, Nauseous, Cramps, Constipated, Loose stools, Low appetite, Cravings

---

## Explicitly Not Building Now

- Lunar cycle type, and cyclic living beyond menstrual/lunar — see "Next: Lunar, then Universal Cyclic Living" above. Deliberately sequenced after menstrual is proven, not built alongside it.
- Oura / wearables — phase 2. terra v1's service layer (`ouraApi` / `ouraAuth` / `ouraSync`) exists and ports cleanly when the time comes; temperature data would also power personalized ovulation detection.
- Nutrition, fitness, meal planning — terra v1 proved this is a different product.
- Affirmations, predictions, notifications.
- A standalone cycle surface. The cycle has no home page — it lives inside the corpus, the chat, the sidebar. That is the point.

## Open Questions

- Do daily_logs also flow through the enrichment pipeline as captures? Current answer: no — they are structured data, not thoughts. A user who wants to say more voice-captures it, and that capture stamps with the same cycle day. Revisit if the boundary feels wrong in use.
- Lunar anchor, once that phase starts: new moon = day 1 is the natural default. Worth allowing a custom anchor (e.g., full moon start)? Defer until someone asks.
- When mobile revives, period logging + daily log must be there day one — the body doesn't wait for a laptop.
