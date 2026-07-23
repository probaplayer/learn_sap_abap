# Remove Syntax Quiz Track Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drop the "syntax" quiz track entirely across all 5 SAP modules, collapsing the app's
2-track model (`syntax`/`business`) down to a single business-focused lesson list per module.
Code Lab (`/lab`) is untouched — this only affects the Quiz feature.

**Architecture:** Delete `quiz-syntax.json` and rename `quiz-business.json` → `quiz.json` per
module, drop the `Track` type everywhere it appears (content schema, routing, state keys,
badges), and collapse `${moduleId}:${track}:${lessonId}` progress keys down to
`${moduleId}:${lessonId}`.

**Tech Stack:** React 19 + TypeScript, Vitest (existing stack). Corresponding design:
[docs/superpowers/specs/2026-07-23-progress-autosync-and-content-authoring-design.md](../specs/2026-07-23-progress-autosync-and-content-authoring-design.md), Phần B. This plan must land
**before** [2026-07-23-mcp-content-authoring.md](2026-07-23-mcp-content-authoring.md), which
builds on the single-track schema this plan produces.

## Global Constraints

- No migration for existing users' `localStorage` progress — old keys like
  `mm:business:lesson-1` simply stop matching anything; this is an accepted, user-confirmed
  trade-off (spec §7). Do not write any migration code.
- Every module keeps exactly 3 lessons of exactly 8 questions each in this plan (loosening to
  "≥3 lessons" is explicitly deferred to the next plan, spec §4.2 — do not change that
  assertion here).
- Code Lab (`src/content/lab/**`, `LabPage.tsx`, `LabDetailPage.tsx`) is out of scope — do not
  touch it.

---

## File Structure

- **Content data:** delete `src/content/<id>/quiz-syntax.json`, rename
  `src/content/<id>/quiz-business.json` → `src/content/<id>/quiz.json` (drop the `track` field
  inside it) for `id` in `mm`, `co`, `fi-gl`, `enterprise-structure`, `sd`.
- **Modify `src/content/types.ts`** — remove `Track`, rename `QuizTrackFile` → `QuizFile`
  (drops the `track` field).
- **Modify `src/content/index.ts`** — `QUIZ_TRACKS` → `QUIZ_LESSONS: Record<ModuleId,
  Lesson[]>`; every helper (`getLessons`, `getLessonIds`, `getLesson`, `findQuestion`) drops its
  `track` parameter; `getAllLessonsByModuleTrack` → `getAllLessonsByModule`.
- **Modify `src/content/content.test.ts`, `src/content/generated/generated.test.ts`** — drop
  the loop over `['syntax', 'business']`.
- **Modify `src/App.tsx`** — route `/lesson/:moduleId/:track/:lessonId` →
  `/lesson/:moduleId/:lessonId`.
- **Modify `src/routes/ModulePage.tsx`, `src/routes/LessonPage.tsx`, `src/routes/MapPage.tsx`**
  — drop the `track` concept (single lesson column, single URL segment).
- **Modify `src/state/progress.ts`** — `lessonKey`, `isLessonUnlocked`, `CompleteLessonParams`
  drop `track`; badge logic collapses `track-complete:<id>:<track>` +
  `module-master:<id>` into one `module-complete:<id>`.
- **Modify `src/state/ProgressContext.tsx`** — `CompleteLessonArgs`, `isLessonUnlocked` wrapper
  drop `track`.
- **Modify `src/state/progress.test.ts`, `src/state/ProgressContext.test.tsx`** — update to the
  new signatures.
- **Modify `mcp-server/src/contentReaders.ts`, `mcp-server/src/progressExport.ts`,
  `mcp-server/src/index.ts`** — `get_quiz_lessons` drops `track`; `readProgressExport` reads a
  single `quiz.json` instead of looping `quiz-${track}.json`.
- **Modify `CLAUDE.md`** — update the Architecture section's description of the 2-track model.

## Task 1: Content schema — collapse to a single track

**Files:**
- Modify (delete): `src/content/{mm,co,fi-gl,enterprise-structure,sd}/quiz-syntax.json`
- Modify (rename): `src/content/{mm,co,fi-gl,enterprise-structure,sd}/quiz-business.json` →
  `.../quiz.json`
- Modify: `src/content/types.ts`
- Modify: `src/content/index.ts`
- Test: `src/content/content.test.ts`, `src/content/generated/generated.test.ts`

**Interfaces:**
- Produces: `QuizFile` (type, replaces `QuizTrackFile`), `QUIZ_LESSONS: Record<ModuleId,
  Lesson[]>` (replaces `QUIZ_TRACKS`), `getLessons(moduleId)`, `getLessonIds(moduleId)`,
  `getLesson(moduleId, lessonId)`, `findQuestion(moduleId, questionId)`,
  `getAllLessonsByModule(): Record<string, string[]>` (all drop the `track` parameter they used
  to take; `getAllLessonsByModule` replaces `getAllLessonsByModuleTrack`).

- [ ] **Step 1: Rewrite the tests to expect the single-track shape (red)**

Replace `src/content/content.test.ts` in full:

