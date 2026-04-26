# Ki — Explore Surface
## What It Is, What to Build
*Draft — April 2026*

---

## The Core Idea

The Library is a feed — everything you've captured, in order. The Canvas is a workspace — you sit down, open a project, and think through it with intention.

Explore is neither of those. Explore is what happens when you step back and ask: **what does all of this say about me?**

It is a pattern surface. A mirror. The place where accumulated thinking becomes self-knowledge.

The user doesn't come to Explore to look at a specific thought or build a specific diagram. They come to Explore to see the shape of their mind over time — what they keep returning to, what lights them up, when they're in flow and when they're in friction, how their energy, focus, and mood track against what they were building. The question Explore answers is not "what did I capture?" but "what does the pattern of my capturing tell me?"

---

## The Opportunity Space

### Thought Patterns
- What themes recur across captures? Which are growing, fading, or constant?
- What capture intents dominate? (Ideas? Questions? Observations? Processing?)
- When do you have your best ideas? Morning? Late night? After exercise?
- What sentiment runs through your corpus? Are you building from excitement or grinding through friction?
- Which projects are generating the most active thinking? Which are going quiet?

### Biometric Correlations
Ki's enrichment pipeline already tags `time_of_day_cat`, `energy_level`, `sentiment`, and `mood_tags`. The next layer is linking these to physiological signals to answer questions like:

- **Oura Ring**: Sleep quality → idea density the following day. HRV → creative output. Recovery score → the type of thinking you do (generative vs. analytical).
- **Menstrual cycle tracking** (Clue, Apple Health): Cycle phase → thinking style. Many people report distinct cognitive patterns across phases — more strategic and connective in the follicular phase, more detail-oriented and risk-averse in the luteal phase. Ki can surface this with real data, not generalities.
- **Apple Health / other wearables**: Activity, heart rate, stress markers — the body's context for the mind's output.

The thesis: **your thinking is not random.** There are biological, environmental, and temporal rhythms underneath it. Explore makes those visible.

### Longitudinal Views
- Streak / capture volume over time (calendar heatmap or timeline)
- Energy and mood over weeks and months
- Theme evolution — a theme appears, grows, then fades or becomes a project
- Question density — how many unresolved questions are in your corpus right now?

---

## Design Principles

**No noise.** Every view must answer a legible question. Not a dashboard of charts — a sequence of insights. "You've been thinking about X a lot lately." "Your best captures happen on Tuesday mornings." "Your energy has been low the past two weeks — here's what you were working on."

**Grounded in corpus.** Like everything in Ki, nothing here is fabricated. Every insight is derivable from real captures and real data the user has given Ki. If the inference is speculative, it's labeled as such.

**Personal, not comparative.** There are no benchmarks against other users. This is not about productivity. It is about self-understanding. The framing is always "you vs. you over time."

**Opt-in integrations.** Biometric data is deeply personal. Every integration is explicitly opted into. Data pulled from Oura/Apple Health/cycle trackers is used only for pattern analysis within Ki — never stored raw, never shared.

---

## Data Available Now (Phase 1)

Everything the enrichment pipeline already extracts is ready to visualize:

| Field | Lives In | What it tells us |
|---|---|---|
| `sentiment` | enrichments | Positive / neutral / negative / mixed |
| `energy_level` | enrichments | Low / medium / high |
| `capture_intent` | enrichments | Idea / question / reflection / observation / gratitude / processing |
| `mood_tags` | enrichments | Free-form mood descriptors |
| `themes` | enrichments | Topic clusters |
| `time_of_day_cat` | enrichments | Morning / afternoon / evening / night |
| `is_starred` | captures | Quality signal — which captures the user marked as significant |
| `captured_at` | captures | Temporal anchor — when the thinking happened |
| `type` | captures | Voice / text / file — capture mode correlates with context |

This is enough for a compelling v1 Explore without any new integrations.

---

## Proposed Build Sequence

### Phase A — Corpus Analytics (No Integrations)
Build entirely from existing enrichment data. No new schema.

1. **Capture volume heatmap** — GitHub-style calendar. How many captures per day over the past 90 days. Color intensity = volume. Immediate answer to "am I actively thinking?"

2. **Theme cloud / frequency chart** — Top themes across the corpus, sized by frequency and sortable by recency vs. all-time. Reveals obsessions and drift.

3. **Intent breakdown** — Pie or bar: what kind of thinking is dominant? Lots of questions = exploratory mode. Lots of ideas = generative mode. Lots of processing = working through something hard.

4. **Time-of-day heatmap** — When do captures happen? When are they starred? Find your peak thinking windows.

5. **Energy + sentiment over time** — Line chart across the past 30/90 days. Overlay these: when you're high energy and positive, what were you working on? When low?

6. **Top starred captures** — Surface the captures the user themselves flagged as significant. These are the signal in the noise.

**Checkpoint A:** User can visit Explore and see meaningful patterns from their existing corpus with zero new setup.

---

### Phase B — Biometric Integrations (Opt-In)

New schema: `integrations` table (user_id, provider, access_token_enc, scopes, connected_at) and `biometric_daily` table (user_id, date, source, sleep_score, hrv, recovery_score, resting_hr, cycle_phase, raw_json).

1. **Oura Ring** — OAuth flow. Pull sleep score, HRV, recovery score daily via Oura API.

2. **Apple Health export** — No OAuth possible. User exports XML from Health app, Ki parses it. Extract sleep, activity, heart rate.

3. **Menstrual cycle** — Manual cycle phase input (day 1 tracking) or Clue API (if they pursue a partnership). Map phase (menstrual, follicular, ovulatory, luteal) to capture date.

Overlay any of these signals onto the existing capture/enrichment timeline.

**Checkpoint B:** User with Oura can see whether high-HRV days correlate with high-energy-tagged captures. User with cycle tracking can see cognitive pattern shifts across their cycle.

---

### Phase C — AI-Generated Insights (Agent Layer)

Use the same Claude Sonnet infrastructure as chat-with-ki but scoped to Explore.

An `explore-insights` Edge Function that:
- Takes the user's enrichment corpus + biometric data (if connected)
- Returns 3-5 insight cards: natural language observations, grounded in data, with the supporting evidence
- Examples: "You've raised 47 questions in the past month. Only 3 appear in project captures — the rest are floating. Want to route them?" / "Your capture volume drops sharply on days after poor sleep. Last Tuesday you had a recovery score of 42 and no captures."

These are not hallucinations. Every statement is verifiable against the user's actual data.

**Checkpoint C:** User visits Explore and sees AI-surfaced insights that feel personal, accurate, and surprising in a good way.

---

## What This Is NOT

- Not a journaling analytics tool (this is for builders, not diarists)
- Not a productivity tracker (no streaks as moral judgment, no "you captured less this week")
- Not a data dashboard (no vanity metrics, no numbers for their own sake)
- Not a replacement for self-reflection — a tool for enabling it

The north star: **a user opens Explore and learns something true about themselves that they didn't already know.**

---

## Open Questions

- Should Explore be a freestanding page or accessible from within a project context too? (Explore your thinking *on this project* specifically — timeline of when captures came in, energy when working on it, etc.)
- What is the right interaction model for the insight cards in Phase C — passive (they just appear) or conversational (user can ask follow-up questions)?
- Biometric data consent and storage: where does raw biometric data live? Supabase with encryption at rest, or a separate store? This is a regulatory and trust question worth deciding early.
- Cycle phase data is sensitive. How does Ki frame and store this in a way users trust?
