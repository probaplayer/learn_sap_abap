# MCP + Claude Desktop Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the developer use Claude Desktop (via a local MCP server) to read SAP Quest's
content and their own exported learning progress, author a personalized practice question set
targeting their weak spots, publish it (commit + push) so it deploys automatically, and play it
on a new `/practice` route in the app.

**Architecture:** A standalone Node/TypeScript MCP server (`mcp-server/`, stdio transport) reads
JSON content files and a manually-exported progress snapshot directly off disk, validates and
writes new "generated practice set" JSON files into `src/content/generated/`, and — on request
— commits and pushes them to `main` so GitHub Actions redeploys. The React app gains an export
button, a Vite `import.meta.glob`-based aggregator for generated sets, and a practice-runner
route that reuses the existing `QuestionCard` component.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk` (^1.29.0), `zod` (^4.4.3), `tsx` (run
the MCP server without a build step), Vite `import.meta.glob`, Vitest (existing app tests only —
per spec, the MCP server itself is verified manually, not with an automated suite).

## Global Constraints

- Full design lives in `docs/superpowers/specs/2026-07-20-mcp-claude-desktop-integration-design.md` — every task below implements a section of it.
- Vietnamese-language UI copy and doc comments, matching the rest of the app (see `CLAUDE.md`).
- No `test` script exists in the root `package.json` — always run `npx vitest run <path>` for the app's tests, never bare `vitest`.
- `mcp-server/` is a separate npm package (its own `package.json`/`node_modules`) — do not add its dependencies to the root `package.json`.
- `mcp-server`'s `tsconfig.json` uses `module: nodenext`, so every relative import inside `mcp-server/` (including ones reaching into `../../src/content/*`) must use an explicit `.js` extension on the specifier even though the source file is `.ts` — `tsx` resolves this the same way Node's ESM loader does.
- Generated practice sets are never subject to the "3 lessons × 8 questions" rule that `content.test.ts` enforces on official quiz content — that constraint only applies to `content/mm|co|fi-gl|enterprise-structure|sd/quiz-*.json`.
- `publish_practice_set` is the only place in this codebase allowed to run `git commit`/`git push` without a human typing the command — never generalize this pattern elsewhere.

---

### Task 1: Extract `validateQuestion` into a shared module

**Files:**
- Create: `src/content/validateQuestion.ts`
- Modify: `src/content/content.test.ts:1-43`
- Test: `src/content/content.test.ts` (existing suite must stay green — this is a pure refactor, no new test)

**Interfaces:**
- Consumes: `QuizQuestion` type from `src/content/types.ts` (already exists)
- Produces: `export function validateQuestion(q: QuizQuestion): string[]`, `export const VALID_DIFFICULTIES: string[]`, `export const VALID_QUESTION_TYPES: string[]` — Task 6 (generated.test.ts) and the MCP server's `write_practice_set`/`publish_practice_set` (Tasks 10–11) import `validateQuestion` from this file.

- [ ] **Step 1: Run the existing content tests to confirm they're green before touching anything**

Run: `npx vitest run src/content/content.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 2: Create `src/content/validateQuestion.ts` with the extracted logic**

```typescript
import type { QuizQuestion } from './types'

export const VALID_DIFFICULTIES = ['basic', 'intermediate', 'advanced']
export const VALID_QUESTION_TYPES = ['multiple-choice', 'true-false', 'fill-blank', 'matching']

export function validateQuestion(q: QuizQuestion): string[] {
  const errors: string[] = []
  if (!q.id) errors.push('missing id')
  if (!VALID_DIFFICULTIES.includes(q.difficulty)) errors.push(`invalid difficulty: ${q.difficulty}`)
  if (!VALID_QUESTION_TYPES.includes(q.type)) errors.push(`invalid type: ${q.type}`)
  if (!q.explanation || q.explanation.trim().length === 0) errors.push(`[${q.id}] missing explanation`)

  switch (q.type) {
    case 'multiple-choice':
      if (!q.question) errors.push(`[${q.id}] missing question text`)
      if (!Array.isArray(q.options) || q.options.length < 2) errors.push(`[${q.id}] needs >=2 options`)
      if (q.answerIndex < 0 || q.answerIndex >= (q.options?.length ?? 0)) {
        errors.push(`[${q.id}] answerIndex out of range`)
      }
      break
    case 'true-false':
      if (!q.statement) errors.push(`[${q.id}] missing statement`)
      if (typeof q.answer !== 'boolean') errors.push(`[${q.id}] answer must be boolean`)
      break
    case 'fill-blank':
      if (!q.prompt) errors.push(`[${q.id}] missing prompt`)
      if (!Array.isArray(q.acceptableAnswers) || q.acceptableAnswers.length === 0) {
        errors.push(`[${q.id}] needs >=1 acceptableAnswers`)
      }
      break
    case 'matching':
      if (!Array.isArray(q.pairs) || q.pairs.length < 2) errors.push(`[${q.id}] needs >=2 pairs`)
      if (q.pairs) {
        const lefts = new Set(q.pairs.map((p) => p.left))
        if (lefts.size !== q.pairs.length) errors.push(`[${q.id}] duplicate 'left' values in pairs`)
      }
      break
  }
  return errors
}
```

- [ ] **Step 3: Update `content.test.ts` to import it instead of defining it locally**

Replace lines 1–43 of `src/content/content.test.ts` (imports through the end of `validateQuestion`) with:

```typescript
import { describe, expect, it } from 'vitest'
import { MODULE_ORDER, MODULES, QUIZ_TRACKS, TABLES } from './index'
import { validateQuestion } from './validateQuestion'

const TRACKS = ['syntax', 'business'] as const
```

Leave everything from `describe('content schema validation', ...)` onward unchanged — it already calls `validateQuestion(q)`, which now resolves to the imported function.

- [ ] **Step 4: Run the tests again to confirm nothing broke**

Run: `npx vitest run src/content/content.test.ts`
Expected: PASS (4 tests, identical to Step 1)

- [ ] **Step 5: Commit**

```bash
git add src/content/validateQuestion.ts src/content/content.test.ts
git commit -m "Extract validateQuestion into a shared module"
```

---

### Task 2: `recordPracticeAnswer` pure function

**Files:**
- Modify: `src/state/progress.ts`
- Modify: `src/state/progress.test.ts:1-9` (imports) and append new `describe` block

**Interfaces:**
- Consumes: `ProgressState` from `./types` (already imported in `progress.ts`)
- Produces: `export const XP_PRACTICE_CORRECT_ANSWER = 10`, `export function recordPracticeAnswer(state: ProgressState, params: { correct: boolean }): { state: ProgressState; xpGained: number }` — Task 3 (`ProgressContext.tsx`) calls this directly.

- [ ] **Step 1: Add the failing test to `src/state/progress.test.ts`**

Update the top import block to include the new function:

```typescript
import { describe, expect, it } from 'vitest'
import { INITIAL_PROGRESS } from './types'
import {
  completeLesson,
  isLessonUnlocked,
  levelForXp,
  recordAnswer,
  recordPracticeAnswer,
  updateStreak,
} from './progress'
```

Append this new `describe` block at the end of the file:

```typescript
describe('recordPracticeAnswer', () => {
  it('adds XP on a correct answer without touching reviewPool/completedLessons/perfectLessons/badges', () => {
    const result = recordPracticeAnswer(INITIAL_PROGRESS, { correct: true })
    expect(result.xpGained).toBe(10)
    expect(result.state.xp).toBe(10)
    expect(result.state.reviewPool).toEqual({})
    expect(result.state.completedLessons).toEqual([])
    expect(result.state.perfectLessons).toEqual([])
    expect(result.state.badges).toEqual([])
  })

  it('adds no XP on a wrong answer and does not add the question to reviewPool', () => {
    const result = recordPracticeAnswer(INITIAL_PROGRESS, { correct: false })
    expect(result.xpGained).toBe(0)
    expect(result.state.xp).toBe(0)
    expect(result.state.reviewPool).toEqual({})
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/state/progress.test.ts`
Expected: FAIL — `recordPracticeAnswer is not a function` (or similar import error)

- [ ] **Step 3: Implement `recordPracticeAnswer` in `src/state/progress.ts`**

Add near the other `XP_*` constants at the top of the file:

```typescript
export const XP_PRACTICE_CORRECT_ANSWER = 10
```

Add near `recordAnswer` (after its closing brace):

```typescript
export interface RecordPracticeAnswerParams {
  correct: boolean
}

export interface RecordPracticeAnswerResult {
  state: ProgressState
  xpGained: number
}

/**
 * XP-only counterpart to recordAnswer for ad hoc generated practice sets.
 * Deliberately does not touch reviewPool: that pool is looked up by
 * questionId through findQuestion(), which only searches the module's fixed
 * lesson content, not content/generated/** — mixing generated-question ids
 * into reviewPool would make them silently vanish from future review.
 */