```typescript
import { describe, expect, it } from 'vitest'
import { MODULE_ORDER, MODULES, QUIZ_LESSONS, TABLES } from './index'
import { validateQuestion } from './validateQuestion'

describe('content schema validation', () => {
  it('every module has a module.json with matching id', () => {
    for (const moduleId of MODULE_ORDER) {
      expect(MODULES[moduleId].id).toBe(moduleId)
      expect(MODULES[moduleId].name.length).toBeGreaterThan(0)
      expect(MODULES[moduleId].businessPurpose.length).toBeGreaterThan(0)
    }
  })

  it('every table entry belongs to its module and has key fields', () => {
    for (const moduleId of MODULE_ORDER) {
      expect(TABLES[moduleId].length).toBeGreaterThan(0)
      for (const table of TABLES[moduleId]) {
        expect(table.module).toBe(moduleId)
        expect(table.id.length).toBeGreaterThan(0)
        expect(table.keyFields.length).toBeGreaterThan(0)
      }
    }
  })

  it('every module has 3 lessons of 8 questions each, all valid', () => {
    const allIds = new Set<string>()

    for (const moduleId of MODULE_ORDER) {
      const lessons = QUIZ_LESSONS[moduleId]
      expect(lessons.length).toBe(3)

      for (const lesson of lessons) {
        expect(lesson.questions.length).toBe(8)

        for (const q of lesson.questions) {
          const errors = validateQuestion(q)
          expect(errors, `${moduleId}/${lesson.id}: ${errors.join('; ')}`).toEqual([])

          expect(allIds.has(q.id), `duplicate question id: ${q.id}`).toBe(false)
          allIds.add(q.id)
        }
      }
    }
  })

  it('related tables reference tables that actually exist somewhere', () => {
    const allTableIds = new Set(MODULE_ORDER.flatMap((m) => TABLES[m].map((t) => t.id.toUpperCase())))
    for (const moduleId of MODULE_ORDER) {
      for (const table of TABLES[moduleId]) {
        for (const rid of table.relatedTables) {
          expect(allTableIds.has(rid.toUpperCase()), `${moduleId}/${table.id} -> unknown related table ${rid}`).toBe(
            true,
          )
        }
      }
    }
  })
})
```

Replace `src/content/generated/generated.test.ts` in full:

```typescript
import { describe, expect, it } from 'vitest'
import { GENERATED_SETS } from './index'
import { validateQuestion } from '../validateQuestion'
import { MODULE_ORDER, QUIZ_LESSONS } from '../index'

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
      for (const lesson of QUIZ_LESSONS[moduleId]) {
        for (const q of lesson.questions) officialIds.add(q.id)
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

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/content/content.test.ts src/content/generated/generated.test.ts`
Expected: FAIL — `QUIZ_LESSONS` is not exported from `./index` yet.

- [ ] **Step 3: Migrate the content files**

Run:

```bash
node -e "
const fs = require('fs');
const path = require('path');
const modules = ['mm', 'co', 'fi-gl', 'enterprise-structure', 'sd'];
for (const m of modules) {
  const dir = path.join('src', 'content', m);
  const businessPath = path.join(dir, 'quiz-business.json');
  const data = JSON.parse(fs.readFileSync(businessPath, 'utf-8'));
  delete data.track;
  fs.writeFileSync(path.join(dir, 'quiz.json'), JSON.stringify(data, null, 2) + '\n');
  fs.unlinkSync(businessPath);
  fs.unlinkSync(path.join(dir, 'quiz-syntax.json'));
}
console.log('migrated 5 modules');
"
```

Expected output: `migrated 5 modules`. Verify with `ls src/content/mm` that only `quiz.json`
remains (no `quiz-business.json`/`quiz-syntax.json`).

- [ ] **Step 4: Update `types.ts`**

In `src/content/types.ts`, remove line 2 (`export type Track = 'syntax' | 'business'`) and
replace the `QuizTrackFile` interface:

```typescript
// remove this interface:
// export interface QuizTrackFile {
//   moduleId: ModuleId
//   track: Track
//   lessons: Lesson[]
// }

// with:
export interface QuizFile {
  moduleId: ModuleId
  lessons: Lesson[]
}
```

- [ ] **Step 5: Rewrite `src/content/index.ts`**

Replace the file in full:

```typescript
import type { ModuleId, ModuleInfo, TableEntry, QuizFile, Lesson, QuizQuestion } from './types'

import mmModule from './mm/module.json'
import mmTables from './mm/tables.json'
import mmQuiz from './mm/quiz.json'

import coModule from './co/module.json'
import coTables from './co/tables.json'
import coQuiz from './co/quiz.json'

import fiGlModule from './fi-gl/module.json'
import fiGlTables from './fi-gl/tables.json'
import fiGlQuiz from './fi-gl/quiz.json'

import esModule from './enterprise-structure/module.json'
import esTables from './enterprise-structure/tables.json'
import esQuiz from './enterprise-structure/quiz.json'

import sdModule from './sd/module.json'
import sdTables from './sd/tables.json'
import sdQuiz from './sd/quiz.json'

export const MODULE_ORDER: ModuleId[] = ['enterprise-structure', 'mm', 'co', 'fi-gl', 'sd']

export const MODULES: Record<ModuleId, ModuleInfo> = {
  mm: mmModule as ModuleInfo,
  co: coModule as ModuleInfo,
  'fi-gl': fiGlModule as ModuleInfo,
  'enterprise-structure': esModule as ModuleInfo,
  sd: sdModule as ModuleInfo,
}

export const TABLES: Record<ModuleId, TableEntry[]> = {
  mm: mmTables as TableEntry[],
  co: coTables as TableEntry[],
  'fi-gl': fiGlTables as TableEntry[],
  'enterprise-structure': esTables as TableEntry[],
  sd: sdTables as TableEntry[],
}

export const QUIZ_LESSONS: Record<ModuleId, Lesson[]> = {
  mm: (mmQuiz as QuizFile).lessons,
  co: (coQuiz as QuizFile).lessons,
  'fi-gl': (fiGlQuiz as QuizFile).lessons,
  'enterprise-structure': (esQuiz as QuizFile).lessons,
  sd: (sdQuiz as QuizFile).lessons,
}

export function getAllTables(): TableEntry[] {
  return MODULE_ORDER.flatMap((id) => TABLES[id])
}

export function findTable(moduleId: ModuleId, tableId: string): TableEntry | undefined {
  return TABLES[moduleId]?.find((t) => t.id.toUpperCase() === tableId.toUpperCase())
}

export function findTableAnyModule(tableId: string): TableEntry | undefined {
  return getAllTables().find((t) => t.id.toUpperCase() === tableId.toUpperCase())
}

export function getLessons(moduleId: ModuleId): Lesson[] {
  return QUIZ_LESSONS[moduleId]
}

export function getLessonIds(moduleId: ModuleId): string[] {
  return getLessons(moduleId).map((l) => l.id)
}

export function getLesson(moduleId: ModuleId, lessonId: string): Lesson | undefined {
  return getLessons(moduleId).find((l) => l.id === lessonId)
}

export function findQuestion(moduleId: ModuleId, questionId: string): QuizQuestion | undefined {
  for (const lesson of getLessons(moduleId)) {
    const found = lesson.questions.find((q) => q.id === questionId)
    if (found) return found
  }
  return undefined
}

export function getAllLessonsByModule(): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const moduleId of MODULE_ORDER) {
    result[moduleId] = getLessonIds(moduleId)
  }
  return result
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/content/content.test.ts src/content/generated/generated.test.ts`
Expected: PASS (all tests)

