# Ki — Product Direction & Data Architecture
## The complete picture as of April 2026
*Pairs with ki_web_v2.html — the visual reference for what we are building*

---

## What Ki Actually Is

Ki is a personal intelligence system for builders. Not a journal. Not a note-taking app. Not an AI assistant. The tool that sits between your thinking and your execution tools — helping you say exactly what you mean before handing off to any agent.

The problem it solves: builders have great thinking that gets lost in the flow of execution. You get into the build, the epiphanies happen, the realizations stack up, and by the time you surface the details are gone. Ki solves this in two ways simultaneously:

**One** — it is the intermediary between you and the LLM. You think with Ki, Ki reads your corpus and helps you get precise, you take that precision to Claude Code, Cursor, a contractor, a collaborator, or any other tool.

**Two** — the output history becomes the documentary of your build. Every time you copy a context block, it is timestamped and saved automatically. No separate documentation effort. No friction. You were already using Ki. It was just watching and saving.

Six months from now you open the ki project and read the evolution. "March 3 — still figuring out the enrichment pipeline." "April 2 — realized web should be primary, mobile is the companion." That is the story of how you built Ki, told by the actual thinking you did in the process of building it.

---

## The Two Surfaces — Reframed

**Web is primary. Mobile is the companion.**

This is the most important reframe in the product. The deep work happens on your laptop. Ki is a tool for deep work — exploring your mind, distilling your thinking, crafting the precise context that unlocks fast execution. That is a seated, intentional experience that belongs on the web.

Mobile exists so that when you are in the car, the shower, walking, or away from your desk and something hits you — it goes straight into your corpus without friction. Everything mobile captures feeds the web experience. Mobile is the intake valve. Web is the laboratory.

Both surfaces are complete and usable on their own. But the web is the home base. Everything is designed around that.

---

## The Core Loop

```
Capture raw thinking on mobile (voice, text, file)
↓
Corpus accumulates in the project
↓
Sit down at the web interface
↓
Talk to Ki in the right chat panel
Ki reads your full corpus + memory document
↓
Context builder (top center) gets shaped through conversation
Ki references captures → they highlight in the left panel
↓
When the context block is precise and portable — copy it
↓
Paste into Claude Code, Cursor, or any agent
↓
Copy is saved automatically to output history
↓
Repeat — the history becomes the documentary of your thinking
```

---

## The Project Interface — Visual Reference: ki_web_v2.html

Every project has one workspace. The layout has three zones:

**Left panel — captures (collapsible)**
All captures tagged to this project. Browsable, searchable. When Ki references a capture in the chat, that capture highlights with a pulse glow animation. Referenced captures also appear as chips at the top of the context builder. The panel collapses to give more room to the context builder.

**Center — context builder (top) + output history (below)**
The context builder is a textarea at the top. This is where the context block lives — shaped through conversation with Ki, edited by the user, made precise and portable. Referenced capture chips appear above it showing what Ki drew from. Copy button is the primary action.

Below the context builder is the output history — a timestamped chronological record of every context block the user has copied. Each entry shows the timestamp, the content, and which captures it was grounded in. This is the Ki document. It grows automatically every time the user copies. No friction, no effort, no separate documentation task. The evolution of thinking documented by the act of using the tool.

**Right panel — Ki chat**
The conversation with Ki. Ki has the full project corpus, the project context fields, and the user's memory document. The user talks through what they are building and what they need. Ki helps distill. When Ki references captures in its responses, cite-chips appear that trigger the highlight in the left panel. Ki can suggest additions to the context builder that the user can accept with one click.

---

## What a Project Contains

```
Project
├── Context fields (set at creation, editable)
│   what            — what are you building or working on?
│   why             — why does this matter to you?
│   success_looks_like — what does done look like?
│   open_question   — biggest uncertainty right now
│   project_mode    — building | researching | figuring_out | creating
│
├── Captures
│   All voice, text, and file captures tagged to this project
│   The raw material — the invisible context layer
│
├── Output history (the Ki document)
│   Every context block the user has copied
│   Timestamped automatically
│   References which captures it drew from
│   Grows through use — no manual documentation
│
└── Project conversations
    The persistent chat history between user and Ki for this project
    Gives Ki memory across sessions
    Agent reads this alongside the corpus
```

---

## The Context Builder — How It Works

The context builder is not a document with sections. It is a live, editable textarea that gets shaped through conversation.

