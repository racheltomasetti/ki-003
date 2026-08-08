# What Else Ki Could Be

*Captured: 2026-08-08. Source: a brainstorming conversation inside Ki itself, sparked by distilling [Shelby Sapp as a persona](../personas/shelby-sapp.md) — asking not just "what does Shelby need" but "what does anyone in pursuit of aliveness need."*

**Status: raw material, not a spec.** This is context for exploring what to build next, not a prioritized roadmap. That comes after we've sat with this and found the real problems underneath the ideas.

---

## Why this isn't a pivot

MISSION.md already says it: Ki is named for life force, "the energy within all of us that makes us feel most alive." It exists for "those in pursuit" of the life they desire. The brainstorm's framing — *aliveness, flow, experiencing life to the fullest* — is that same thread spoken plainly, not a new direction. Everything below should be read as *more concrete expressions of the existing mission*, not competing ideas for a new one.

The other throughline worth naming up front, from Shelby's own guide: **we are the gatekeeper, not the salesperson.** Nobody should have to be convinced to try Ki. The bar for everything below is whether it's a no-brainer the moment someone understands it — not whether it's clever.

---

## Reality check — what's already built

Before treating any of this as new territory, here's what already exists in the codebase that the brainstorm touches directly. Skipping this would mean re-deciding things that are already decided, or re-building things that already exist.

| Brainstorm idea | Current state |
|---|---|
| Thought → Todo list | `todos` table + service + `/todos` page already live. `source: 'manual' \| 'agent'` is already in the schema — agent-created todos were anticipated, just never wired to a capture pipeline. [packages/services/src/todos.ts](../../packages/services/src/todos.ts) |
| Cycle correlation | Menstrual cycle tracking is deep and live — `period_logs`, `daily_logs`, rolling averages, `cycle_day` stamped on every enrichment, phases derived at runtime. [docs/active/cycle-tracker.md](../active/cycle-tracker.md) |
| Coach agent / Project manager agent | `pursuit-agent` edge function already exists — Sonnet-backed, full pursuit corpus + memory document + conversation history as context. This is the substrate any new "agent persona" would be a prompt variant of, not a new system. |
| Affirmation / identity reflection | `memory-agent` edge function already exists, updates the living `memory_document`. This is the natural home for "notices what you keep claiming about yourself." |
| Weekly review / thought → content | No pipeline exists yet. This is genuinely new. |
| Home page | Mostly stub today — stats hardcoded, quick capture not wired, recent activity is placeholder. The "home page rebuilt" section below is describing what should replace a stub, not redesigning something that works. |
| Ki Connection (two-person resonance) | Does not exist anywhere in the current data model. Multi-user corpus matching is a genuinely new entity, not a variant of anything built. |

---

## The brainstorm, organized

### Capture → Output Pipelines
*Messy thought in, structured artifact out.*

- **Thought → Todo list** — captures parsed for action items, surfaced as a prioritized list. *(Infra exists — needs the parsing pipeline, not new schema.)*
- **Thought → Daily plan** — morning capture becomes a structured day
- **Thought → Weekly review** — Ki reads the week's captures, generates what was worked on, what shifted, what's unresolved
- **Thought → Content** — raw idea in, caption/post/thread/script out. *Shelby's exact use case.*
- **Thought → Decision** — you're circling something, Ki surfaces the tension and asks the one question that cuts through it
- **Thought → Email/message** — brain dump the context, Ki drafts the communication
- **Thought → Guide or framework** — enough captures on a topic, Ki distills a structured, shareable/sellable document
- **Thought → Affirmation or identity statement** — Ki notices what you keep claiming about yourself, reflects it back. *(Natural fit for `memory-agent`.)*
- **Thought → Hypothesis** — for self-experimentation: an observation becomes a testable hypothesis with a simple protocol

### Pattern Surfacing
*What Ki notices without being asked.*