- [ ] **Step 7: Commit**

```bash
git add src/content
git commit -m "refactor: collapse quiz content schema to a single track"
```

## Task 2: UI — drop the track segment from routing, ModulePage, LessonPage, MapPage

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/routes/ModulePage.tsx`
- Modify: `src/routes/LessonPage.tsx`
- Modify: `src/routes/MapPage.tsx`

**Interfaces:**
- Consumes: `getLessons(moduleId)`, `getLessonIds(moduleId)`, `getLesson(moduleId, lessonId)`,
  `findQuestion(moduleId, questionId)`, `getAllLessonsByModule()` (Task 1)

No automated test exists for these route components in this repo (only content-data and
state-hook tests exist) — verified manually in Step 6.

- [ ] **Step 1: Update the route in `src/App.tsx`**

Change:
```tsx
<Route path="/lesson/:moduleId/:track/:lessonId" element={<LessonPage />} />
```
to:
```tsx
<Route path="/lesson/:moduleId/:lessonId" element={<LessonPage />} />
```

- [ ] **Step 2: Rewrite `src/routes/ModulePage.tsx`**

Replace the file in full:

```tsx
import { useNavigate, useParams } from 'react-router-dom'
import type { ModuleId } from '../content/types'
import { MODULES, getLessons } from '../content'
import { lessonKey } from '../state/progress'
import { useProgress } from '../state/ProgressContext'
import { MapNode } from '../components/MapNode'
import type { NodeState } from '../components/MapNode'