The user talks to Ki in the right panel. Ki reads the corpus and conversation. Ki helps the user identify what an agent on the receiving end would need to know. Through back and forth the context block gets tighter and more precise.

When Ki references captures in its response, those captures highlight in the left panel. The user can see exactly what their own thinking Ki is drawing from. No black box. Full transparency.

When Ki suggests an addition to the context block, it appears as an inline suggestion in the chat with an "add to context" button. One click adds it to the textarea. The user edits as needed.

When the block feels right — the user copies it. That copy:
- Goes to the clipboard, ready to paste anywhere
- Gets saved automatically to the output history with a timestamp
- Records which captures it was grounded in

The agent receiving this context has everything it needs. No clarifying questions. Fast execution.

---

## Database Schema — What Is Actually Needed

### What stays

**profiles** — unchanged. Includes `memory_document` and `memory_updated_at`. The memory document is the foundational context layer for all Ki calls.

**captures** — unchanged. The core corpus table. All capture types (voice, text, file) land here. Enrichment pipeline runs async on every insert.

**enrichments** — unchanged. Written by the pipeline only. Includes all extraction fields plus the vector embedding for semantic search.

**tags** and **capture_tags** — unchanged. Tags are how captures get organized into projects.

**canvas_nodes**, **canvas_edges**, **canvas_conversations** — schema in place, no active UI in current phase. Canvas is on the back burner.

**connections**, **joint_sessions**, **session_captures** — schema in place, Phase 4.

### What changes on projects

The `projects` table needs rework. The current monolithic `brief` / `ki` column is replaced by the context fields and the output history is moved to a dedicated table.

```sql
-- projects table — updated
alter table public.projects
  drop column if exists ki,
  drop column if exists ki_updated_at,
  drop column if exists brief,
  drop column if exists brief_generated_at,
  drop column if exists who_for;

-- Keep: id, user_id, name, description, color, created_at
-- Add context fields (all nullable — none are required at creation)
alter table public.projects
  add column if not exists what               text,
  add column if not exists why                text,
  add column if not exists success_looks_like text,
  add column if not exists open_question      text,
  add column if not exists project_mode       text
    check (project_mode in ('building','researching','figuring_out','creating'));
```

### What replaces ki_sections and the brief

The living document is not sections. It is the output history — a chronological record of every context block copied.

```sql
-- context_outputs — replaces ki_sections entirely
create table public.context_outputs (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  content     text not null,           -- the full context block text
  capture_ids uuid[],                  -- which captures this drew from
  copied_at   timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index context_outputs_project_idx on public.context_outputs(project_id, copied_at desc);

alter table public.context_outputs enable row level security;
create policy "Users manage their own context outputs"
  on public.context_outputs for all
  using (auth.uid() = user_id);
```

### What replaces project_conversations

This stays but is renamed for clarity:

```sql
-- project_conversations — keeps as is, rename optional
-- id, project_id, user_id, role, content, created_at
-- Persistent Ki chat history per project
-- Agent reads this alongside corpus for continuity across sessions
```

### What replaces project_artifacts

Artifacts (Mermaid diagrams, generated documents) are a future phase. The table exists but is not a primary surface right now. Keep the schema, no active UI.

### The capture_projects junction — needed

Captures belong to projects through a many-to-many relationship. A capture can belong to multiple projects. This table is required:

```sql
-- capture_projects junction
create table public.capture_projects (
  capture_id  uuid not null references public.captures(id) on delete cascade,
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  primary key (capture_id, project_id)
);

alter table public.capture_projects enable row level security;
create policy "Users manage their own capture_projects"
  on public.capture_projects for all
  using (auth.uid() = user_id);
```

### Complete schema picture — what matters now

```
profiles              memory document + user identity
captures              the corpus — all voice, text, file
enrichments           AI extraction + vector embeddings
tags                  per-user labels
capture_tags          capture ↔ tag junction
capture_projects      capture ↔ project junction
projects              context fields (what, why, success, question, mode)
context_outputs       output history — every copied context block
project_conversations Ki chat history per project
project_artifacts     generated diagrams (future — schema exists)
canvas_nodes          canvas workspace (future — schema exists)
canvas_edges          canvas connections (future — schema exists)
canvas_conversations  canvas chat (future — schema exists)
connections           user ↔ user mutual connections (Phase 4)
joint_sessions        shared thinking sessions (Phase 4)
session_captures      captures in shared session (Phase 4)
```

