# Ki — Product Requirements Document

---

## What Ki Is

Ki is a thinking tool built specifically for builders and creators.

Not a notes app. Not a journal. Not a second brain for everyone. Ki is for people who already have ideas — who are already building something — and need a system that can keep up with the speed of their thinking, organize it without friction, and help them distill it into clarity they can act on.

**The core problem Ki solves:** Builders think faster than they can organize. Great ideas get lost, half-formed, or never connected to the other thoughts that would complete them. Ki captures everything, keeps it, enriches it, and gives you a workspace to think it through.

**The core thesis:** Ki only knows what you give it. No hallucination. When Ki tells you something about your thinking, it's because you said it, saved it, or chose it.

**The compounding effect:** A week of captures is a log. A month is a map of what you're building. A year is a window into how your thinking evolves. The more you feed Ki, the more useful it becomes — not just as storage, but as a thinking partner that actually knows you.

---

## Who Ki Is For

Builders. Creators. People who make things.

Someone who wakes up at 3am with a product idea and wants to capture it before it slips. Someone who's been toiling over the same problem for months and wants to see their thinking laid out spatially. Someone who needs to break a complex project down into its component pieces before they can build it.

Ki enables creation by enabling clarity. That is the product.

---

## The Two Surfaces

Mobile and web are not the same product on two screens. They are two different modes of relating to your thinking — used at different times, for different purposes, with the same underlying corpus.

**Mobile — the intake valve.**

Your phone is always with you. Mobile is where thought becomes capture. The experience is designed to be faster than hesitation: one tap, speak, done. V1 is voice-only. The friction is as close to zero as software can get.

After recording, you review the transcript, trim anything you don't want, assign it to a project, add tags, and save. The enrichment pipeline runs in the background. You never wait.

**Web — the laboratory.**

Where you sit down with purpose. You have a project you're working through. You open its canvas, see your captured thoughts as nodes, and start arranging, connecting, and distilling. The agent lives here — it reads your project's corpus and helps you synthesize your thinking into something you can build from.

The web surface is not a companion to mobile. It is where the value of everything captured on mobile is realized.

---

## The Capture Surface (Mobile, V1)

**Voice only in V1.** Speak a thought. Whisper transcribes it. Ki enriches it. Done.

This constraint is intentional. Voice is the most natural, fastest, most frictionless capture mode. Nailing voice completely before adding text or file capture means the intake valve actually works before the system gets more complex.

**The post-capture review flow:**
1. Recording stops → transcript appears
2. Edit / trim the transcript (remove filler, fix transcription errors)
3. Assign to project(s) — which project does this thought belong to?
4. Add tags — cross-cutting labels (optional)
5. Save → enrichment fires async

The review step is where the thought gets organized. It should feel fast and natural, not like a form to fill out.

---

## Organization: Projects + Tags

**Projects** are named collections you create intentionally. "Startup MVP", "Book I'm Writing", "Product Architecture". A capture can live in multiple projects. When you open a project's canvas on web, you see only the thoughts assigned to it.

**Tags** are freeform cross-cutting labels. "philosophy", "ux", "energy", "2026". They work inside and across projects. You can filter your canvas by tag. You can search by tag across your entire library.

Two different organizational tools. Projects = where does this thought live. Tags = what is this thought about. Both exist. Neither replaces the other.

---

## The Canvas (Web)

The canvas is the primary web surface. It is a node-based workspace — a mind map environment — where you think through a project by working with your captured thoughts spatially.

**What a canvas contains:**
- Nodes representing captures assigned to the project
- User-created connections between nodes (manual edges)
- Free-form annotations and synthesis nodes the user creates
- Agent-created content (diagrams, clusters, connection suggestions)

**How it works:**
1. Open a project → canvas loads with that project's captures as nodes
2. Arrange them spatially — cluster related thoughts, spread out competing ideas
3. Draw connections between thoughts you want to link
4. Filter by tag to isolate a subset of your thinking
5. Invoke the agent to help synthesize, suggest structure, or create diagrams

**The agent in the canvas:**
When you invoke the agent, it reads your project's captured thoughts (filtered by whatever tags or selection you've specified) and uses them as context. It can suggest how to organize your thinking, identify gaps, draw connections you missed, and create visual content in the canvas — flowcharts, outlines, clusters — populated with your actual captured thoughts.

