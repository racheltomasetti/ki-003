# Ki

> *Give people a space to capture the evolution of their mind — and the intelligence to understand it.*

Ki is a personal intelligence system — a living extension of your mind. You feed it everything that matters: voice captures, text, URLs, files. An AI pipeline enriches it, embeds it, and makes it explorable. Over time, Ki becomes the most complete portrait of a mind ever assembled — by you, for you.

**The core thesis:** Ki only knows what you give it. No hallucination. When Ki tells you something about yourself, it is because you said it, saved it, or chose it.

This is not a notes app. It is not a productivity tool. It is a space for the mind.

---

## Table of Contents

1. [The Vision](#the-vision)
2. [Two Surfaces, One Mind](#two-surfaces-one-mind)
3. [Tech Stack — Plain English](#tech-stack--plain-english)
4. [Project Setup](#project-setup)
5. [Working with Supabase](#working-with-supabase)
6. [How We Work Together — Git Workflow](#how-we-work-together--git-workflow)
7. [Design System](#design-system)
8. [Project Structure](#project-structure)
9. [Go Deeper](#go-deeper)

---

## The Vision

Ki is built around one core idea: capturing your thoughts consistently, and being able to explore them over time, is one of the most powerful things a person can do for themselves.

The product is built in four phases:

- **Phase 1 (now):** The core loop — capture across both surfaces, library, tags, basic Chat with Ki on web
- **Phase 2:** Intelligence layer — hybrid search, knowledge graph, timeline, pattern dashboard, Ki Pro
- **Phase 3:** The laboratory — canvas, biometric integrations, additional exploration tools
- **Phase 4:** Community — public profiles, shared knowledge graphs

We are building Phase 1. Every decision is designed to support Phase 2 and beyond without tearing things apart.

For the full product breakdown: see `.claude/PRD.md`

---

## Two Surfaces, One Mind

Ki is a system where two surfaces serve different purposes but share everything underneath.

| Surface | Form | Purpose |
|---|---|---|
| **Mobile** | Expo + React Native | Intimate and immediate — the intake valve. Your phone is always with you. |
| **Web** | Next.js | Expansive and intentional — the laboratory. Sit down with your whole corpus. |

Both surfaces talk to the same Supabase backend. Same auth, same database, same enrichment pipeline, same storage. What you capture on mobile appears immediately on web. You can live entirely in one or the other — or both.

---

## Tech Stack — Plain English

You don't need to be an expert in all of these. You just need to know what each one does and why it's here.

### Shared

| What | Tool | Why |
|---|---|---|
| Monorepo management | [pnpm workspaces](https://pnpm.io/workspaces) | Manages the mobile app, web app, and shared packages as one project |
| Language | [TypeScript](https://www.typescriptlang.org) | JavaScript with types — catches mistakes before they become bugs |
| App state | [Zustand](https://zustand-demo.pmnd.rs) | Simple store for data that lives in memory while the app is open |
| Data fetching | [TanStack Query](https://tanstack.com/query) | Handles loading, caching, and refreshing data from the server |
| Backend | [Supabase](https://supabase.com) | Database, auth, file storage, and server functions — all in one |
| AI enrichment | [Claude Haiku](https://anthropic.com) | Extracts themes, mood, and patterns from each capture |
| Chat AI | [Claude Sonnet](https://anthropic.com) | Powers Chat with Ki — grounded entirely in your corpus |
| Vector search | [pgvector](https://github.com/pgvector/pgvector) | Finds semantically similar captures — the foundation of the RAG pipeline |

### Mobile (`apps/mobile`)

| What | Tool | Why |
|---|---|---|
| The app itself | [Expo](https://expo.dev) + [React Native](https://reactnative.dev) | Write one codebase, run on iPhone and Android |
| Navigation | [Expo Router](https://docs.expo.dev/router/introduction/) | File-based routing — the folder structure *is* the navigation |
| Styling | [NativeWind](https://www.nativewind.dev) | Tailwind CSS for React Native — utility classes, fast to write |
| Offline buffer | [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/) | Saves captures locally when there's no internet |
| Voice recording | [expo-audio](https://docs.expo.dev/versions/latest/sdk/audio/) | Records voice on device |
| Transcription | [OpenAI Whisper](https://openai.com/research/whisper) | Converts voice recordings to text |

### Web (`apps/web`)

| What | Tool | Why |
|---|---|---|
| Framework | [Next.js 14](https://nextjs.org) | React framework with server rendering, file-based routing, and Vercel deployment |
| Styling | [Tailwind CSS](https://tailwindcss.com) | Utility-first CSS — same design tokens as mobile |

---

## Project Setup

This is a step-by-step guide to getting the project running on your machine for the first time.

### What you need installed first

- **Node.js** (version 20 or higher) — [download here](https://nodejs.org)
- **pnpm** — run this in your terminal: `npm install -g pnpm`
- **Git** — [download here](https://git-scm.com)
- **Expo Go** on your phone — [iOS](https://apps.apple.com/app/expo-go/id982107779) or Android
- **Xcode** (Mac only, for iOS Simulator) — download from the Mac App Store
- **Supabase CLI** — `brew install supabase/tap/supabase`

### Getting the project

```bash
# Clone the repository
git clone <repository-url>
cd ki-003

# Install all dependencies across the monorepo
pnpm install
```

### Environment variables

Create a `.env.local` file in `apps/mobile/` and `apps/web/`. These files are **never committed to git** — they contain secret keys that must stay private.

**`apps/mobile/.env.local`**
```
EXPO_PUBLIC_SUPABASE_URL=your-supabase-project-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
EXPO_PUBLIC_OPENAI_API_KEY=your-openai-key
```

**`apps/web/.env.local`**
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

You can find the Supabase values in the Supabase dashboard under **Project Settings → API**.

### Starting mobile

```bash
pnpm --filter mobile start
# or: cd apps/mobile && npx expo start
```

This opens a QR code in your terminal. Scan it with your phone using the Expo Go app. Press `i` to open the iOS Simulator.

### Starting web

```bash
pnpm --filter web dev
# or: cd apps/web && pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000).

---

## Working with Supabase

Supabase is our entire backend — the database, user authentication, file storage, and server-side functions all live here.

### Two ways to work with Supabase

**1. The Cloud Dashboard** — [supabase.com](https://supabase.com)

Think of this as the visual control panel. Use it to:
- Browse and inspect data in the database
- View and manage auth users
- Check logs when something goes wrong
- Configure auth providers (Apple, Google)
- Browse files in storage

Do not use it to change the database structure directly — that's what migrations are for.

**2. The CLI (command line)**

This is how you make structural changes to the database, generate TypeScript types, and deploy server functions. Everything stays in code, tracked in git.

### Linking your local project to the cloud

```bash
# Log in to Supabase
supabase login

# Link this project folder to your cloud project
# Find your project ref: supabase.com → your project → Settings → General
supabase link --project-ref your-project-ref
```

You only need to do this once per machine.

### Making database changes (migrations)

1. Write a `.sql` file in `supabase/migrations/` describing the change
2. Push it to the cloud:
   ```bash
   supabase db push
   ```
3. Regenerate the TypeScript types so the apps know about the new structure:
   ```bash
   supabase gen types typescript --linked > packages/types/src/database.ts
   ```

This keeps the database schema in version control alongside the code.

### Deploying server functions

Ki uses Supabase Edge Functions for AI enrichment (Claude Haiku on each capture) and URL extraction. These live in `supabase/functions/`.

```bash
# Deploy a function
supabase functions deploy enrich-capture

# Set a secret key that the function can access
supabase secrets set ANTHROPIC_API_KEY=your-key-here
```

---

## How We Work Together — Git Workflow

Git is how we save and share code changes without overwriting each other's work.

Think of `main` as the published version of the codebase — it should always be stable. You never work directly on `main`. Instead, you create a **branch** — your own copy of the codebase where you can make changes safely, then propose merging them back in.

### The daily workflow

```bash
# Before starting any new work, make sure you're up to date
git checkout main
git pull

# Create a new branch for what you're working on
git checkout -b feature/capture-screen

# ... make your changes ...

# Save your changes
git add .
git commit -m "Add voice recording to capture screen"

# Push your branch so others can see it
git push origin feature/capture-screen
```

Then open a **Pull Request** on GitHub. This gives the other person a chance to review before anything merges into main.

### Branch naming conventions

| Prefix | Use for |
|---|---|
| `feature/` | New screens, new functionality |
| `fix/` | Bug fixes |
| `design/` | Visual changes, styling updates |
| `chore/` | Setup, config, dependencies |

### The golden rules

1. **Never commit directly to `main`**
2. **One branch per piece of work** — keep changes focused
3. **Commit often** — small commits are easier to understand and undo
4. **Write clear commit messages** — future you will thank present you

---

## Design System

### Colors

| Name | Hex | Light Mode | Dark Mode |
|---|---|---|---|
| Cream | `#f6f1e6` | Background | Foreground (text) |
| Ink | `#100f0f` | Foreground (text) | Background |
| Terra | `#9e2a2b` | Primary CTA, destructive | Same |
| Ray | `#efcb68` | Highlights, streaks, warmth | Same |
| Pacific | `#58a4b0` | Secondary actions, links | Same |
| Sage | `#67934d` | Positive states, growth | Same |

Both dark and light mode are fully supported. The app respects system preference by default, with a manual override in Profile settings.

### Fonts

- **Merriweather** (serif) — capture body text, editorial moments, display headings. Feels written, personal, permanent.
- **Poppins** (sans-serif) — navigation, labels, buttons, metadata. Clean, functional, recedes.

The split is intentional: what you've captured feels like writing. The UI around it recedes.

---

## Project Structure

```
ki-003/
├── apps/
│   ├── mobile/                   Expo app — the intake valve
│   │   ├── app/
│   │   │   ├── (auth)/           Sign in, sign up, onboarding
│   │   │   └── (tabs)/           The main tab screens
│   │   │       ├── home/         Dashboard + Library
│   │   │       ├── capture/      Capture screen
│   │   │       └── profile/      Profile + Settings
│   │   ├── store/                App state (Zustand)
│   │   └── hooks/                Data-fetching hooks
│   │
│   └── web/                      Next.js app — the laboratory
│       └── app/
│           ├── (auth)/           Sign in, sign up
│           └── (app)/            Library, capture, Chat with Ki
│
├── packages/
│   ├── types/                    Shared TypeScript types
│   │   └── src/
│   │       ├── database.ts       Auto-generated from Supabase — never edit by hand
│   │       └── app.ts            Shared app-level types
│   ├── services/                 All Supabase logic — used by both apps
│   │   └── src/
│   │       ├── captures.ts       All capture CRUD
│   │       ├── enrichments.ts    Read-only enrichment access
│   │       └── storage.ts        File + image upload
│   └── utils/                    Shared utility functions
│
├── supabase/
│   ├── migrations/               SQL files that define the database schema
│   └── functions/                Edge Functions (enrichment, URL extraction)
│
├── .claude/
│   ├── PRD.md                    Full product requirements document
│   └── CLAUDE.md                 Developer context for Claude Code
└── docs/
    └── NEW-PRD.md                Source PRD — reference only
```

---

## Go Deeper

The best places to learn more about each part of the stack.

**Expo + React Native**
- [Expo documentation](https://docs.expo.dev) — start here for anything Expo-related
- [Expo Router guide](https://docs.expo.dev/router/introduction/) — how file-based navigation works
- [React Native docs](https://reactnative.dev/docs/getting-started)

**Next.js**
- [Next.js documentation](https://nextjs.org/docs) — App Router, Server Components, everything
- [Next.js App Router crash course](https://nextjs.org/learn) — official interactive tutorial

**TypeScript**
- [TypeScript in 5 minutes](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes.html)
- [Total TypeScript](https://www.totaltypescript.com/tutorials) — free, practical, well-structured

**Styling**
- [NativeWind docs](https://www.nativewind.dev/overview/) — for mobile
- [Tailwind CSS docs](https://tailwindcss.com/docs) — the system both surfaces use

**Supabase**
- [Supabase docs](https://supabase.com/docs)
- [Supabase + Expo guide](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native)
- [Supabase + Next.js guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)

**Git**
- [Git the Simple Guide](https://rogerdudler.github.io/git-guide/) — visual, no-nonsense reference
- [Oh Shit, Git!](https://ohshitgit.com) — for when things go wrong (they will, it's fine)

---

*Ki is built in public. Questions, ideas, and observations are always welcome.*