export function ModulePage() {
  const { moduleId } = useParams<{ moduleId: ModuleId }>()
  const navigate = useNavigate()
  const { progress, isLessonUnlocked, reviewQuestionIds } = useProgress()

  if (!moduleId || !MODULES[moduleId]) {
    return <main className="p-8 text-center">Không tìm thấy module.</main>
  }

  const mod = MODULES[moduleId]
  const reviewCount = reviewQuestionIds(moduleId).length
  const lessons = getLessons(moduleId)
  const lessonIds = lessons.map((l) => l.id)

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-2 flex-wrap">
          <span>{mod.icon}</span> <span>{mod.name}</span>
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">{mod.businessPurpose}</p>
      </div>

      <div className="flex flex-col items-center gap-2 mb-8">
        <MapNode
          label="Ôn tập"
          state={reviewCount > 0 ? 'unlocked' : 'locked'}
          icon="🔁"
          onClick={() => reviewCount > 0 && navigate(`/lesson/${moduleId}/review`)}
        />
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          🔁 Ôn tập {reviewCount > 0 ? `(${reviewCount})` : ''}
        </span>
      </div>

      <div className="flex flex-col items-center gap-6">
        {lessons.map((lesson) => {
          const key = lessonKey(moduleId, lesson.id)
          const unlocked = isLessonUnlocked(moduleId, lessonIds, lesson.id)
          const done = progress.completedLessons.includes(key)
          const perfect = progress.perfectLessons.includes(key)

          let state: NodeState = 'locked'
          if (perfect) state = 'perfect'
          else if (done) state = 'completed'
          else if (unlocked) state = 'unlocked'

          return (
            <div key={lesson.id} className="flex flex-col items-center gap-1">
              <MapNode
                label={lesson.title}
                state={state}
                onClick={() => navigate(`/lesson/${moduleId}/${lesson.id}`)}
              />
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center w-24">
                {lesson.title}
              </span>
            </div>
          )
        })}
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Rewrite `src/routes/LessonPage.tsx`**

Replace the file in full:

```tsx
import { useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { ModuleId, QuizQuestion } from '../content/types'
import { MODULES, findQuestion, getAllLessonsByModule, getLesson } from '../content'
import { useProgress } from '../state/ProgressContext'
import { QuestionCard } from '../components/QuestionCard'

export function LessonPage() {
  const { moduleId, lessonId } = useParams<{ moduleId: ModuleId; lessonId: string }>()
  const { reviewQuestionIds, recordAnswer, completeLesson } = useProgress()

  const isReview = lessonId === 'review'

  const questions: QuizQuestion[] = useMemo(() => {
    if (!moduleId) return []
    if (isReview) {
      return reviewQuestionIds(moduleId)
        .map((qid) => findQuestion(moduleId, qid))
        .filter((q): q is QuizQuestion => Boolean(q))
    }
    if (!lessonId) return []
    return getLesson(moduleId, lessonId)?.questions ?? []
    // reviewQuestionIds intentionally excluded: pool is only read once when the lesson starts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId, lessonId, isReview])

  const [index, setIndex] = useState(0)
  const [finished, setFinished] = useState(false)
  const [summary, setSummary] = useState({ xpEarned: 0, mistakeCount: 0, newBadges: [] as string[] })

  const mistakeCountRef = useRef(0)
  const xpEarnedRef = useRef(0)

  if (!moduleId || !MODULES[moduleId]) {
    return <main className="p-8 text-center">Không tìm thấy module.</main>
  }

  if (questions.length === 0) {
    return (
      <main className="p-8 text-center">
        <p className="mb-4">Không có câu hỏi nào ở đây.</p>
        <Link to={`/module/${moduleId}`} className="text-sky-600 dark:text-sky-400 hover:underline">
          ← Quay lại module
        </Link>
      </main>
    )
  }

  function handleAnswered(correct: boolean) {
    const question = questions[index]
    const xp = recordAnswer({
      moduleId: moduleId!,
      questionId: question.id,
      correct,
      isReview,
    })
    xpEarnedRef.current += xp
    if (!correct) mistakeCountRef.current += 1

    if (index + 1 < questions.length) {
      setIndex((prev) => prev + 1)
      return
    }

    let newBadges: string[] = []
    if (!isReview && lessonId) {
      const result = completeLesson({
        moduleId: moduleId!,
        lessonId,
        mistakeCount: mistakeCountRef.current,
        lessonsByModule: getAllLessonsByModule(),
      })
      xpEarnedRef.current += result.bonusXp
      newBadges = result.newlyEarnedBadges
    }
    setSummary({ xpEarned: xpEarnedRef.current, mistakeCount: mistakeCountRef.current, newBadges })
    setFinished(true)
  }

  if (finished) {
    return (
      <main className="max-w-xl mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-extrabold mb-4">🎉 Hoàn thành!</h1>
        <p className="text-lg mb-2">
          Đúng {questions.length - summary.mistakeCount}/{questions.length} câu
        </p>
        <p className="text-lg font-bold text-amber-500 mb-6">+{summary.xpEarned} XP</p>
        {summary.newBadges.length > 0 && (
          <div className="mb-6">
            <p className="font-bold mb-2">🏆 Huy hiệu mới:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {summary.newBadges.map((b) => (
                <span key={b} className="rounded-full bg-amber-100 dark:bg-amber-900 px-3 py-1 text-sm font-semibold">
                  {b}
                </span>
              ))}
            </div>
          </div>
        )}
        <Link
          to={`/module/${moduleId}`}
          className="inline-block rounded-xl bg-green-500 text-white font-extrabold uppercase tracking-wide px-6 py-3 hover:bg-green-600"
        >
          Quay lại module
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
            style={{ width: `${(index / questions.length) * 100}%` }}
          />
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Câu {index + 1}/{questions.length}
        </p>
      </div>
      <QuestionCard key={questions[index].id} question={questions[index]} onAnswered={handleAnswered} />
    </main>
  )
}
```

- [ ] **Step 4: Fix `src/routes/MapPage.tsx`** (uses `Track`/`TRACKS` to compute the per-module
  progress ring — easy to miss, found via a full-repo grep for `track`)

Replace the file in full:

```tsx
import { Link } from 'react-router-dom'
import { MODULE_ORDER, MODULES, getLessonIds } from '../content'
import { lessonKey } from '../state/progress'
import { useProgress } from '../state/ProgressContext'

// Alternating left/center/right alignment gives the single path its
// Duolingo-style zigzag while staying simple flexbox (no SVG, no risk of
// overflow on narrow phones).
const ZIGZAG = ['self-center', 'self-start', 'self-end', 'self-start', 'self-end']

function useModuleProgress(moduleId: (typeof MODULE_ORDER)[number]) {
  const { progress } = useProgress()
  const lessonIds = getLessonIds(moduleId).map((id) => lessonKey(moduleId, id))
  const completed = lessonIds.filter((key) => progress.completedLessons.includes(key)).length
  return { completed, total: lessonIds.length }
}

function RoadmapNode({ moduleId, isSuggestedNext }: { moduleId: (typeof MODULE_ORDER)[number]; isSuggestedNext: boolean }) {
  const mod = MODULES[moduleId]
  const { completed, total } = useModuleProgress(moduleId)
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0
  const done = percent === 100

  return (
    <Link to={`/module/${moduleId}`} className="flex flex-col items-center gap-2 w-32 sm:w-36">
      <div className="relative">
        {isSuggestedNext && !done && (
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-400 text-white text-[10px] font-extrabold px-2 py-0.5 shadow">
            BẮT ĐẦU ĐÂY
          </span>
        )}
        <div
          className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white dark:border-slate-900 shadow-lg flex items-center justify-center text-3xl sm:text-4xl transition-transform hover:scale-105"
          style={{ backgroundColor: done ? '#ffc800' : mod.color }}
        >
          {mod.icon}
        </div>
      </div>
      <p className="font-extrabold text-center text-sm sm:text-base">{mod.shortName}</p>
      <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div className="h-full bg-green-500" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {completed}/{total} bài {done && '· Hoàn thành 🎉'}
      </p>
    </Link>
  )
}

export function MapPage() {
  const { progress } = useProgress()

  const suggestedNextId =
    MODULE_ORDER.find((id) => {
      const lessonIds = getLessonIds(id).map((lid) => lessonKey(id, lid))
      return lessonIds.some((key) => !progress.completedLessons.includes(key))
    }) ?? MODULE_ORDER[0]

  return (
    <main className="max-w-md mx-auto px-4 py-8">
      <h1 className="text-3xl font-extrabold mb-2 text-center">Lộ trình học SAP</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-10 text-center">
        Thứ tự gợi ý bên dưới — nhưng bạn có thể bấm vào module bất kỳ, không bị khóa.
      </p>

      <div className="relative flex flex-col items-center gap-14">
        <div className="absolute top-4 bottom-4 left-1/2 -translate-x-1/2 w-1 bg-slate-200 dark:bg-slate-700 rounded-full -z-10" />
        {MODULE_ORDER.map((id, idx) => (
          <div key={id} className={`flex ${ZIGZAG[idx % ZIGZAG.length]}`}>
            <RoadmapNode moduleId={id} isSuggestedNext={id === suggestedNextId} />
          </div>
        ))}
      </div>
    </main>
  )
}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors. (`ProgressContext`'s `isLessonUnlocked`/`completeLesson` signatures don't
match yet at this point — that's expected; Tasks 3–4 fix them. If you're executing tasks
strictly in order, `tsc` WILL show errors here referencing `ProgressContext.tsx` until Task 4 is
done. That's fine — this step exists to confirm Tasks 1–2's own files are otherwise correct;
re-run the full `tsc -b --noEmit` again at the end of Task 4.)

- [ ] **Step 6: Manual verification (after Task 4 is also done)**

1. `npm run dev`, open `http://localhost:5173`.
2. Click into any module — confirm a single column of 3 lessons shows (no 2-column
   syntax/business split).
3. Complete a lesson, confirm XP/streak/badge summary still renders.
4. Click "🔁 Ôn tập" after missing a question — confirm the review route
   (`/lesson/<moduleId>/review`) loads correctly.
5. On the home map (`/`), confirm each module's progress ring shows `completed/3` (not `/6`).

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/routes/ModulePage.tsx src/routes/LessonPage.tsx src/routes/MapPage.tsx
git commit -m "refactor: drop track segment from routing and module/lesson/map pages"
```

## Task 3: Progress state — drop track from `lessonKey`/badges

**Files:**
- Modify: `src/state/progress.ts`
- Test: `src/state/progress.test.ts`

**Interfaces:**
- Produces: `lessonKey(moduleId, lessonId)`, `isLessonUnlocked(state, moduleId,
  lessonIdsInOrder, lessonId)`, `CompleteLessonParams { moduleId, lessonId, mistakeCount,
  lessonsByModule, today? }`, badge id `module-complete:<moduleId>` (replaces
  `track-complete:<id>:<track>` + `module-master:<id>`)

- [ ] **Step 1: Rewrite the test file (red)**

Replace `src/state/progress.test.ts` in full:

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

describe('levelForXp', () => {
  it('starts at level 1 with 0 xp', () => {
    expect(levelForXp(0)).toBe(1)
  })

  it('increases as xp grows', () => {
    expect(levelForXp(50)).toBe(2)
    expect(levelForXp(200)).toBe(3)
  })

  it('clamps negative xp to level 1', () => {
    expect(levelForXp(-100)).toBe(1)
  })
})

describe('isLessonUnlocked', () => {
  const order = ['basic', 'intermediate', 'advanced']

  it('always unlocks the first lesson', () => {
    expect(isLessonUnlocked(INITIAL_PROGRESS, 'mm', order, 'basic')).toBe(true)
  })

  it('locks the next lesson until the previous one is completed', () => {
    expect(isLessonUnlocked(INITIAL_PROGRESS, 'mm', order, 'intermediate')).toBe(false)

    const withBasicDone = { ...INITIAL_PROGRESS, completedLessons: ['mm:basic'] }
    expect(isLessonUnlocked(withBasicDone, 'mm', order, 'intermediate')).toBe(true)
    expect(isLessonUnlocked(withBasicDone, 'mm', order, 'advanced')).toBe(false)
  })
})

describe('recordAnswer', () => {
  it('awards 10 xp for a correct non-review answer and leaves the pool untouched', () => {
    const { state, xpGained } = recordAnswer(INITIAL_PROGRESS, {
      moduleId: 'mm',
      questionId: 'q1',
      correct: true,
      isReview: false,
    })
    expect(xpGained).toBe(10)
    expect(state.reviewPool.mm ?? []).toEqual([])
  })

  it('adds a wrong answer to the review pool at streak 0', () => {
    const { state, xpGained } = recordAnswer(INITIAL_PROGRESS, {
      moduleId: 'mm',
      questionId: 'q1',
      correct: false,
      isReview: false,
    })
    expect(xpGained).toBe(0)
    expect(state.reviewPool.mm).toEqual([{ questionId: 'q1', correctStreak: 0 }])
  })

  it('increments the review streak on correct review answers and evicts at streak 2', () => {
    let state = INITIAL_PROGRESS
    ;({ state } = recordAnswer(state, { moduleId: 'mm', questionId: 'q1', correct: false, isReview: false }))

    const first = recordAnswer(state, { moduleId: 'mm', questionId: 'q1', correct: true, isReview: true })
    expect(first.xpGained).toBe(5)
    expect(first.state.reviewPool.mm).toEqual([{ questionId: 'q1', correctStreak: 1 }])

    const second = recordAnswer(first.state, { moduleId: 'mm', questionId: 'q1', correct: true, isReview: true })
    expect(second.state.reviewPool.mm).toEqual([])
  })

  it('resets the review streak to 0 on a wrong answer while reviewing', () => {
    let state = INITIAL_PROGRESS
    ;({ state } = recordAnswer(state, { moduleId: 'mm', questionId: 'q1', correct: false, isReview: false }))
    ;({ state } = recordAnswer(state, { moduleId: 'mm', questionId: 'q1', correct: true, isReview: true }))
    const result = recordAnswer(state, { moduleId: 'mm', questionId: 'q1', correct: false, isReview: true })
    expect(result.state.reviewPool.mm).toEqual([{ questionId: 'q1', correctStreak: 0 }])
  })
})

describe('updateStreak', () => {
  it('sets streak to 1 on first ever activity', () => {
    const result = updateStreak(INITIAL_PROGRESS, new Date('2026-07-17T10:00:00'))
    expect(result.streak).toBe(1)
    expect(result.lastActiveDate).toBe('2026-07-17')
  })

  it('does not change streak twice on the same day', () => {
    const day1 = updateStreak(INITIAL_PROGRESS, new Date('2026-07-17T10:00:00'))
    const sameDay = updateStreak(day1, new Date('2026-07-17T20:00:00'))
    expect(sameDay.streak).toBe(1)
  })

  it('increments streak on a consecutive day', () => {
    const day1 = updateStreak(INITIAL_PROGRESS, new Date('2026-07-17T10:00:00'))
    const day2 = updateStreak(day1, new Date('2026-07-18T09:00:00'))
    expect(day2.streak).toBe(2)
  })

  it('resets streak to 1 after a missed day', () => {
    const day1 = updateStreak(INITIAL_PROGRESS, new Date('2026-07-17T10:00:00'))
    const day3 = updateStreak(day1, new Date('2026-07-19T09:00:00'))
    expect(day3.streak).toBe(1)
  })
})

describe('completeLesson', () => {
  const lessonsByModule = {
    mm: ['basic', 'intermediate', 'advanced'],
  }

  it('awards a first-completion bonus and marks the lesson done', () => {
    const result = completeLesson(INITIAL_PROGRESS, {
      moduleId: 'mm',
      lessonId: 'basic',
      mistakeCount: 1,
      lessonsByModule,
      today: new Date('2026-07-17T10:00:00'),
    })
    expect(result.isFirstCompletion).toBe(true)
    expect(result.bonusXp).toBe(20)
    expect(result.state.completedLessons).toContain('mm:basic')
    expect(result.state.perfectLessons).toEqual([])
  })

  it('does not award a bonus or duplicate on repeat completion', () => {
    const first = completeLesson(INITIAL_PROGRESS, {
      moduleId: 'mm',
      lessonId: 'basic',
      mistakeCount: 0,
      lessonsByModule,
      today: new Date('2026-07-17T10:00:00'),
    })
    const second = completeLesson(first.state, {
      moduleId: 'mm',
      lessonId: 'basic',
      mistakeCount: 2,
      lessonsByModule,
      today: new Date('2026-07-18T10:00:00'),
    })
    expect(second.isFirstCompletion).toBe(false)
    expect(second.bonusXp).toBe(0)
    expect(second.state.completedLessons.filter((k) => k === 'mm:basic')).toHaveLength(1)
  })

  it('records a perfect-lesson badge when there are no mistakes', () => {
    const result = completeLesson(INITIAL_PROGRESS, {
      moduleId: 'mm',
      lessonId: 'basic',
      mistakeCount: 0,
      lessonsByModule,
      today: new Date('2026-07-17T10:00:00'),
    })
    expect(result.state.perfectLessons).toContain('mm:basic')
    expect(result.newlyEarnedBadges).toContain('perfect-lesson:mm:basic')
  })

  it('awards a module-complete badge once every lesson in the module is done', () => {
    let state = INITIAL_PROGRESS
    const complete = (lessonId: string) => {
      const r = completeLesson(state, {
        moduleId: 'mm',
        lessonId,
        mistakeCount: 3,
        lessonsByModule,
        today: new Date('2026-07-17T10:00:00'),
      })
      state = r.state
      return r
    }

    complete('basic')
    complete('intermediate')
    const allDone = complete('advanced')
    expect(allDone.newlyEarnedBadges).toContain('module-complete:mm')
  })
})

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

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/state/progress.test.ts`
Expected: FAIL — `lessonKey`/`isLessonUnlocked`/`completeLesson` still expect a `track` argument.

- [ ] **Step 3: Rewrite `src/state/progress.ts`**

Replace the file in full:

```typescript
import type { ProgressState } from './types'

export const XP_CORRECT_ANSWER = 10
export const XP_REVIEW_CORRECT_ANSWER = 5
export const XP_LESSON_FIRST_COMPLETE_BONUS = 20
export const XP_PRACTICE_CORRECT_ANSWER = 10
export const REVIEW_MASTERY_STREAK = 2
export const STREAK_BADGE_THRESHOLDS = [7, 30] as const

export function lessonKey(moduleId: string, lessonId: string): string {
  return `${moduleId}:${lessonId}`
}

export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1
}

export function isLessonUnlocked(
  state: ProgressState,
  moduleId: string,
  lessonIdsInOrder: string[],
  lessonId: string,
): boolean {
  const idx = lessonIdsInOrder.indexOf(lessonId)
  if (idx <= 0) return true
  const prevKey = lessonKey(moduleId, lessonIdsInOrder[idx - 1])
  return state.completedLessons.includes(prevKey)
}

export function getReviewQuestionIds(state: ProgressState, moduleId: string): string[] {
  return (state.reviewPool[moduleId] ?? []).map((e) => e.questionId)
}

export interface RecordAnswerParams {
  moduleId: string
  questionId: string
  correct: boolean
  isReview: boolean
}

export interface RecordAnswerResult {
  state: ProgressState
  xpGained: number
}

/**
 * Wrong answers join the module's review pool at streak 0.
 * Correct answers while reviewing increment the streak; reaching
 * REVIEW_MASTERY_STREAK removes the question from the pool.
 */
export function recordAnswer(state: ProgressState, params: RecordAnswerParams): RecordAnswerResult {
  const { moduleId, questionId, correct, isReview } = params
  const pool = state.reviewPool[moduleId] ?? []
  let nextPool = pool
  let xpGained = 0

  if (correct) {
    xpGained = isReview ? XP_REVIEW_CORRECT_ANSWER : XP_CORRECT_ANSWER
    if (isReview) {
      nextPool = pool
        .map((e) => (e.questionId === questionId ? { ...e, correctStreak: e.correctStreak + 1 } : e))
        .filter((e) => e.questionId !== questionId || e.correctStreak < REVIEW_MASTERY_STREAK)
    }
  } else {
    const existing = pool.find((e) => e.questionId === questionId)
    nextPool = existing
      ? pool.map((e) => (e.questionId === questionId ? { ...e, correctStreak: 0 } : e))
      : [...pool, { questionId, correctStreak: 0 }]
  }

  return {
    state: {
      ...state,
      xp: state.xp + xpGained,
      reviewPool: { ...state.reviewPool, [moduleId]: nextPool },
    },
    xpGained,
  }
}

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

export function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** A day is "missed" unless the lesson streak was already updated today or yesterday. */
export function updateStreak(state: ProgressState, today: Date): ProgressState {
  const todayStr = toDateString(today)
  if (state.lastActiveDate === todayStr) return state

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = toDateString(yesterday)

  const nextStreak = state.lastActiveDate === yesterdayStr ? state.streak + 1 : 1
  return { ...state, streak: nextStreak, lastActiveDate: todayStr }
}

export function computeEarnedBadges(
  state: ProgressState,
  lessonsByModule: Record<string, string[]>,
): string[] {
  const badges = new Set(state.badges)

  for (const [moduleId, lessonIds] of Object.entries(lessonsByModule)) {
    if (lessonIds.length === 0) continue
    const allDone = lessonIds.every((id) => state.completedLessons.includes(lessonKey(moduleId, id)))
    if (allDone) badges.add(`module-complete:${moduleId}`)
  }

  for (const lid of state.perfectLessons) {
    badges.add(`perfect-lesson:${lid}`)
  }

  for (const threshold of STREAK_BADGE_THRESHOLDS) {
    if (state.streak >= threshold) badges.add(`streak-${threshold}`)
  }

  return Array.from(badges)
}

export interface CompleteLessonParams {
  moduleId: string
  lessonId: string
  mistakeCount: number
  lessonsByModule: Record<string, string[]>
  today?: Date
}

export interface CompleteLessonResult {
  state: ProgressState
  isFirstCompletion: boolean
  bonusXp: number
  newlyEarnedBadges: string[]
}

export function completeLesson(state: ProgressState, params: CompleteLessonParams): CompleteLessonResult {
  const { moduleId, lessonId, mistakeCount, lessonsByModule, today = new Date() } = params
  const key = lessonKey(moduleId, lessonId)
  const isFirstCompletion = !state.completedLessons.includes(key)
  const bonusXp = isFirstCompletion ? XP_LESSON_FIRST_COMPLETE_BONUS : 0

  let next: ProgressState = {
    ...state,
    xp: state.xp + bonusXp,
    completedLessons: isFirstCompletion ? [...state.completedLessons, key] : state.completedLessons,
    perfectLessons:
      mistakeCount === 0 && !state.perfectLessons.includes(key)
        ? [...state.perfectLessons, key]
        : state.perfectLessons,
  }

  next = updateStreak(next, today)

  const badgesBefore = new Set(next.badges)
  const allBadges = computeEarnedBadges(next, lessonsByModule)
  const newlyEarnedBadges = allBadges.filter((b) => !badgesBefore.has(b))
  next = { ...next, badges: allBadges }

  return { state: next, isFirstCompletion, bonusXp, newlyEarnedBadges }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/state/progress.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add src/state/progress.ts src/state/progress.test.ts
git commit -m "refactor: drop track from lessonKey and collapse badges to module-complete"
```

## Task 4: `ProgressContext` — drop track from the wrapper API

**Files:**
- Modify: `src/state/ProgressContext.tsx`
- Test: `src/state/ProgressContext.test.tsx`

**Interfaces:**
- Consumes: `isLessonUnlocked(state, moduleId, lessonIdsInOrder, lessonId)`,
  `CompleteLessonParams { moduleId, lessonId, mistakeCount, lessonsByModule, today? }` (Task 3)
- Produces: `ProgressContextValue.isLessonUnlocked(moduleId, lessonIdsInOrder, lessonId)`,
  `ProgressContextValue.completeLesson({ moduleId, lessonId, mistakeCount, lessonsByModule })`

- [ ] **Step 1: Update the failing test first**

In `src/state/ProgressContext.test.tsx`, replace the `'ProgressContext under StrictMode'` test
block:

```typescript
describe('ProgressContext under StrictMode', () => {
  // Regression test: React 18/19 StrictMode (dev only) can invoke a setState
  // updater function more than once. The original implementation captured
  // recordAnswer/completeLesson's return values via a side-effecting closure
  // inside such an updater, so calling completeLesson right after
  // recordAnswer in the same handler silently returned bonusXp: 0 even
  // though the persisted xp total was correct. See git history for details.
  it('reports the correct bonusXp when completeLesson runs right after recordAnswer in the same tick', () => {
    const { result } = renderHook(() => useProgress(), { wrapper })

    let bonusXp = -1
    act(() => {
      result.current.recordAnswer({ moduleId: 'mm', questionId: 'q1', correct: true, isReview: false })
      const outcome = result.current.completeLesson({
        moduleId: 'mm',
        lessonId: 'basic',
        mistakeCount: 0,
        lessonsByModule: { mm: ['basic'] },
      })
      bonusXp = outcome.bonusXp
    })

    expect(bonusXp).toBe(20)
    expect(result.current.progress.xp).toBe(30)
    expect(result.current.progress.completedLessons).toEqual(['mm:basic'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/ProgressContext.test.tsx`
Expected: FAIL — `ProgressContext.tsx` still requires a `track` field on `completeLesson`'s
argument and `isLessonUnlocked` still expects a `track` positional argument (type errors surface
as the test failing to run, or as a runtime shape mismatch — either way, this fails until Step 3).

- [ ] **Step 3: Update `src/state/ProgressContext.tsx`**

Remove the `import type { Track } from '../content/types'` line, and change:

```typescript
interface CompleteLessonArgs {
  moduleId: string
  track: Track
  lessonId: string
  mistakeCount: number
  lessonsByModuleTrack: Record<string, string[]>
}
```
to:
```typescript
interface CompleteLessonArgs {
  moduleId: string
  lessonId: string
  mistakeCount: number
  lessonsByModule: Record<string, string[]>
}
```

Change:
```typescript
  isLessonUnlocked: (moduleId: string, track: Track, lessonIdsInOrder: string[], lessonId: string) => boolean
```
to:
```typescript
  isLessonUnlocked: (moduleId: string, lessonIdsInOrder: string[], lessonId: string) => boolean
```
(both in the `ProgressContextValue` interface declaration and in the `useMemo` implementation,
where the line):
```typescript
      isLessonUnlocked: (moduleId, track, lessonIdsInOrder, lessonId) =>
        isLessonUnlockedPure(progress, moduleId, track, lessonIdsInOrder, lessonId),
```
becomes:
```typescript
      isLessonUnlocked: (moduleId, lessonIdsInOrder, lessonId) =>
        isLessonUnlockedPure(progress, moduleId, lessonIdsInOrder, lessonId),
```

`completeLesson`'s wrapper body is unchanged (it already just forwards `args` to
`completeLessonPure` and returns the picked fields) — only the `CompleteLessonArgs` type above
needs to change, since `args` is typed by it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/state/ProgressContext.test.tsx`
Expected: PASS (both the updated StrictMode test and the untouched `recordPracticeAnswer` test)

- [ ] **Step 5: Full type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors anywhere in `src/` (this is the point where Task 2's Step 5 caveat resolves).

- [ ] **Step 6: Commit**

```bash
git add src/state/ProgressContext.tsx src/state/ProgressContext.test.tsx
git commit -m "refactor: drop track from ProgressContext's completeLesson/isLessonUnlocked"
```

## Task 5: MCP server — drop track from `get_quiz_lessons` and progress export

**Files:**
- Modify: `mcp-server/src/contentReaders.ts`
- Modify: `mcp-server/src/progressExport.ts`
- Modify: `mcp-server/src/index.ts`

**Interfaces:**
- Consumes: `QUIZ_LESSONS`, `getLessons`/etc. from `src/content/index.ts` (Task 1)
- Produces: `getQuizLessons(moduleId)` (drops `track`)

No automated test exists for the MCP server in this repo (established pattern per the original
2026-07-20 spec — verified manually through Claude Desktop). Verified here via `tsc --noEmit`
and a manual stdio smoke test.

- [ ] **Step 1: Update `mcp-server/src/contentReaders.ts`**

Replace the file in full:

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './paths.js'
import { MODULE_ORDER, MODULES, QUIZ_LESSONS, TABLES } from '../../src/content/index.js'
import type { ModuleId } from '../../src/content/types.js'

export { MODULE_ORDER }
export type { ModuleId }

export function listModules() {
  return MODULE_ORDER.map((id) => MODULES[id])
}

export function getQuizLessons(moduleId: ModuleId) {
  return QUIZ_LESSONS[moduleId]
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

- [ ] **Step 2: Update `mcp-server/src/progressExport.ts`**

Replace the `findQuestionInModule` function (keep everything else in the file unchanged):

```typescript
function findQuestionInModule(moduleId: string, questionId: string) {
  const file = readJson<{ lessons: { questions: { id: string }[] }[] }>(
    path.join(CONTENT_DIR, moduleId, 'quiz.json'),
  )
  for (const lesson of file.lessons) {
    const found = lesson.questions.find((q) => q.id === questionId)
    if (found) return found
  }
  return undefined
}
```

- [ ] **Step 3: Update `mcp-server/src/index.ts`**

Change the `get_quiz_lessons` tool registration:

```typescript
server.registerTool(
  'get_quiz_lessons',
  {
    title: 'Get quiz lessons',
    description: 'Trả về toàn bộ lesson và câu hỏi hiện có của 1 module',
    inputSchema: { moduleId: moduleIdEnum },
  },
  async ({ moduleId }) => ({
    content: [{ type: 'text', text: JSON.stringify(getQuizLessons(moduleId), null, 2) }],
  }),
)
```

(This removes the `track: z.enum(['syntax', 'business'])` field from `inputSchema` and the
`track` destructured parameter — everything else in `index.ts` is unchanged.)

- [ ] **Step 4: Type-check the MCP server**

Run: `cd mcp-server && npx tsc --noEmit && cd ..`
Expected: no errors.

- [ ] **Step 5: Manual smoke test**

Run: `npx tsx mcp-server/src/index.ts`
Expected: process starts and hangs waiting on stdio (this is correct — it's an MCP stdio
server, not a CLI that exits). Press Ctrl+C to stop. This confirms the module loads without
throwing at import time (which would happen immediately if `contentReaders.ts` still referenced
a removed export like `QUIZ_TRACKS`).

- [ ] **Step 6: Commit**

```bash
git add mcp-server/src/contentReaders.ts mcp-server/src/progressExport.ts mcp-server/src/index.ts
git commit -m "refactor: drop track param from MCP get_quiz_lessons and progress export"
```

## Task 6: Update `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the Architecture section**

