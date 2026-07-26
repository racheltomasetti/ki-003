---
status: complete
completed: 2026-07-26
surface: web
touches: apps/web
---

# Light/Dark Keyboard Toggle

Global keyboard shortcut on web: press `d` or `l` to flip between light and dark mode, without needing to click the sidebar toggle. Disabled while typing in an input/textarea/select/contenteditable so it doesn't interfere with normal text entry.

## What was built

- A single global `keydown` listener (mounted once, app-wide) that flips the current theme when `d` or `l` is pressed.
- Guards: ignored if a modifier key (cmd/ctrl/alt) is held, or if the event target is a text-entry element (`input`, `textarea`, `select`, `contenteditable`).
- Both keys toggle (not "d = dark, l = light") — same behavior as the reference implementation below.
- No new theme state, persistence, or boot script was needed — this repo already had `next-themes` wired up (class-based dark mode via Tailwind v4's `@custom-variant`, `attribute="class"`, system-preference sync, localStorage persistence, FOUC-safe boot). The shortcut is a thin layer on top of the existing `useTheme()`/`setTheme()` from `next-themes`.

## Files touched

| File | Change |
|---|---|
| `apps/web/src/components/ThemeKeyboardShortcut.tsx` | New. Client component, no render output — just the `useEffect` + `keydown` listener calling `setTheme()`. |
| `apps/web/src/components/Providers.tsx` | Mounted `<ThemeKeyboardShortcut />` inside the existing `<ThemeProvider>`, alongside `AccentColorProvider`. |

Existing (unmodified) infra this depended on:
- `apps/web/src/components/Providers.tsx` — `ThemeProvider` from `next-themes` (`attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`).
- `apps/web/src/app/layout.tsx` — `suppressHydrationWarning` on `<html>` (required by `next-themes`).
- `apps/web/src/app/globals.css` — `@custom-variant dark (&:where(.dark, .dark *))`, class-based dark tokens.
- `apps/web/src/components/Sidebar.tsx` — existing click-to-toggle theme switch (`useTheme()`), which the keyboard shortcut complements rather than replaces.

## Decisions

- **Scope: global**, not surface-scoped — the listener mounts once near the root and applies on every page (auth pages included), rather than only inside `(app)` routes.
- **No custom ThemeContext.** The reference implementation (rays-garden, below) hand-rolls theme state, manual-override tracking, and a boot script. This repo already gets all of that for free from `next-themes`, so only the keyboard-handling layer was added.

## Verification

- `pnpm --filter web exec tsc --noEmit` passes with no errors.

---

## Reference: rays-garden implementation

(rays-garden is the repo name for ray's personal website, master builder of ki — this section is the original inspiration doc, kept for context on the pattern this was adapted from.)

Here's how theme switching works in that repo — three layers: boot script, React state + keyboard, CSS tokens.

### Files at play

| Role | Path |
|---|---|
| Keyboard + state + DOM class | `src/app/contexts/ThemeContext.tsx` |
| Provider mount + FOUC-prevention script | `src/app/layout.tsx` |
| Light/dark CSS variables | `src/app/globals.css` (`:root` / `.dark`) |
| Optional: components that branch on theme | `useTheme()` in Connect, Garden, KiLogo, etc. |

### Flow

`layout.tsx` inline script → reads `localStorage` / system → `html` gets `.light` or `.dark` → `globals.css` tokens swap → keydown `d`/`l` → `ThemeContext.toggleTheme()` → theme state + `manualOverride` → `useEffect`: set `html` class + persist to `localStorage` → `prefers-color-scheme` change.

### 1. Instant boot (no flash) — layout.tsx

Before React hydrates, a tiny inline script on `<html>`:

- Reads `localStorage.themeManualOverride` + `localStorage.theme`
- If manual override → use saved theme
- Else → `matchMedia('(prefers-color-scheme: dark)')`
- Adds `"dark"` or `"light"` class on `document.documentElement`

That's why you need `suppressHydrationWarning` on `<html>` — the class may differ from the server render.

### 2. Runtime brain — ThemeContext.tsx

Wrapped around the app in layout via `<ThemeProvider>`.

**State**
- `theme: "dark" | "light"`
- `mounted`: wait until client init before writing DOM
- `isManualOverride`: once you press d/l, OS preference stops winning

**Init (on mount)**
Same logic as the boot script: manual override → saved theme, else system preference.

**Apply theme**
Whenever theme changes (and mounted):
```
root.classList.remove("light", "dark");
root.classList.add(theme);
root.classList.add("theme-ready"); // unlocks CSS transitions
// if manual: persist theme + themeManualOverride
```

**Keyboard**
Global keydown listener (skips if focus is in input/textarea/contenteditable):
- `d` / `D` / `l` / `L` → `toggleTheme()`
- Both keys flip (not "d = dark, l = light")
- Sets `isManualOverride = true` so OS changes no longer override

**System listener**
Still watches `prefers-color-scheme`, but only updates if `!isManualOverride`.

**Consumers**
`useTheme()` → `{ theme, toggleTheme }`. Used when JS needs the value (logo swap, Three.js garden colors). Most UI just uses CSS variables.

### 3. Visual tokens — globals.css

Class-based dark mode on `<html>`:
- `:root` → light tokens (`--bg`, `--text`, `--yellow`, …)
- `.dark` → dark overrides
- `body { background: var(--bg); color: var(--text); }`
- `html.theme-ready body` → smooth color transitions after first paint

Tailwind dark variant is wired as `@custom-variant dark (&:where(.dark, .dark *))` so `dark:` utilities follow the same class.

### Minimal port checklist

- CSS: `:root` light vars + `.dark` overrides; paint with `var(--bg)` / `var(--text)`.
- Boot script: set `html` class from `localStorage` or `prefers-color-scheme` before first paint.
- State module: hold theme + manualOverride; on change, set `html` class + persist.
- Key handler: on `d`/`l` (when not typing), flip theme and lock manual override.
- Optional: `useTheme()` / equivalent for assets that can't be CSS-only.
- localStorage keys in this codebase: `theme` (`"dark" | "light"`) and `themeManualOverride` (`"true"`).