- **Motif hunter** — names the word, tension, or idea you keep circling
- **Energy map** — when are you most alive across captures? What topics/times/contexts correlate with high-energy language?
- **Friction finder** — what keeps showing up as resistance, unnamed?
- **Evolution arc** — what you thought in April vs. now, made visible
- **Contradiction detector** — flags captures in tension with each other
- **Recurrence alert** — "you've captured something like this seven times" — a curiosity trying to become a pursuit. *(This is PURSUIT_MODEL.md's promotion-reflection mechanic, already specced: "If a curiosity's name or themes keep appearing... Ki may surface: is it ready to become a pursuit?")*
- **Cycle correlation** — themes/energy/emotional state correlated against cycle phase over time. *(Infra exists, correlation surfacing does not yet.)*

### Micro Tools
*Standalone, simple, immediately useful.*

- Voice memo → structured note (transcript cleaned + organized)
- Brain dump timer — five minutes, talk freely, Ki organizes what came out
- Pre-session primer — before a meeting/call/creative session, a one-paragraph briefing from relevant captures
- Post-session debrief — raw download after a call, Ki extracts insights/follow-ups/what shifted
- Idea incubator — capture an idea, Ki asks three questions that develop it, outputs an expanded brief
- **Limiting belief rewriter** — *Shelby's exact exercise.* Name the belief, Ki surfaces counter-evidence from your own corpus
- Wins log — Ki auto-flags captures with evidence of progress/growth/execution, builds a running proof record
- Question bank — tracks every question asked or emerged, surfaces when relevant
- Intention setter — morning ritual: what matters today, Ki holds it, checks back end of day
- Reflection prompt engine — prompts generated from your actual corpus, not generic journal prompts

### Agents
*Specialized intelligences primed for specific jobs.*

- Project manager agent — tracks what you're building, surfaces blockers, keeps momentum visible. *(Prompt variant of `pursuit-agent`.)*
- Content agent — lives in your corpus, outputs monetizable content on demand
- Coach agent — primed with high-execution frameworks (Shelby's), grounded in your specific captures, not generic advice
- Cycle agent — where you are biologically, correlated with captures, what that means for today
- Onboarding agent — guides a new user through their first session, builds their memory document, identifies their first pursuit
- **Connection agent** — facilitates a Ki Connection session between two people, finds resonance between corpora. *(Net-new entity — see Open Questions.)*
- Accountability agent — checks in on follow-through. Not punitive. Witnessing.

### Artifacts to Create
*Outputs that live beyond the conversation: todo list, daily plan, weekly review, content piece, framework/guide, decision brief, hypothesis protocol, wins record, identity statement, pursuit brief, meeting debrief, project roadmap, Ki Connection onboarding document.*

### The Home Page Rebuilt

Current home page is a stub — stats hardcoded, quick capture unwired, recent activity placeholder. What it could show instead:

- What's moving through you right now — recent captures, themes Ki is noticing
- What's unresolved — recurring questions, unnamed tensions
- What needs action — todos surfaced from captures
- Where you are — cycle phase if tracked, recent energy level
- One prompt — Ki asks you one thing based on everything it currently knows

*A home page alive enough that opening it becomes the habit, not a chore.*

---

## The throughline

Every item above is a different door into the same loop: **capture → enrich → surface → act.** Nothing here requires a new core loop — it's the existing loop wearing different clothes depending on who's walking through the door and what they need right now. Shelby needs the content pipeline and wins log. You need the project manager and cycle correlation. Someone else needs the coach agent and daily plan. Same system, different entry points — which means the sequencing question isn't "which system to build" but "which door to open first."

---

## Open questions / tensions worth deciding on purpose

1. **"One prompt" on the home page vs. where chat actually lives today.** As built, chat is pursuit-scoped only — `pursuit-agent` + `pursuit_conversations`, live inside the pursuit workspace. There's no top-level Chat nav item and no global chat route. (Note: `CLAUDE.md`'s Web Folder Structure section still lists a global `chat/` route as "not pursuit-scoped" — that's stale relative to what's actually built and worth updating separately.) A single Ki-generated prompt on Home isn't full chat, but it's adjacent enough to the current pursuit-scoped-only pattern that it's worth deciding deliberately: is this a question with no reply box (pure reflection), or does answering it open a conversation? If the latter, where does that conversation go?
2. **How many "agents" are actually agents.** Coach, content, project manager, cycle, accountability — are these genuinely different system prompts/context assemblies over the *same* `pursuit-agent`/`memory-agent` substrate, or does any of them need materially different tool access / data shape? Worth checking before treating this as 5-7 build items instead of 1-2.
3. **Ki Connection is a new entity, not a variant.** Two-person corpus resonance touches auth, RLS, consent, and privacy in ways nothing else here does — someone else's corpus becoming context for your session is a different trust model than anything currently in PURSUIT_MODEL.md. If this is a real direction, it deserves its own spec pass before any code, not a bullet in an agents list.
4. **Self-authored frameworks (the 4 B's problem).** Several tools here (reflection prompts, pattern surfacing, wins log) work best when tuned to a taxonomy the *user* defines for themselves, not one Ki hardcodes — this was flagged in the Shelby persona doc too. Worth deciding whether V1 of any of these hardcodes categories or builds toward user-defined ones from the start.

---

## The lens for prioritizing (from this brainstorm, in your own words)

Not applying it yet — just naming the filter so it's explicit when we do:

- **Real problem, not a clever feature.** What's the specific moment of friction this removes?
- **Simple solution.** No-brainer, not a new habit to maintain.
- **Begging to try, not being sold.** If it needs to be explained before it's obviously valuable, it's not ready.
- **Already-paid tax.** The strongest candidates are the ones where the user is already doing this by hand (see: Shelby manually reconstructing testimonials from memory, you manually cross-referencing energy and cycle). Ki's job is removing that tax, not inventing a new one.

---

## Next

Sit with this, find where the real friction is (yours, Shelby's, whoever else), and narrow to a first door. Then spec that one properly before touching code.