Find this paragraph in `CLAUDE.md`:

```
- `src/content/index.ts` is the single aggregation point for the 5 quiz modules (`mm`, `co`, `fi-gl`,
  `enterprise-structure`, `sd`). Each module directory has `module.json` (metadata), `tables.json` (wiki
  entries), `quiz-syntax.json` and `quiz-business.json` (the two parallel learning tracks). **Every quiz
  track file must have exactly 3 lessons of exactly 8 questions each** — this is enforced by
  `src/content/content.test.ts`, not by any type system check.
```

Replace with:

```
- `src/content/index.ts` is the single aggregation point for the 5 quiz modules (`mm`, `co`, `fi-gl`,
  `enterprise-structure`, `sd`). Each module directory has `module.json` (metadata), `tables.json` (wiki
  entries), and `quiz.json` (the business-focused lesson list — there is no separate syntax track).
  **Every module's `quiz.json` must have exactly 3 lessons of exactly 8 questions each** — this is
  enforced by `src/content/content.test.ts`, not by any type system check.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for the single-track quiz schema"
```

## Task 7: Full verification pass

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass (`content.test.ts`, `generated.test.ts`, `lab.test.ts`,
`progress.test.ts`, `ProgressContext.test.tsx`).

- [ ] **Step 2: Run the build**