---

## The Agent Context Architecture

Every Ki interaction receives three layers. This is fixed — does not change as corpus grows.

```
Layer 1 — Memory document (~800 tokens, always)
  profiles.memory_document
  Who this person is, what they are building, their patterns

Layer 2 — Project context (~200 tokens, always for project chat)
  projects.what + why + success_looks_like + open_question
  What this specific project is about

Layer 3 — RAG retrieval (~2500 tokens)
  Top 10 semantically relevant captures via pgvector
  Weighted: is_starred DESC → cosine similarity → captured_at DESC

Total: ~3500 tokens. Fixed ceiling regardless of corpus size.
```

The chat history for the project is also included for continuity — typically the last 10 exchanges, ~500 tokens. Stays within budget.

---

## The Enrichment Pipeline — Unchanged

Every capture INSERT triggers `enrich-capture` Edge Function asynchronously.

```
1. Fetch capture body + user memory document
2. Single Claude Haiku call — structured JSON extraction:
   summary, themes, sentiment, mood_tags, energy_level,
   capture_intent, questions_raised, people_mentioned,
   key_quotes, entities
3. Write to enrichments table
4. Generate vector embedding (text-embedding-3-small, 1536 dims)
5. Write embedding to enrichments.embedding
6. Auto-set captures.title from summary if blank
7. On failure: set enrichment_status = 'failed', never block capture
```

No hardcoded personal vs artifact profile split. Claude reads the content and determines what fields are genuinely present. A journal uploaded as a file gets personal enrichment because it reads like one. A research paper gets themes and key quotes but not mood tags. The model decides.

---

## What Is Removed / Deprioritized

**ki_sections** — removed. The living document concept was right but sections were the wrong structure. The output history table replaces it entirely. More honest, less friction, grows automatically.

**The Ki doc with manual section management** — removed. The output history is the Ki doc. It documents the evolution of thinking through the act of using the tool, not through a separate documentation effort.

**URL capture** — deferred to Phase 2. Too many edge cases (paywalls, timeouts, extraction failures). Phase 1 is voice, text, file.

**Canvas as primary distillation interface** — deprioritized. Canvas is on the back burner. The context builder in the project interface is the primary distillation surface. Canvas remains in the schema for future use.

**The generate-brief Edge Function** — rework or remove. The one-shot brief generation is replaced by the conversational context builder + output history model. If kept, it should generate a starting context block that goes into the output history, not a formatted document.

---

## Build Priority from Here

```
1. Schema migration
   — Update projects table (drop brief/ki, add context fields)
   — Create context_outputs table
   — Create capture_projects junction
   — Verify project_conversations exists and is correct
   — Remove ki_sections if it exists

2. Project creation flow
   — 5 context questions: what, why, success, open question, mode
   — Voice input on mobile, text on web
   — All optional except name — never block project creation

3. Project detail page — web
   — Left: captures panel (collapsible, filtered by project)
   — Center top: context builder textarea + referenced capture chips + copy button
   — Center bottom: output history (timestamped, chronological)
   — Right: Ki chat panel (persistent, always visible)
   — Citation highlight: clicking cite-chip highlights capture in left panel

4. project-agent Edge Function
   — Reads: memory document + project context fields + corpus + chat history
   — Returns: conversational response + cite-chip references
   — Can suggest additions to context builder (accept/reject in chat)

5. Context output persistence
   — On copy: save content + capture_ids + timestamp to context_outputs
   — Display in output history immediately

6. Mobile capture flow to project
   — Assign capture to project at capture time
   — Writes to capture_projects junction
```

---

## Visual Reference

The prototype `ki_web_v2.html` is the visual and interaction reference for everything above. It is fully navigable and demonstrates:

- Home dashboard with stats, quick capture, project cards, activity, themes, streak
- Library with capture feed, search, filters, starred captures
- Project workspace (ki, raybuilds021, airbnb website) with all three zones
- Citation highlight interaction — click cite-chips to pulse-highlight captures
- Output history with timestamped entries and capture references
- Explore with pattern dashboard and full-corpus chat
- Profile with memory document cards

All design decisions in the prototype are intentional. The color palette (terra, ray, pacific, sage on charcoal), the typography (Merriweather serif for thinking, Poppins sans for chrome), and the interaction patterns are the design system for the Ki web interface.