export function recordPracticeAnswer(
  state: ProgressState,
  params: RecordPracticeAnswerParams,
): RecordPracticeAnswerResult {
  const xpGained = params.correct ? XP_PRACTICE_CORRECT_ANSWER : 0
  return {
    state: { ...state, xp: state.xp + xpGained },
    xpGained,
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/state/progress.test.ts`
Expected: PASS (all tests in the file, including the 2 new ones)

- [ ] **Step 5: Commit**

```bash
git add src/state/progress.ts src/state/progress.test.ts
git commit -m "Add recordPracticeAnswer for XP-only practice-set scoring"
```

---

### Task 3: Wire `recordPracticeAnswer` into `ProgressContext`

**Files:**
- Modify: `src/state/ProgressContext.tsx`
- Test: `src/state/ProgressContext.test.tsx`

**Interfaces:**
- Consumes: `recordPracticeAnswer` from `./progress` (Task 2)
- Produces: `useProgress().recordPracticeAnswer: (correct: boolean) => number` (returns XP gained) — Task 7's `PracticeRunnerPage` calls this directly.

- [ ] **Step 1: Add the failing test to `src/state/ProgressContext.test.tsx`**

Append this new `describe` block after the existing one:

```tsx
describe('recordPracticeAnswer', () => {
  it('adds XP and returns the amount gained, without touching reviewPool', () => {
    const { result } = renderHook(() => useProgress(), { wrapper })

    let xpGained = -1
    act(() => {
      xpGained = result.current.recordPracticeAnswer(true)
    })

    expect(xpGained).toBe(10)
    expect(result.current.progress.xp).toBe(10)
    expect(result.current.progress.reviewPool).toEqual({})
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/state/ProgressContext.test.tsx`
Expected: FAIL — `result.current.recordPracticeAnswer is not a function`

- [ ] **Step 3: Wire it into the context**

In `src/state/ProgressContext.tsx`, update the import from `./progress`:

```typescript
import {
  completeLesson as completeLessonPure,
  getReviewQuestionIds,
  isLessonUnlocked as isLessonUnlockedPure,
  levelForXp,
  recordAnswer as recordAnswerPure,
  recordPracticeAnswer as recordPracticeAnswerPure,
} from './progress'
```

Add to the `ProgressContextValue` interface:

```typescript
  recordPracticeAnswer: (correct: boolean) => number
```

Add to the `value` object inside the `useMemo`, alongside `recordAnswer`:

```typescript
      recordPracticeAnswer: (correct) => {
        const result = recordPracticeAnswerPure(latestRef.current, { correct })
        latestRef.current = result.state
        setProgress(result.state)
        return result.xpGained
      },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/state/ProgressContext.test.tsx`
Expected: PASS (both the existing StrictMode test and the new one)

- [ ] **Step 5: Commit**

```bash
git add src/state/ProgressContext.tsx src/state/ProgressContext.test.tsx
git commit -m "Expose recordPracticeAnswer through ProgressContext"
```

---

### Task 4: "Xuất tiến trình" export button

**Files:**
- Modify: `src/components/ProgressHeader.tsx`

**Interfaces:**
- Consumes: `progress: ProgressState` from `useProgress()` (already destructured in this file)
- Produces: nothing consumed by later tasks — this is a leaf UI change.

- [ ] **Step 1: Add the download helper and button**

Update the top of `src/components/ProgressHeader.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { useProgress } from '../state/ProgressContext'
import type { ProgressState } from '../state/types'

function downloadProgressExport(progress: ProgressState) {
  const blob = new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'sap-quest-progress.json'
  link.click()
  URL.revokeObjectURL(url)
}
```

Add the button inside the existing `<div className="flex items-center gap-2 ...">` block, right after the `🔥 {progress.streak}` `<span>`:

```tsx
        <button
          onClick={() => downloadProgressExport(progress)}
          title="Xuất tiến trình học (dùng với MCP server + Claude Desktop)"
          className="text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400"
        >
          ⬇️ <span className="hidden sm:inline">Xuất</span>
        </button>
```

- [ ] **Step 2: Manually verify in the browser**

Run: `npm run dev`

Open the printed local URL, click the "⬇️ Xuất" button in the header, and confirm a
`sap-quest-progress.json` file downloads containing the current `xp`/`streak`/`completedLessons`/
etc. fields. Stop the dev server afterward.

- [ ] **Step 3: Commit**

```bash
git add src/components/ProgressHeader.tsx
git commit -m "Add progress export button to header"
```

---

### Task 5: `GeneratedPracticeSet` type + content aggregator + schema tests

**Files:**
- Create: `src/content/generated/types.ts`
- Create: `src/content/generated/index.ts`
- Create: `src/content/generated/generated.test.ts`

**Interfaces:**
- Consumes: `QuizQuestion`, `ModuleId` from `../types`; `validateQuestion` from `../validateQuestion` (Task 1); `MODULE_ORDER`, `QUIZ_TRACKS` from `../index`
- Produces: `export interface GeneratedPracticeSet { id, title, moduleId, createdAt, note, questions }`; `export const GENERATED_SETS: GeneratedPracticeSet[]`; `export function findGeneratedSet(id: string): GeneratedPracticeSet | undefined` — Task 7's `PracticePage`/`PracticeRunnerPage` and the MCP server's `writePracticeSet`/`publishPracticeSet` (Tasks 10–11) rely on this exact file shape.

- [ ] **Step 1: Create `src/content/generated/types.ts`**

```typescript
import type { ModuleId, QuizQuestion } from '../types'

export interface GeneratedPracticeSet {
  id: string
  title: string
  moduleId: ModuleId
  createdAt: string
  note: string
  questions: QuizQuestion[]
}
```

- [ ] **Step 2: Create `src/content/generated/index.ts`**

```typescript
import type { GeneratedPracticeSet } from './types'

const modules = import.meta.glob('./*.json', { eager: true }) as Record<string, { default: GeneratedPracticeSet }>

export const GENERATED_SETS: GeneratedPracticeSet[] = Object.values(modules)
  .map((m) => m.default)
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

export function findGeneratedSet(id: string): GeneratedPracticeSet | undefined {
  return GENERATED_SETS.find((s) => s.id === id)
}
```

- [ ] **Step 3: Create `src/content/generated/generated.test.ts`**

```typescript
import { describe, expect, it } from 'vitest'
import { GENERATED_SETS } from './index'
import { validateQuestion } from '../validateQuestion'
import { MODULE_ORDER, QUIZ_TRACKS } from '../index'

describe('generated practice sets', () => {
  it('every set has a valid moduleId and at least one valid question', () => {
    for (const set of GENERATED_SETS) {
      expect(MODULE_ORDER.includes(set.moduleId), `${set.id}: invalid moduleId ${set.moduleId}`).toBe(true)
      expect(set.questions.length, `${set.id}: has no questions`).toBeGreaterThan(0)

      for (const q of set.questions) {
        const errors = validateQuestion(q)
        expect(errors, `${set.id}/${q.id}: ${errors.join('; ')}`).toEqual([])
      }
    }
  })

  it('generated question ids never collide with official quiz ids or each other', () => {
    const officialIds = new Set<string>()
    for (const moduleId of MODULE_ORDER) {
      for (const track of ['syntax', 'business'] as const) {
        for (const lesson of QUIZ_TRACKS[moduleId][track].lessons) {
          for (const q of lesson.questions) officialIds.add(q.id)
        }
      }
    }

    const seen = new Set<string>()
    for (const set of GENERATED_SETS) {
      for (const q of set.questions) {
        expect(officialIds.has(q.id), `${set.id}/${q.id} collides with an official quiz question id`).toBe(false)
        expect(seen.has(q.id), `duplicate generated question id: ${q.id}`).toBe(false)
        seen.add(q.id)
      }
    }
  })

  it('set ids are unique', () => {
    const ids = new Set(GENERATED_SETS.map((s) => s.id))
    expect(ids.size).toBe(GENERATED_SETS.length)
  })
})
```

This suite passes trivially with zero generated sets present (all loops are no-ops) — no fixture
file is needed; it becomes meaningful once the MCP server (Task 10) writes real files.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/content/generated/generated.test.ts`
Expected: PASS (3 tests, all vacuously true with no generated sets yet)

- [ ] **Step 5: Commit**

```bash
git add src/content/generated/
git commit -m "Add generated-practice-set content aggregator and schema tests"
```

---

### Task 6: Practice routes + navigation

**Files:**
- Create: `src/routes/PracticePage.tsx`
- Create: `src/routes/PracticeRunnerPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/ProgressHeader.tsx`

**Interfaces:**
- Consumes: `GENERATED_SETS`, `findGeneratedSet` from `../content/generated` (Task 5); `MODULES` from `../content`; `useProgress().recordPracticeAnswer` (Task 3); `QuestionCard` from `../components/QuestionCard` (existing, unchanged)
- Produces: routes `/practice` and `/practice/:setId` mounted in `App.tsx` — nothing later depends on this.

- [ ] **Step 1: Create `src/routes/PracticePage.tsx`**

```tsx
import { Link } from 'react-router-dom'
import { GENERATED_SETS } from '../content/generated'
import { MODULES } from '../content'

export function PracticePage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-extrabold mb-2">🎯 Luyện tập cá nhân hóa</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-8">
        Các bộ câu hỏi được soạn riêng dựa trên điểm yếu của bạn (qua Claude Desktop + MCP).
      </p>

      {GENERATED_SETS.length === 0 && (
        <p className="text-slate-500">Chưa có bộ luyện tập nào. Dùng Claude Desktop để tạo bộ đầu tiên.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {GENERATED_SETS.map((set) => (
          <Link
            key={set.id}
            to={`/practice/${set.id}`}
            className="rounded-xl border-2 border-slate-200 dark:border-slate-600 px-4 py-3 hover:border-sky-400 transition-colors"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="font-bold">{set.title}</p>
              <span className="shrink-0 text-xs rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5">
                {MODULES[set.moduleId].shortName}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{set.note}</p>
          </Link>
        ))}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Create `src/routes/PracticeRunnerPage.tsx`**

```tsx
import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { findGeneratedSet } from '../content/generated'
import { useProgress } from '../state/ProgressContext'
import { QuestionCard } from '../components/QuestionCard'

export function PracticeRunnerPage() {
  const { setId } = useParams<{ setId: string }>()
  const set = setId ? findGeneratedSet(setId) : undefined
  const { recordPracticeAnswer } = useProgress()

  const [index, setIndex] = useState(0)
  const [finished, setFinished] = useState(false)
  const xpEarnedRef = useRef(0)

  if (!set) {
    return (
      <main className="p-8 text-center">
        <p className="mb-4">Không tìm thấy bộ luyện tập này.</p>
        <Link to="/practice" className="text-sky-600 dark:text-sky-400 hover:underline">
          ← Quay lại luyện tập
        </Link>
      </main>
    )
  }

  function handleAnswered(correct: boolean) {
    xpEarnedRef.current += recordPracticeAnswer(correct)

    if (index + 1 < set!.questions.length) {
      setIndex((prev) => prev + 1)
      return
    }
    setFinished(true)
  }

  if (finished) {
    return (
      <main className="max-w-xl mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-extrabold mb-4">🎉 Hoàn thành!</h1>
        <p className="text-lg font-bold text-amber-500 mb-6">+{xpEarnedRef.current} XP</p>
        <Link
          to="/practice"
          className="inline-block rounded-xl bg-green-500 text-white font-extrabold uppercase tracking-wide px-6 py-3 hover:bg-green-600"
        >
          Quay lại luyện tập
        </Link>
      </main>
    )
  }

  return (
    <main className="px-4 py-8">
      <div className="max-w-xl mx-auto mb-4">
        <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${(index / set.questions.length) * 100}%` }}
          />
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Câu {index + 1}/{set.questions.length}
        </p>
      </div>
      <QuestionCard key={set.questions[index].id} question={set.questions[index]} onAnswered={handleAnswered} />
    </main>
  )
}
```

(The `set!` inside `handleAnswered` matches the existing `moduleId!` pattern already used in
`src/routes/LessonPage.tsx` for the same reason: TypeScript doesn't narrow a guard from the
component body into a nested function declaration.)

- [ ] **Step 3: Wire the routes into `src/App.tsx`**

Add imports:

```typescript
import { PracticePage } from './routes/PracticePage'
import { PracticeRunnerPage } from './routes/PracticeRunnerPage'
```

Add routes inside `<Routes>`, after the `/lab/:exerciseId` route:

```tsx
          <Route path="/practice" element={<PracticePage />} />
          <Route path="/practice/:setId" element={<PracticeRunnerPage />} />
```

- [ ] **Step 4: Add a nav link in `src/components/ProgressHeader.tsx`**

Add this `<Link>` right after the existing "🧪 Code Lab" link:

```tsx
        <Link to="/practice" className="text-sky-600 dark:text-sky-400 hover:underline" title="Luyện tập cá nhân hóa">
          🎯 <span className="hidden sm:inline">Luyện tập</span>
        </Link>
```

- [ ] **Step 5: Run the full test suite to confirm no regressions**

Run: `npx vitest run`
Expected: PASS (all existing suites, unaffected by these additive UI changes)

- [ ] **Step 6: Manually verify in the browser**

Run: `npm run dev`

Visit `/practice` — confirm it renders the "Chưa có bộ luyện tập nào" empty state and the new
"🎯 Luyện tập" header link navigates there. Stop the dev server afterward.

- [ ] **Step 7: Commit**

```bash
git add src/routes/PracticePage.tsx src/routes/PracticeRunnerPage.tsx src/App.tsx src/components/ProgressHeader.tsx
git commit -m "Add personalized practice routes and navigation"
```

---

### Task 7: MCP server scaffold + `list_modules` tool

**Files:**
- Create: `mcp-server/package.json`
- Create: `mcp-server/tsconfig.json`
- Create: `mcp-server/src/paths.ts`
- Create: `mcp-server/src/contentReaders.ts`
- Create: `mcp-server/src/index.ts`

**Interfaces:**
- Consumes: `MODULE_ORDER`, `MODULES`, `QUIZ_TRACKS`, `TABLES` from `../../src/content/index.js`; `ModuleId`, `Track` types from `../../src/content/types.js` (both already exist in the app)
- Produces: `REPO_ROOT`, `CONTENT_DIR`, `GENERATED_DIR`, `defaultProgressExportPath()` from `paths.ts`; `MODULE_ORDER`, `ModuleId`, `Track`, `listModules()`, `getQuizLessons()`, `getTables()`, `getExercises()` from `contentReaders.ts` — every later mcp-server task builds on these.

A note on why `contentReaders.ts` mixes two strategies: `../../src/content/index.js` only does
plain bare JSON imports (`import mmModule from './mm/module.json'`, no Vite-only syntax), and
`tsx` resolves and executes that fine outside Vite — verified by running
`npx tsx` against a throwaway script importing it before writing this task. `../../src/content/lab/index.js`,
by contrast, imports `.abap` files with Vite's `?raw` suffix, which is meaningless outside Vite's
bundler and throws `ERR_UNKNOWN_FILE_EXTENSION` under plain Node/tsx (also verified the same way).
So `getQuizLessons`/`getTables`/`listModules` import the real app content module directly (no
duplicated file-path logic), while `getExercises` reads `exercise.json` off disk with `fs`
because it cannot go through `content/lab/index.ts`.

- [ ] **Step 1: Create `mcp-server/package.json`**

```json
{
  "name": "sap-quest-mcp-server",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "start": "tsx src/index.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@types/node": "^24.13.2",
    "tsx": "^4.23.1",
    "typescript": "~6.0.2"
  }
}
```

- [ ] **Step 2: Create `mcp-server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "es2023",
    "lib": ["ES2023"],
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "types": ["node"],
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "strict": true,
    "esModuleInterop": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Install dependencies**

Run: `cd mcp-server && npm install`
Expected: `node_modules/` created inside `mcp-server/` with no errors (already covered by the root `.gitignore`'s bare `node_modules` pattern, which matches at any depth).

- [ ] **Step 4: Create `mcp-server/src/paths.ts`**

```typescript
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'

const here = path.dirname(fileURLToPath(import.meta.url))

export const REPO_ROOT = path.resolve(here, '../..')
export const CONTENT_DIR = path.join(REPO_ROOT, 'src', 'content')
export const GENERATED_DIR = path.join(CONTENT_DIR, 'generated')

export function defaultProgressExportPath(): string {
  return process.env.SAP_QUEST_PROGRESS_PATH ?? path.join(os.homedir(), 'Downloads', 'sap-quest-progress.json')
}
```

- [ ] **Step 5: Create `mcp-server/src/contentReaders.ts`**

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './paths.js'
import { MODULE_ORDER, MODULES, QUIZ_TRACKS, TABLES } from '../../src/content/index.js'
import type { ModuleId, Track } from '../../src/content/types.js'

export { MODULE_ORDER }
export type { ModuleId, Track }

export function listModules() {
  return MODULE_ORDER.map((id) => MODULES[id])
}

export function getQuizLessons(moduleId: ModuleId, track: Track) {
  return QUIZ_TRACKS[moduleId][track]
}

export function getTables(moduleId?: ModuleId) {
  const ids = moduleId ? [moduleId] : MODULE_ORDER
  return ids.flatMap((id) => TABLES[id])
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
}

export function getExercises() {
  const labDir = path.join(CONTENT_DIR, 'lab')
  const exerciseDirs = fs
    .readdirSync(labDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)

  return exerciseDirs.map((dir) => readJson(path.join(labDir, dir, 'exercise.json')))
}
```

- [ ] **Step 6: Create `mcp-server/src/index.ts` with just the `list_modules` tool**

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { listModules } from './contentReaders.js'

const server = new McpServer({ name: 'sap-quest', version: '0.1.0' })

server.registerTool(
  'list_modules',
  {
    title: 'List SAP modules',
    description: 'Trả về danh sách 5 module SAP Quest kèm mô tả nghiệp vụ',
    inputSchema: {},
  },
  async () => ({ content: [{ type: 'text', text: JSON.stringify(listModules(), null, 2) }] }),
)

const transport = new StdioServerTransport()
await server.connect(transport)
```

- [ ] **Step 7: Manually verify with the MCP Inspector**

Run: `cd mcp-server && npx @modelcontextprotocol/inspector npx tsx src/index.ts`

This opens a local web UI. Connect to the server, call `list_modules`, and confirm the response
is a JSON array of 5 objects (`mm`, `co`, `fi-gl`, `enterprise-structure`, `sd`), each with
`id`/`name`/`businessPurpose`. Close the inspector afterward (Ctrl+C).

- [ ] **Step 8: Commit (including the lockfile `npm install` created)**

```bash
git add mcp-server/package.json mcp-server/package-lock.json mcp-server/tsconfig.json mcp-server/src/paths.ts mcp-server/src/contentReaders.ts mcp-server/src/index.ts
git commit -m "Scaffold MCP server with list_modules tool"
```

---

### Task 8: `get_quiz_lessons`, `get_tables`, `get_exercises` tools

**Files:**
- Modify: `mcp-server/src/index.ts`

**Interfaces:**
- Consumes: `getQuizLessons`, `getTables`, `getExercises`, `MODULE_ORDER` from `./contentReaders.js` (Task 7)
- Produces: nothing new for later tasks — this task only adds more registered tools.

- [ ] **Step 1: Add the three tools to `mcp-server/src/index.ts`**

Update the import line:

```typescript
import { getExercises, getQuizLessons, getTables, listModules, MODULE_ORDER } from './contentReaders.js'
```

Add `import { z } from 'zod'` at the top, and this constant right after the `server` declaration:

```typescript
const moduleIdEnum = z.enum(MODULE_ORDER)
```

Add the three tools after the `list_modules` registration:

```typescript
server.registerTool(
  'get_quiz_lessons',
  {
    title: 'Get quiz lessons',
    description: 'Trả về toàn bộ lesson và câu hỏi hiện có của 1 module + track',
    inputSchema: { moduleId: moduleIdEnum, track: z.enum(['syntax', 'business']) },
  },
  async ({ moduleId, track }) => ({
    content: [{ type: 'text', text: JSON.stringify(getQuizLessons(moduleId, track), null, 2) }],
  }),
)

server.registerTool(
  'get_tables',
  {
    title: 'Get wiki tables',
    description: 'Trả về bảng wiki SAP (ngữ cảnh nghiệp vụ) của 1 module, hoặc tất cả nếu không truyền moduleId',
    inputSchema: { moduleId: moduleIdEnum.optional() },
  },
  async ({ moduleId }) => ({ content: [{ type: 'text', text: JSON.stringify(getTables(moduleId), null, 2) }] }),
)

server.registerTool(
  'get_exercises',
  {
    title: 'Get Code Lab exercises',
    description: 'Trả về metadata các bài tập Code Lab hiện có',
    inputSchema: {},
  },
  async () => ({ content: [{ type: 'text', text: JSON.stringify(getExercises(), null, 2) }] }),
)
```

- [ ] **Step 2: Manually verify with the MCP Inspector**

Run: `cd mcp-server && npx @modelcontextprotocol/inspector npx tsx src/index.ts`

Call `get_quiz_lessons` with `{ "moduleId": "mm", "track": "syntax" }` — confirm the response has
a `lessons` array of 3 lessons, 8 questions each. Call `get_tables` with no arguments — confirm
it returns tables from all 5 modules. Call `get_exercises` — confirm 17 exercise objects come
back. Close the inspector afterward.

- [ ] **Step 3: Commit**

```bash
git add mcp-server/src/index.ts
git commit -m "Add get_quiz_lessons, get_tables, get_exercises MCP tools"
```

---

### Task 9: `read_progress_export` tool

**Files:**
- Create: `mcp-server/src/progressExport.ts`
- Modify: `mcp-server/src/index.ts`

**Interfaces:**
- Consumes: `defaultProgressExportPath`, `CONTENT_DIR` from `./paths.js` (Task 7)
- Produces: `export function readProgressExport(overridePath?: string): { xp, completedLessons, reviewPool (joined with question content), perfectLessons, lastActiveDate, streak, badges }` — no later task depends on this beyond `index.ts` wiring.

- [ ] **Step 1: Create `mcp-server/src/progressExport.ts`**

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR, defaultProgressExportPath } from './paths.js'
import type { ProgressState } from '../../src/state/types.js'

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
}

function findQuestionInModule(moduleId: string, questionId: string) {
  for (const track of ['syntax', 'business']) {
    const file = readJson<{ lessons: { questions: { id: string }[] }[] }>(
      path.join(CONTENT_DIR, moduleId, `quiz-${track}.json`),
    )
    for (const lesson of file.lessons) {
      const found = lesson.questions.find((q) => q.id === questionId)
      if (found) return found
    }
  }
  return undefined
}

export function readProgressExport(overridePath?: string) {
  const filePath = overridePath ?? defaultProgressExportPath()
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Không tìm thấy file progress export tại ${filePath}. Hãy bấm nút "Xuất tiến trình" trên web trước, hoặc truyền path khác.`,
    )
  }

  const progress = readJson<ProgressState>(filePath)

  const reviewPoolWithContent = Object.fromEntries(
    Object.entries(progress.reviewPool).map(([moduleId, entries]) => [
      moduleId,
      entries.map((entry) => ({
        ...entry,
        question: findQuestionInModule(moduleId, entry.questionId),
      })),
    ]),
  )

  return { ...progress, reviewPool: reviewPoolWithContent }
}
```

- [ ] **Step 2: Register the tool in `mcp-server/src/index.ts`**

Add the import:

```typescript
import { readProgressExport } from './progressExport.js'
```

Add the tool registration:

```typescript
server.registerTool(
  'read_progress_export',
  {
    title: 'Read progress export',
    description: 'Đọc file progress đã xuất từ web, kèm nội dung câu hỏi trong reviewPool',
    inputSchema: { path: z.string().optional() },
  },
  async ({ path }) => ({ content: [{ type: 'text', text: JSON.stringify(readProgressExport(path), null, 2) }] }),
)
```

- [ ] **Step 3: Manually verify with a real export file**

In the browser (from Task 4's dev server, or the deployed site), click "⬇️ Xuất" to download
`sap-quest-progress.json`, then move it to the default lookup location for your OS (Windows:
`C:\Users\<you>\Downloads\sap-quest-progress.json` — it likely already landed there).

Run: `cd mcp-server && npx @modelcontextprotocol/inspector npx tsx src/index.ts`

Call `read_progress_export` with no arguments — confirm it returns your real `xp`/`streak` and,
if you have any wrong answers recorded, a `reviewPool` entry with a nested `question` object
(not `undefined`). Close the inspector afterward.

- [ ] **Step 4: Commit**

```bash
git add mcp-server/src/progressExport.ts mcp-server/src/index.ts
git commit -m "Add read_progress_export MCP tool"
```

---

### Task 10: `write_practice_set` tool

**Files:**
- Create: `mcp-server/src/writePracticeSet.ts`
- Modify: `mcp-server/src/index.ts`

**Interfaces:**
- Consumes: `GENERATED_DIR` from `./paths.js` (Task 7); `validateQuestion` from `../../src/content/validateQuestion.js` (Task 1); `QuizQuestion` type from `../../src/content/types.js`
- Produces: `export interface WritePracticeSetInput { id, title, moduleId, note, questions }`, `export function writePracticeSet(input: WritePracticeSetInput): { filePath: string }` — Task 11's `publish_practice_set` reads the file this writes.

- [ ] **Step 1: Create `mcp-server/src/writePracticeSet.ts`**

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { GENERATED_DIR } from './paths.js'
import { validateQuestion } from '../../src/content/validateQuestion.js'
import type { QuizQuestion } from '../../src/content/types.js'

export interface WritePracticeSetInput {
  id: string
  title: string
  moduleId: string
  note: string
  questions: QuizQuestion[]
}

export function writePracticeSet(input: WritePracticeSetInput): { filePath: string } {
  if (!/^[a-z0-9-]+$/.test(input.id)) {
    throw new Error(`id "${input.id}" không hợp lệ — chỉ dùng chữ thường, số, dấu gạch ngang`)
  }

  const errors = input.questions.flatMap((q) => validateQuestion(q))
  if (input.questions.length === 0) {
    errors.push('questions không được rỗng')
  }
  if (errors.length > 0) {
    throw new Error(`Câu hỏi không hợp lệ:\n${errors.join('\n')}`)
  }

  if (!fs.existsSync(GENERATED_DIR)) {
    fs.mkdirSync(GENERATED_DIR, { recursive: true })
  }

  const filePath = path.join(GENERATED_DIR, `${input.id}.json`)
  const payload = {
    id: input.id,
    title: input.title,
    moduleId: input.moduleId,
    createdAt: new Date().toISOString().slice(0, 10),
    note: input.note,
    questions: input.questions,
  }
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf-8')

  return { filePath }
}
```

- [ ] **Step 2: Register the tool in `mcp-server/src/index.ts`**

Add the imports:

```typescript
import { writePracticeSet } from './writePracticeSet.js'
import type { QuizQuestion } from '../../src/content/types.js'
```

Add this constant near the top (a loose schema — real validation happens inside
`writePracticeSet` via the shared `validateQuestion`, so the Zod shape here only needs to ensure
"an array of objects" crossed the MCP boundary, not fully mirror the `QuizQuestion` discriminated
union):

```typescript
const looseQuestionSchema = z.record(z.string(), z.unknown())
```

Add the tool registration:

```typescript
server.registerTool(
  'write_practice_set',
  {
    title: 'Write practice set draft',
    description: 'Ghi 1 bộ câu hỏi luyện tập mới vào src/content/generated (chưa commit)',
    inputSchema: {
      id: z.string(),
      title: z.string(),
      moduleId: moduleIdEnum,
      note: z.string(),
      questions: z.array(looseQuestionSchema),
    },
  },
  async ({ id, title, moduleId, note, questions }) => {
    const result = writePracticeSet({
      id,
      title,
      moduleId,
      note,
      questions: questions as unknown as QuizQuestion[],
    })
    return { content: [{ type: 'text', text: `Đã ghi nháp tại ${result.filePath}` }] }
  },
)
```

- [ ] **Step 3: Manually verify with the MCP Inspector**

Run: `cd mcp-server && npx @modelcontextprotocol/inspector npx tsx src/index.ts`

Call `write_practice_set` with a small valid payload, e.g.:

```json
{
  "id": "smoke-test-set",
  "title": "Smoke test",
  "moduleId": "mm",
  "note": "manual verification",
  "questions": [
    {
      "id": "smoke-q1",
      "type": "true-false",
      "difficulty": "basic",
      "explanation": "test",
      "statement": "test",
      "answer": true
    }
  ]
}
```

Confirm it reports the file path, and that `src/content/generated/smoke-test-set.json` now
exists with that content. Then call it again with an invalid question (e.g. missing
`explanation`) and confirm it returns a validation error instead of writing a file.

Run: `npx vitest run src/content/generated/generated.test.ts`
Expected: PASS — the smoke-test file you just wrote passes schema validation.

Delete the smoke-test file afterward so it doesn't linger as fake content:

Run: `rm src/content/generated/smoke-test-set.json` (or delete it via your editor)

- [ ] **Step 4: Commit**

```bash
git add mcp-server/src/writePracticeSet.ts mcp-server/src/index.ts
git commit -m "Add write_practice_set MCP tool"
```

---

### Task 11: `publish_practice_set` tool

**Files:**
- Create: `mcp-server/src/publishPracticeSet.ts`
- Modify: `mcp-server/src/index.ts`

**Interfaces:**
- Consumes: `GENERATED_DIR`, `REPO_ROOT` from `./paths.js` (Task 7); `validateQuestion` from `../../src/content/validateQuestion.js` (Task 1); the file `write_practice_set` (Task 10) wrote
- Produces: `export function publishPracticeSet(id: string): { commitHash: string }` — no later task depends on this.

- [ ] **Step 1: Create `mcp-server/src/publishPracticeSet.ts`**

```typescript
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { GENERATED_DIR, REPO_ROOT } from './paths.js'
import { validateQuestion } from '../../src/content/validateQuestion.js'
import type { QuizQuestion } from '../../src/content/types.js'

interface GeneratedSetFile {
  id: string
  questions: QuizQuestion[]
}

export function publishPracticeSet(id: string): { commitHash: string } {
  if (!/^[a-z0-9-]+$/.test(id)) {
    throw new Error(`id "${id}" không hợp lệ — chỉ dùng chữ thường, số, dấu gạch ngang`)
  }

  const filePath = path.join(GENERATED_DIR, `${id}.json`)
  if (!fs.existsSync(filePath)) {
    throw new Error(`Không tìm thấy file nháp ${filePath}. Gọi write_practice_set trước.`)
  }

  const set = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as GeneratedSetFile
  const errors = set.questions.flatMap((q) => validateQuestion(q))
  if (errors.length > 0) {
    throw new Error(`File không hợp lệ, không publish:\n${errors.join('\n')}`)
  }

  const testResult = runGeneratedContentTests()
  if (!testResult.success) {
    throw new Error(`Test thất bại, không publish:\n${testResult.output}`)
  }

  const relativePath = path.relative(REPO_ROOT, filePath).replace(/\\/g, '/')
  execSync(`git add ${relativePath}`, { cwd: REPO_ROOT })
  execSync(`git commit -m "Add generated practice set: ${id}"`, { cwd: REPO_ROOT })
  execSync('git push origin main', { cwd: REPO_ROOT })

  const commitHash = execSync('git rev-parse HEAD', { cwd: REPO_ROOT, encoding: 'utf-8' }).trim()
  return { commitHash }
}

function runGeneratedContentTests(): { success: boolean; output: string } {
  try {
    const output = execSync('npx vitest run src/content/generated/generated.test.ts', {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
    })
    return { success: true, output }
  } catch (err) {
    const execErr = err as { stdout?: string; message: string }
    return { success: false, output: execErr.stdout ?? execErr.message }
  }
}
```

Both `id` (the tool input) and the file's own `set.id` are validated against the same
`[a-z0-9-]+` slug pattern before being interpolated into any shell string, so there's no command
injection path even though `execSync` runs through a shell (needed on Windows so `git`/`npx`
resolve correctly).

- [ ] **Step 2: Register the tool in `mcp-server/src/index.ts`**

Add the import:

```typescript
import { publishPracticeSet } from './publishPracticeSet.js'
```

Add the tool registration:

```typescript
server.registerTool(
  'publish_practice_set',
  {
    title: 'Publish practice set',
    description: 'Validate + chạy test + commit & push bộ câu hỏi đã ghi lên main',
    inputSchema: { id: z.string() },
  },
  async ({ id }) => {
    const result = publishPracticeSet(id)
    return { content: [{ type: 'text', text: `Đã publish, commit ${result.commitHash}` }] }
  },
)
```

- [ ] **Step 3: Manually verify end-to-end on a throwaway set**

Run: `cd mcp-server && npx @modelcontextprotocol/inspector npx tsx src/index.ts`

Call `write_practice_set` with the same smoke-test payload from Task 10, then call
`publish_practice_set` with `{ "id": "smoke-test-set" }`. Confirm it reports a commit hash.

Run: `git log --oneline -1` and `git status`
Expected: the top commit is `Add generated practice set: smoke-test-set`, working tree clean,
and (if you have push access configured) the commit is now on `origin/main`.

Since this was only a manual smoke test, revert it afterward so `main` doesn't keep fake content:

```bash
git revert --no-edit HEAD
git push origin main
```

- [ ] **Step 4: Commit**

```bash
git add mcp-server/src/publishPracticeSet.ts mcp-server/src/index.ts
git commit -m "Add publish_practice_set MCP tool"
```

---

### Task 12: `mcp-server/README.md` + final review

**Files:**
- Create: `mcp-server/README.md`

**Interfaces:**
- Consumes: nothing (documentation only)
- Produces: nothing (terminal task)

- [ ] **Step 1: Create `mcp-server/README.md`**

```markdown
# SAP Quest MCP Server

Cho Claude Desktop đọc nội dung SAP Quest (module/quiz/wiki/exercise), đọc file progress đã
xuất, và soạn + xuất bản bộ câu hỏi luyện tập cá nhân hóa.

## Cài đặt

    cd mcp-server
    npm install

## Cấu hình Claude Desktop

Mở `claude_desktop_config.json` (Settings → Developer → Edit Config trong Claude Desktop) và
thêm một entry trong `mcpServers`:

    {
      "mcpServers": {
        "sap-quest": {
          "command": "npx",
          "args": ["tsx", "<đường dẫn tuyệt đối tới repo>/mcp-server/src/index.ts"],
          "env": {
            "SAP_QUEST_PROGRESS_PATH": "<tùy chọn — mặc định ~/Downloads/sap-quest-progress.json>"
          }
        }
      }
    }

Khởi động lại Claude Desktop sau khi lưu file.

## Quy trình dùng

1. Trên web SAP Quest, bấm nút "⬇️ Xuất" ở header để tải `sap-quest-progress.json`.
2. Trong Claude Desktop, hỏi Claude phân tích điểm yếu — nó tự gọi `read_progress_export`,
   `get_quiz_lessons`, `get_tables` để có đủ ngữ cảnh.
3. Yêu cầu Claude soạn 1 bộ luyện tập mới — nó gọi `write_practice_set` để ghi file nháp vào
   `src/content/generated/`.
4. Xem lại nội dung nháp (tự đọc file, hoặc hỏi Claude tóm tắt lại); nếu ổn, bảo Claude
   "publish đi" — nó gọi `publish_practice_set` để validate, chạy test, rồi commit + push lên
   `main`.
5. Đợi GitHub Actions build xong (vài chục giây đến vài phút), hoặc chạy `npm run dev`/
   `npm run preview` ở thư mục gốc repo để thấy ngay lập tức — vào `/practice` trên web để làm
   bộ câu hỏi mới.

## Tool có sẵn

| Tool | Việc làm |
|---|---|
| `list_modules` | 5 module SAP Quest |
| `get_quiz_lessons(moduleId, track)` | Toàn bộ lesson/câu hỏi hiện có |
| `get_tables(moduleId?)` | Bảng wiki nghiệp vụ |
| `get_exercises()` | Metadata bài tập Code Lab |
| `read_progress_export(path?)` | Tiến trình học đã xuất, kèm câu hỏi trong reviewPool |
| `write_practice_set(id, title, moduleId, note, questions)` | Ghi bộ câu hỏi nháp |
| `publish_practice_set(id)` | Validate + test + commit + push lên `main` |
```

- [ ] **Step 2: Run the entire app test suite one last time**

Run: `npx vitest run`
Expected: PASS — every suite (`content.test.ts`, `generated.test.ts`, `lab.test.ts`,
`progress.test.ts`, `ProgressContext.test.tsx`, `quizScoring.test.ts`, `abapLint.test.ts`) green.

- [ ] **Step 3: Run the production build to confirm the new route/aggregator compile cleanly**

Run: `npm run build`
Expected: succeeds, `dist/` produced with no TypeScript errors (this exercises
`import.meta.glob` and the new routes through the real Vite build, not just dev mode).

- [ ] **Step 4: Commit**

```bash
git add mcp-server/README.md
git commit -m "Add mcp-server README with Claude Desktop setup instructions"
```