Run: `npm run build`
Expected: `tsc -b` and `vite build` succeed with no errors.

- [ ] **Step 3: Run the linter**

Run: `npm run lint`
Expected: no errors (confirms no leftover unused `Track` imports anywhere).

---

## Self-Review Notes

- **Spec coverage:** Phần B §3.1 (content rename) → Task 1 Step 3. §3.2 (types/index.ts) →
  Task 1 Steps 4–5. §3.3 (routing) → Task 2 Step 1. §3.4 (UI) → Task 2 Steps 2, 4 (`ModulePage`,
  `MapPage` — the latter found via grep, not explicitly named in the spec, but squarely the same
  concern). §3.5 (state/badges) → Task 3. §3.6 (MCP) → Task 5. §3.7 (`CLAUDE.md`) → Task 6.
- **Placeholder scan:** no TBD/TODO; every step has full file contents or an exact command.
- **Type consistency:** `lessonKey(moduleId, lessonId)` signature is identical across
  `progress.ts` (Task 3), `ModulePage.tsx`/`MapPage.tsx` (Task 2, which is written before Task 3
  in file order but both are given their final, mutually-consistent form up front since this
  plan's code blocks show the end state directly). `CompleteLessonParams`/`CompleteLessonArgs`
  both use `lessonsByModule` (not `lessonsByModuleTrack`) consistently between `progress.ts`
  (Task 3) and `ProgressContext.tsx` (Task 4). `getAllLessonsByModule()` takes no arguments and
  returns `Record<string, string[]>` consistently between `content/index.ts` (Task 1) and its
  call site in `LessonPage.tsx` (Task 2).
