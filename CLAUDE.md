# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Vietnamese-language, Duolingo-style learning app for SAP (ABAP/functional modules). Two independent
learning products live in the same app:

1. **Quest** — gamified quizzes over 5 SAP modules (XP, streaks, badges, spaced-repetition review pool).
2. **Code Lab** (`/lab`) — a read-only library of real ABAP exercises with syntax highlighting and a
   client-side "lint" that checks block/string balance (not a real ABAP compiler/runtime).

All UI copy, quiz content, and exercise write-ups are in Vietnamese — keep new content in Vietnamese
unless told otherwise.

## Commands

```bash
npm run dev       # start Vite dev server
npm run build      # tsc -b (typecheck) + vite build -> dist/
npm run lint       # oxlint
npm run preview    # preview the production build
npx vitest run     # run the full test suite (no "test" script is defined in package.json)
npx vitest run src/state/progress.test.ts   # run a single test file
npx vitest         # watch mode
```

There is no test script wired into `package.json`; always invoke vitest directly via `npx`.

Deployment is automatic: `.github/workflows/deploy.yml` builds and publishes `dist/` to GitHub Pages on
every push to `main`. `vite.config.ts` sets `base: '/learn_sap_abap/'` only when building (`command ===
'build'`); dev server base stays `/`. The app uses `HashRouter` (see `App.tsx`) specifically so client-side
routes survive being served from a GitHub Pages subpath with no server-side rewrite rules.

## Architecture

### Content is data, not code

Everything module/quiz/exercise-related lives under `src/content/**` as JSON files, imported directly by
TypeScript modules (`resolveJsonModule` is on) and cast to the types in `src/content/types.ts` /
`src/content/lab/types.ts`. There is no CMS and no runtime fetch — content is bundled at build time.

- `src/content/index.ts` is the single aggregation point for the 5 quiz modules (`mm`, `co`, `fi-gl`,
  `enterprise-structure`, `sd`). Each module directory has `module.json` (metadata), `tables.json` (wiki
  entries), and `quiz.json` (the business-focused lesson list — there is no separate syntax track).
  **Every module's `quiz.json` must have exactly 3 lessons of exactly 8 questions each** — this is
  enforced by `src/content/content.test.ts`, not by any type system check.
- `src/content/lab/index.ts` is the equivalent aggregation point for Code Lab: each exercise directory has
  `exercise.json` (metadata: problem statement, concepts, walkthrough, sample output) plus one or more
  `.abap` files imported with Vite's `?raw` suffix and wired together via the `build()` helper.
  `src/content/lab/lab.test.ts` enforces invariants such as exercise count, `sourceFiles` matching the
  actually-loaded files, and every `sampleOutput` carrying a disclaimer that it's illustrative, not a real
  SAP run.
- **When adding a new module or exercise, you must also register it** in the relevant `index.ts` aggregator
  (imports are explicit, not directory-scanned) — the content tests will fail loudly if something is
  missing or malformed, so run them after any content change.

### Progress state: pure functions + a thin React wrapper

State logic is deliberately split so the rules are unit-testable without React:

- `src/state/progress.ts` — pure, side-effect-free functions (`recordAnswer`, `completeLesson`,
  `isLessonUnlocked`, `updateStreak`, `computeEarnedBadges`, `levelForXp`). These take a `ProgressState` and
  return a new one; XP/streak/badge/spaced-repetition rules live here and are covered by
  `progress.test.ts`.
- `src/state/storage.ts` — localStorage persistence (`sap-quest:progress:v1`), fails safe to
  `INITIAL_PROGRESS` on any parse error.
- `src/state/ProgressContext.tsx` — the only place React and the pure functions meet. It keeps a `useRef`
  mirror of the latest state (`latestRef`) alongside `useState` specifically so that two `recordAnswer`/
  `completeLesson` calls in the same event handler compose correctly and so neither pure function ever runs
  inside a React updater callback (StrictMode double-invokes those in dev, which would silently duplicate
  XP/badges). Read the comment in that file before changing how state updates are sequenced.

The review pool implements simple spaced repetition: a wrong answer adds a question to
`reviewPool[moduleId]` at streak 0; correct answers during review increment the streak; reaching
`REVIEW_MASTERY_STREAK` (2) removes it from the pool. Lessons only unlock in order within a track
(`isLessonUnlocked`), keyed by `lessonKey(moduleId, track, lessonId)`.

### Routing

`HashRouter` with routes defined in `App.tsx`: module list (`/`) → module detail (`/module/:moduleId`) →
lesson/quiz runner (`/lesson/:moduleId/:track/:lessonId`, where `lessonId === 'review'` is the special
spaced-repetition track) and a parallel Wiki (`/wiki`, `/wiki/:moduleId/:tableId`) and Code Lab
(`/lab`, `/lab/:exerciseId`) section. Tables in the Wiki and tables/exercises referenced from Code Lab
cross-link to each other (`findTableAnyModule` in `src/content/index.ts`).

### ABAP linting is intentionally naive

`src/lib/abapLint.ts` only checks block-keyword balance (FORM/IF/LOOP/CASE/DO/WHILE/TRY/CLASS/METHOD/
MODULE and their `END*` counterparts), unterminated string literals, and missing periods on block
terminators — by blanking out comments/string contents per line first. It is not a parser and does not
execute ABAP. Don't extend it to try to be a real compiler; keep it a lightweight sanity check as advertised
in the UI ("Kiểm tra cú pháp" / basic checks only).

## Styling

Tailwind v4 via `@tailwindcss/vite` (no `tailwind.config.js` — v4 config lives in CSS). Global tokens and
light/dark overrides are in `src/index.css` using `prefers-color-scheme` and CSS custom properties. `<select>`
elements are pinned to the app's own palette in CSS because Tailwind classes alone don't reliably theme
native select popups across browsers.