The agent creates. The user curates. Everything the agent does is editable and deletable.

---

## The Knowledge Graph (Web, Phase 2)

Alongside project canvases, there is a global view: the knowledge graph. Auto-generated from semantic similarity across the entire corpus (pgvector embeddings are already computed on every capture). This is not a curated workspace — it's an emergent map of how your thinking actually connects.

You open the knowledge graph to see your entire mind laid out at once. Clusters form around recurring themes. Captures that are semantically close sit near each other. You can zoom in on a cluster, select a group of captures, and pull them into a project canvas to work with.

---

## The Enrichment Pipeline

Every capture, regardless of type, goes through the same pipeline:

```
Capture saved
→ Postgres webhook fires
→ enrich-capture Edge Function runs async
    → Claude Haiku: structured extraction (summary, themes, sentiment, mood,
      energy level, intent, questions, people, key quotes, entities)
    → OpenAI text-embedding-3-small: 1536-dim vector embedding
    → Write to enrichments table
    → Auto-set captures.title if blank
→ User never waits for any of this
```

**Personal profile** (voice and text captures): Haiku extracts the full set of personal fields. This is the user's thinking — enrich it deeply.

**Artifact profile** (file captures): Haiku extracts document-level fields + processes user_context (the significance note) separately.

`time_of_day_cat` is always derived from `captured_at` in the Edge Function — never from Claude.

---

## Chat with Ki

Available on both mobile (chat tab) and web. Conversational exploration of your corpus.

**Context architecture (fixed — never changes as corpus grows):**
- Layer 1: Memory document (~800 tokens, always included) — who this person is
- Layer 2: Top 10 captures via pgvector match_captures RPC (~2500 tokens) — weighted: starred first → semantic similarity → recency

**The no-hallucination rule:** Every response is grounded in captured content. If the answer isn't in the corpus, Ki says so. Citations are always returned alongside responses.

**Model:** Claude Sonnet. Future: model switcher (Haiku / Sonnet / Opus).

---

## The Memory Document

Every user has a living memory document stored on their profile (`profiles.memory_document`). This is always the first context passed to Claude in any Chat with Ki interaction.

Sections: who you are, what you're building, what you're processing, people in your world, your patterns, recurring themes, current chapter.

The user owns and edits this document. Each section is visible as a card on the Profile screen.

---

## Build Sequence

### Now — Nail the foundation
- Voice capture on mobile: working, needs to feel truly frictionless
- Chat with Ki: verify end-to-end (auth, RAG, response quality)
- Library: browse all captures, tap to see enrichment detail

### Next — Web surface begins
- Auth on web
- Library on web — browse and search the corpus in a browser
- Project detail view — list of captures in a project

### After — The canvas
- React Flow canvas per project
- Captures as draggable nodes
- Manual connections
- Tag filtering within canvas
- Agent invocation: reads project corpus, returns structured suggestions

### Later — Knowledge graph + agent creates
- Global semantic graph (pgvector similarity → edges above threshold)
- Agent creates nodes/diagrams inside canvas
- Memory update suggestions (Phase 1.5 from original plan)
- Biometric data overlay (Phase 3)

---

## Key Decisions — Locked

- **Voice-first on mobile, V1.** Text and file capture come after voice is solid.
- **Canvas lives on web.** Mobile is capture. Web is exploration and synthesis.
- **Projects + tags, both.** Projects for intentional collection. Tags for cross-cutting filtering. Neither replaces the other.
- **No hallucination.** Every Ki response cites real captures.
- **Raw is permanent.** Captures never altered after write.
- **For builders and creators.** Not a general tool. The focus is the product.
- **Embeddings from day one.** Already generating 1536-dim vectors on every capture.
- **The agent augments the canvas.** It does not replace the user. Everything it creates is editable.

---

## What Ki Is Not

- Not a productivity tool. No tasks, no to-dos, no projects in the GTD sense.
- Not a note-taking app. Notes are structured. Ki captures raw thinking.
- Not for everyone. It is for people who are already building something.
- Not a hallucination machine. If it's not in your corpus, Ki doesn't know it.
- Not finished. Ki grows with the builder using it.
