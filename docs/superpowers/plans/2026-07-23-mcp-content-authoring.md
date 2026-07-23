# MCP Content-Authoring Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Claude (via the `sap-quest` MCP server) add permanent content — new SAP modules,
new lessons, new wiki table entries, new Code Lab exercises — without ever editing a TypeScript
aggregator file by hand, and publish it after running the full test suite.

**Architecture:** Convert `src/content/index.ts` and `src/content/lab/index.ts` from explicit
per-file imports to Vite's `import.meta.glob` auto-discovery. Loosen `ModuleId` from a literal
union to `string` (content correctness now enforced by tests, not `tsc`). Add 4 new MCP tools
that write directly into `src/content/**` (mirroring the existing `write_practice_set` pattern)
plus a generalized `publish_content` tool that runs the whole test suite before commit+push.

**Tech Stack:** Vite `import.meta.glob`, Vitest (existing stack, no new dependencies),
`@modelcontextprotocol/sdk` + `zod` (existing mcp-server stack). Corresponding design:
[docs/superpowers/specs/2026-07-23-progress-autosync-and-content-authoring-design.md](../specs/2026-07-23-progress-autosync-and-content-authoring-design.md), Phần C.

## Global Constraints

- **Depends on [2026-07-23-remove-syntax-track.md](2026-07-23-remove-syntax-track.md) being
  fully done first** — this plan's code assumes `QUIZ_LESSONS`/`getLessons(moduleId)`/
  `Lesson[]`/`QuizFile` (no `Track` type, no per-track split) already exist.
- No new npm dependency in either `package.json` or `mcp-server/package.json`.
- `publish_content` still pushes straight to `main`, no PR/branch step (spec §7, user-confirmed
  trade-off) — but unlike `publish_practice_set`, it must run the **entire** `npx vitest run`
  suite before committing, since it can touch `content.test.ts`/`lab.test.ts`-covered files.
- All new `mcp-server` write functions use `execFileSync(cmd, args[])`, never
  `execSync(templateString)`, for any git/test invocation that includes free-form user-supplied
  text (e.g. a commit message) — avoids shell-quoting bugs and shell-injection risk. (The
  existing `publishPracticeSet.ts` uses `execSync` with a regex-validated `id` only, so it's
  low-risk as-is; do not change that file in this plan.)

---

## File Structure

- **Modify `src/content/types.ts`** — `ModuleId` becomes `string`; `ModuleInfo` gains `order:
  number`.
- **Modify `src/content/index.ts`** — `MODULES`/`TABLES`/`QUIZ_LESSONS`/`MODULE_ORDER` built
  from `import.meta.glob` instead of explicit imports.
- **Modify `src/content/lab/index.ts`** — `EXERCISES` built from `import.meta.glob` instead of
  explicit imports.
- **Modify `src/content/validateQuestion.ts`** — add `validateTableEntry`,
  `validateExerciseMeta`.
- **Create `src/content/validateQuestion.test.ts`** — unit tests for the 2 new validators.
- **Modify `src/content/content.test.ts`, `src/content/lab/lab.test.ts`** — reuse the shared
  validators; loosen the lesson-count assertion to `>= 3`.
- **Create `mcp-server/src/writeModuleDraft.ts`, `writeLessonDraft.ts`, `writeTableEntry.ts`,
  `writeLabExerciseDraft.ts`, `publishContent.ts`** — one file per new tool's logic, mirroring
  `writePracticeSet.ts`.
- **Modify `mcp-server/src/index.ts`** — register the 5 new tools.
- **Modify `mcp-server/README.md`** — document the 5 new tools.

## Task 1: Add an explicit `order` field to every module

**Files:**
- Modify: `src/content/{mm,co,fi-gl,enterprise-structure,sd}/module.json`
- Modify: `src/content/types.ts`

**Interfaces:**
- Produces: `ModuleInfo.order: number`

- [ ] **Step 1: Add `order` to each module.json**

Run:

```bash
node -e "
const fs = require('fs');
const path = require('path');
const order = { 'enterprise-structure': 1, mm: 2, co: 3, 'fi-gl': 4, sd: 5 };
for (const [id, ord] of Object.entries(order)) {
  const p = path.join('src', 'content', id, 'module.json');
  const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
  data.order = ord;
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
}
console.log('added order field to 5 modules');
"
```

Expected output: `added order field to 5 modules`. Spot-check
`cat src/content/enterprise-structure/module.json` shows `"order": 1`.

- [ ] **Step 2: Add the field to `ModuleInfo`**

In `src/content/types.ts`, change:

```typescript
export interface ModuleInfo {
  id: ModuleId
  name: string
  shortName: string
  icon: string
  color: string
  description: string
  businessPurpose: string
}
```

to:

```typescript
export interface ModuleInfo {
  id: ModuleId
  order: number
  name: string
  shortName: string
  icon: string
  color: string
  description: string
  businessPurpose: string
}
```

- [ ] **Step 3: Commit**

```bash
git add src/content
git commit -m "feat: add explicit order field to module.json for display ordering"
```

## Task 2: `src/content/index.ts` — auto-discover modules, loosen `ModuleId`, loosen lesson count

**Files:**
- Modify: `src/content/types.ts`
- Modify: `src/content/index.ts`
- Modify: `src/content/content.test.ts`

**Interfaces:**
- Produces: `ModuleId = string` (was a literal union); `MODULE_ORDER`, `MODULES`, `TABLES`,
  `QUIZ_LESSONS` now built from directory contents instead of hand-listed imports.

- [ ] **Step 1: Update the test to expect ≥3 lessons and a unique `order` per module (red)**

In `src/content/content.test.ts`, replace the first and third `it` blocks:

```typescript
  it('every module has a module.json with matching id and a unique order', () => {
    const seenOrders = new Set<number>()
    for (const moduleId of MODULE_ORDER) {
      expect(MODULES[moduleId].id).toBe(moduleId)
      expect(MODULES[moduleId].name.length).toBeGreaterThan(0)
      expect(MODULES[moduleId].businessPurpose.length).toBeGreaterThan(0)
      expect(seenOrders.has(MODULES[moduleId].order), `duplicate order value: ${MODULES[moduleId].order}`).toBe(
        false,
      )
      seenOrders.add(MODULES[moduleId].order)
    }
  })
```

and:

```typescript
  it('every module has at least 3 lessons of 8 questions each, all valid', () => {
    const allIds = new Set<string>()

    for (const moduleId of MODULE_ORDER) {
      const lessons = QUIZ_LESSONS[moduleId]
      expect(lessons.length).toBeGreaterThanOrEqual(3)

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
```

(Leave the "every table entry belongs to its module and has key fields" and "related tables
reference tables that actually exist somewhere" tests untouched here — Task 4 refactors those.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/content/content.test.ts`
Expected: FAIL — `MODULES[moduleId].order` is `undefined` (index.ts still uses the old explicit
`Record` literals from before Task 1's field addition reached it).

- [ ] **Step 3: Update `ModuleId` in `src/content/types.ts`**

Change:

```typescript
export type ModuleId = 'mm' | 'co' | 'fi-gl' | 'enterprise-structure' | 'sd'
```

to:

```typescript
export type ModuleId = string
```

- [ ] **Step 4: Rewrite the aggregation part of `src/content/index.ts`**

Replace everything from the top of the file down through the `QUIZ_LESSONS` export (keep every
function below `QUIZ_LESSONS` — `getAllTables` through `getAllLessonsByModule` — completely
unchanged):

```typescript
import type { ModuleId, ModuleInfo, TableEntry, QuizFile, Lesson, QuizQuestion } from './types'

const moduleFiles = import.meta.glob('./*/module.json', { eager: true }) as Record<string, { default: ModuleInfo }>
const tableFiles = import.meta.glob('./*/tables.json', { eager: true }) as Record<string, { default: TableEntry[] }>
const quizFiles = import.meta.glob('./*/quiz.json', { eager: true }) as Record<string, { default: QuizFile }>

// import.meta.glob keys look like "./mm/module.json" — the module id is the path segment
// right after "./".
function idFromGlobKey(key: string): ModuleId {
  return key.split('/')[1]
}

export const MODULES: Record<ModuleId, ModuleInfo> = Object.fromEntries(
  Object.entries(moduleFiles).map(([key, mod]) => [idFromGlobKey(key), mod.default]),
)

export const TABLES: Record<ModuleId, TableEntry[]> = Object.fromEntries(
  Object.entries(tableFiles).map(([key, tables]) => [idFromGlobKey(key), tables.default]),
)

export const QUIZ_LESSONS: Record<ModuleId, Lesson[]> = Object.fromEntries(
  Object.entries(quizFiles).map(([key, quiz]) => [idFromGlobKey(key), quiz.default.lessons]),
)

export const MODULE_ORDER: ModuleId[] = Object.keys(MODULES).sort((a, b) => MODULES[a].order - MODULES[b].order)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/content/content.test.ts`
Expected: PASS (all 4 tests)

- [ ] **Step 6: Run the full suite + type-check**

Run: `npx vitest run && npx tsc -b --noEmit`
Expected: everything passes — `generated.test.ts` and `lab.test.ts` don't reference `ModuleId`'s
literal-ness or the aggregation mechanism, so they're unaffected; `mcp-server`'s
`moduleIdEnum = z.enum(MODULE_ORDER)` (in `mcp-server/src/index.ts`) already takes `MODULE_ORDER`
as a runtime array, so it keeps working unchanged even though the array is now glob-derived.

- [ ] **Step 7: Commit**

```bash
git add src/content/types.ts src/content/index.ts src/content/content.test.ts
git commit -m "feat: auto-discover content modules via import.meta.glob, loosen ModuleId to string"
```

## Task 3: `src/content/lab/index.ts` — auto-discover exercises

**Files:**
- Modify: `src/content/lab/index.ts`

**Interfaces:**
- Produces: same `EXERCISES: Exercise[]` and `findExercise(id)` as before, now built from a
  directory scan instead of ~50 explicit import lines.

No test changes needed here — `lab.test.ts` (Global Constraints of the previous plan; unchanged
by this plan too) asserts on the *content* of `EXERCISES`, not on how it's assembled, so it
should pass unmodified once this task is done. Verified in Step 2.

- [ ] **Step 1: Rewrite `src/content/lab/index.ts`**

Replace the file in full:

```typescript
import type { Exercise, ExerciseMeta } from './types'

const metaFiles = import.meta.glob('./*/exercise.json', { eager: true }) as Record<string, { default: ExerciseMeta }>
const rawFiles = import.meta.glob('./*/files/*.abap', { eager: true, query: '?raw', import: 'default' }) as Record<
  string,
  string
>

// import.meta.glob keys look like "./zday2-exe-01/exercise.json" — the exercise id directory
// name is the path segment right after "./".
function dirFromMetaKey(key: string): string {
  return key.split('/')[1]
}

export const EXERCISES: Exercise[] = Object.entries(metaFiles)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([metaKey, mod]) => {
    const meta = mod.default
    const dir = dirFromMetaKey(metaKey)
    const files = meta.sourceFiles.map((filename) => {
      const fileKey = `./${dir}/files/${filename}`
      const code = rawFiles[fileKey]
      if (code === undefined) {
        throw new Error(`Exercise ${meta.id}: missing source file ${filename} (expected at ${fileKey})`)
      }
      return { filename, code }
    })
    return { ...meta, files }
  })

export function findExercise(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id)
}
```

- [ ] **Step 2: Run the lab test suite + type-check**

Run: `npx vitest run src/content/lab/lab.test.ts && npx tsc -b --noEmit`
Expected: PASS, 0 type errors. If `sourceFiles matches the actual loaded files` fails, check
that `Object.entries(metaFiles).sort(...)` is sorting by directory name (the `[a]` in the sort
callback destructures the *key*, e.g. `"./zday10-exe-01/exercise.json"`, which sorts identically
to sorting by directory name since `"./"` is a constant prefix on every key).

- [ ] **Step 3: Commit**

```bash
git add src/content/lab/index.ts
git commit -m "feat: auto-discover Code Lab exercises via import.meta.glob"
```

## Task 4: Shared validators — `validateTableEntry`, `validateExerciseMeta`

**Files:**
- Modify: `src/content/validateQuestion.ts`
- Create: `src/content/validateQuestion.test.ts`
- Modify: `src/content/content.test.ts`
- Modify: `src/content/lab/lab.test.ts`

**Interfaces:**
- Produces: `validateTableEntry(table: TableEntry, allKnownTableIds: Set<string>): string[]`,
  `validateExerciseMeta(meta: ExerciseMeta, actualFilenames: string[]): string[]`

- [ ] **Step 1: Write the failing tests**

Create `src/content/validateQuestion.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { validateTableEntry, validateExerciseMeta } from './validateQuestion'
import type { TableEntry } from './types'
import type { ExerciseMeta } from './lab/types'

const baseTable: TableEntry = {
  id: 'MARA',
  name: 'General Material Data',
  module: 'mm',
  purpose: 'Lưu dữ liệu chung của vật tư',
  whereUsed: 'Material master',
  keyFields: [{ field: 'MATNR', description: 'Material number' }],
  relatedTables: [],
}

describe('validateTableEntry', () => {
  it('passes for a well-formed table entry', () => {
    expect(validateTableEntry(baseTable, new Set(['MARA']))).toEqual([])
  })

  it('flags missing keyFields', () => {
    const errors = validateTableEntry({ ...baseTable, keyFields: [] }, new Set(['MARA']))
    expect(errors).toContain('[MARA] needs >=1 keyFields')
  })

  it('flags a relatedTables entry that does not exist', () => {
    const errors = validateTableEntry({ ...baseTable, relatedTables: ['NOPE'] }, new Set(['MARA']))
    expect(errors).toContain('[MARA] unknown related table NOPE')
  })
})

const baseExercise: ExerciseMeta = {
  id: 'test-ex',
  title: 'Test exercise',
  category: 'algorithm',
  difficulty: 'basic',
  relatedExerciseIds: [],
  sourceFiles: ['test.abap'],
  problemStatement: 'Làm gì đó',
  concepts: ['loop'],
  tablesUsed: [],
  walkthrough: 'Bước 1...',
  sampleOutput: 'Kết quả minh họa',
}

describe('validateExerciseMeta', () => {
  it('passes when sourceFiles matches the actual files', () => {
    expect(validateExerciseMeta(baseExercise, ['test.abap'])).toEqual([])
  })

  it('flags a sourceFiles mismatch', () => {
    const errors = validateExerciseMeta(baseExercise, ['other.abap'])
    expect(errors.some((e) => e.includes('sourceFiles'))).toBe(true)
  })

  it('flags missing concepts', () => {
    const errors = validateExerciseMeta({ ...baseExercise, concepts: [] }, ['test.abap'])
    expect(errors).toContain('[test-ex] needs >=1 concepts')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/content/validateQuestion.test.ts`
Expected: FAIL — `validateTableEntry`/`validateExerciseMeta` are not exported yet.

- [ ] **Step 3: Implement the validators**

Append to `src/content/validateQuestion.ts` (keep the existing `validateQuestion` and its
constants untouched):

```typescript
import type { TableEntry } from './types'
import type { ExerciseMeta } from './lab/types'

export function validateTableEntry(table: TableEntry, allKnownTableIds: Set<string>): string[] {
  const errors: string[] = []
  if (!table.id) errors.push('missing id')
  if (!table.name) errors.push(`[${table.id}] missing name`)
  if (!table.purpose) errors.push(`[${table.id}] missing purpose`)
  if (!table.whereUsed) errors.push(`[${table.id}] missing whereUsed`)
  if (!Array.isArray(table.keyFields) || table.keyFields.length === 0) {
    errors.push(`[${table.id}] needs >=1 keyFields`)
  }
  for (const rid of table.relatedTables ?? []) {
    if (!allKnownTableIds.has(rid.toUpperCase())) {
      errors.push(`[${table.id}] unknown related table ${rid}`)
    }
  }
  return errors
}

export function validateExerciseMeta(meta: ExerciseMeta, actualFilenames: string[]): string[] {
  const errors: string[] = []
  if (!meta.id) errors.push('missing id')
  if (!meta.title) errors.push(`[${meta.id}] missing title`)
  if (!meta.problemStatement) errors.push(`[${meta.id}] missing problemStatement`)
  if (!meta.walkthrough) errors.push(`[${meta.id}] missing walkthrough`)
  if (!meta.sampleOutput) errors.push(`[${meta.id}] missing sampleOutput`)
  if (!Array.isArray(meta.concepts) || meta.concepts.length === 0) {
    errors.push(`[${meta.id}] needs >=1 concepts`)
  }
  if (JSON.stringify(meta.sourceFiles) !== JSON.stringify(actualFilenames)) {
    errors.push(
      `[${meta.id}] sourceFiles ${JSON.stringify(meta.sourceFiles)} does not match actual files ${JSON.stringify(actualFilenames)}`,
    )
  }
  return errors
}
```

(Note: `src/content/validateQuestion.ts` importing from `./lab/types` is a one-directional
dependency from content-root down into `lab/` — this already matches how
`src/content/lab/index.ts` imports upward from nowhere else in `content/`, so no import cycle is
introduced.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/content/validateQuestion.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Refactor `content.test.ts` to use `validateTableEntry`**

In `src/content/content.test.ts`, replace the "every table entry belongs to its module and has
key fields" and "related tables reference tables that actually exist somewhere" tests with one:

```typescript
  it('every table entry is well-formed and belongs to its module', () => {
    const allTableIds = new Set(MODULE_ORDER.flatMap((m) => TABLES[m].map((t) => t.id.toUpperCase())))
    for (const moduleId of MODULE_ORDER) {
      expect(TABLES[moduleId].length).toBeGreaterThan(0)
      for (const table of TABLES[moduleId]) {
        expect(table.module).toBe(moduleId)
        const errors = validateTableEntry(table, allTableIds)
        expect(errors, `${moduleId}/${table.id}: ${errors.join('; ')}`).toEqual([])
      }
    }
  })
```

Add `validateTableEntry` to the existing import line:
`import { validateQuestion, validateTableEntry } from './validateQuestion'`.

- [ ] **Step 6: Refactor `lab.test.ts` to use `validateExerciseMeta`**

In `src/content/lab/lab.test.ts`, replace the "sourceFiles matches the actual loaded files, and
every file has non-empty code" and "has non-empty problemStatement, walkthrough, sampleOutput,
and at least one concept" tests with one:

```typescript
  it('every exercise metadata is well-formed and its files match sourceFiles', () => {
    for (const ex of EXERCISES) {
      const errors = validateExerciseMeta(
        ex,
        ex.files.map((f) => f.filename),
      )
      expect(errors, `${ex.id}: ${errors.join('; ')}`).toEqual([])
      for (const file of ex.files) {
        expect(file.code.length, `${ex.id}/${file.filename} has empty source`).toBeGreaterThan(0)
      }
    }
  })
```

Add the import: `import { validateExerciseMeta } from '../validateQuestion'`.

- [ ] **Step 7: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — all files, including the two refactored test files and the untouched
`relatedExerciseIds`/`sampleOutput disclaimer`/category-difficulty tests in `lab.test.ts`.

- [ ] **Step 8: Commit**

```bash
git add src/content/validateQuestion.ts src/content/validateQuestion.test.ts src/content/content.test.ts src/content/lab/lab.test.ts
git commit -m "feat: add validateTableEntry/validateExerciseMeta, reuse in content tests"
```

## Task 5: MCP tool — `write_module_draft`

**Files:**
- Create: `mcp-server/src/writeModuleDraft.ts`
- Modify: `mcp-server/src/index.ts`

**Interfaces:**
- Consumes: `validateQuestion`, `validateTableEntry` (Task 4), `getAllTables` (from
  `src/content/index.ts`, unchanged)
- Produces: `writeModuleDraft(input: WriteModuleDraftInput): { dir: string }`

No automated test (established mcp-server pattern, per the original 2026-07-20 spec — verified
manually via a smoke-test script in Step 2).

- [ ] **Step 1: Implement `mcp-server/src/writeModuleDraft.ts`**

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './paths.js'
import { getAllTables } from '../../src/content/index.js'
import { validateQuestion, validateTableEntry } from '../../src/content/validateQuestion.js'
import type { QuizQuestion, TableEntry } from '../../src/content/types.js'

export interface WriteModuleDraftInput {
  id: string
  order: number
  module: {
    name: string
    shortName: string
    icon: string
    color: string
    description: string
    businessPurpose: string
  }
  tables: Omit<TableEntry, 'module'>[]
  lessons: { id: string; difficulty: string; title: string; questions: QuizQuestion[] }[]
}

export function writeModuleDraft(input: WriteModuleDraftInput): { dir: string } {
  if (!/^[a-z0-9-]+$/.test(input.id)) {
    throw new Error(`id "${input.id}" không hợp lệ — chỉ dùng chữ thường, số, dấu gạch ngang`)
  }
  const dir = path.join(CONTENT_DIR, input.id)
  if (fs.existsSync(dir)) {
    throw new Error(`Module "${input.id}" đã tồn tại tại ${dir}`)
  }
  if (input.lessons.length < 3) {
    throw new Error(`Module cần ít nhất 3 lesson, hiện có ${input.lessons.length}`)
  }
  for (const lesson of input.lessons) {
    if (lesson.questions.length !== 8) {
      throw new Error(`Lesson "${lesson.id}" cần đúng 8 câu hỏi, hiện có ${lesson.questions.length}`)
    }
    const errors = lesson.questions.flatMap((q) => validateQuestion(q))
    if (errors.length > 0) {
      throw new Error(`Lesson "${lesson.id}" có câu hỏi không hợp lệ:\n${errors.join('\n')}`)
    }
  }
  if (input.tables.length === 0) {
    throw new Error('Module cần ít nhất 1 table entry')
  }
  const existingIds = new Set(getAllTables().map((t) => t.id.toUpperCase()))
  const newIds = new Set(input.tables.map((t) => t.id.toUpperCase()))
  const allKnownIds = new Set([...existingIds, ...newIds])
  for (const table of input.tables) {
    const entry: TableEntry = { ...table, module: input.id }
    const errors = validateTableEntry(entry, allKnownIds)
    if (errors.length > 0) {
      throw new Error(`Table "${table.id}" không hợp lệ:\n${errors.join('\n')}`)
    }
  }

  fs.mkdirSync(dir, { recursive: true })

  const moduleJson = { id: input.id, order: input.order, ...input.module }
  fs.writeFileSync(path.join(dir, 'module.json'), JSON.stringify(moduleJson, null, 2) + '\n', 'utf-8')

  const tablesJson: TableEntry[] = input.tables.map((t) => ({ ...t, module: input.id }))
  fs.writeFileSync(path.join(dir, 'tables.json'), JSON.stringify(tablesJson, null, 2) + '\n', 'utf-8')

  const quizJson = { moduleId: input.id, lessons: input.lessons }
  fs.writeFileSync(path.join(dir, 'quiz.json'), JSON.stringify(quizJson, null, 2) + '\n', 'utf-8')

  return { dir }
}
```

- [ ] **Step 2: Register the tool in `mcp-server/src/index.ts`**

Add near the top, alongside the other tool-logic imports:

```typescript
import { writeModuleDraft } from './writeModuleDraft.js'
import type { WriteModuleDraftInput } from './writeModuleDraft.js'
```

Add alongside the other zod schema constants (near `looseQuestionSchema`):

```typescript
const tableFieldSchema = z.object({ field: z.string(), description: z.string() })
const tableEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  purpose: z.string(),
  whereUsed: z.string(),
  keyFields: z.array(tableFieldSchema),
  relatedTables: z.array(z.string()),
})
const lessonSchema = z.object({
  id: z.string(),
  difficulty: z.enum(['basic', 'intermediate', 'advanced']),
  title: z.string(),
  questions: z.array(looseQuestionSchema),
})
```

Add the tool registration (anywhere after `write_practice_set`, before the
`StdioServerTransport` line at the bottom):

```typescript
server.registerTool(
  'write_module_draft',
  {
    title: 'Write new module draft',
    description: 'Tạo 1 module SAP mới (module.json + tables.json + quiz.json) trong src/content/<id>/, chưa commit',
    inputSchema: {
      id: z.string(),
      order: z.number(),
      module: z.object({
        name: z.string(),
        shortName: z.string(),
        icon: z.string(),
        color: z.string(),
        description: z.string(),
        businessPurpose: z.string(),
      }),
      tables: z.array(tableEntrySchema),
      lessons: z.array(lessonSchema),
    },
  },
  async ({ id, order, module, tables, lessons }) => {
    const result = writeModuleDraft({
      id,
      order,
      module,
      tables,
      lessons: lessons as unknown as WriteModuleDraftInput['lessons'],
    })
    return { content: [{ type: 'text', text: `Đã tạo module nháp tại ${result.dir}` }] }
  },
)
```

- [ ] **Step 3: Type-check**

Run: `cd mcp-server && npx tsc --noEmit && cd ..`
Expected: no errors.

- [ ] **Step 4: Manual smoke test**

Run:

```bash
node --experimental-strip-types -e "
import('./mcp-server/src/writeModuleDraft.js').then(async ({ writeModuleDraft }) => {
  const result = writeModuleDraft({
    id: 'zz-test-module',
    order: 99,
    module: { name: 'Test', shortName: 'ZZ', icon: '🧪', color: '#000000', description: 'd', businessPurpose: 'p' },
    tables: [{ id: 'ZZTAB', name: 'Test table', purpose: 'p', whereUsed: 'w', keyFields: [{ field: 'ID', description: 'id' }], relatedTables: [] }],
    lessons: Array.from({ length: 3 }, (_, i) => ({
      id: 'l' + i,
      difficulty: 'basic',
      title: 'Lesson ' + i,
      questions: Array.from({ length: 8 }, (_, j) => ({
        id: 'zz-q-' + i + '-' + j,
        type: 'true-false',
        difficulty: 'basic',
        explanation: 'e',
        statement: 's',
        answer: true,
      })),
    })),
  })
  console.log(result)
})
"
```

Expected: prints `{ dir: '...src/content/zz-test-module' }` and creates that directory with 3
JSON files. Then delete it (this was only a smoke test, not real content):

```bash
rm -rf src/content/zz-test-module
```

Confirm `git status` shows nothing left over from the smoke test before continuing.

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/writeModuleDraft.ts mcp-server/src/index.ts
git commit -m "feat: add write_module_draft MCP tool"
```

## Task 6: MCP tool — `write_lesson_draft`

**Files:**
- Create: `mcp-server/src/writeLessonDraft.ts`
- Modify: `mcp-server/src/index.ts`

**Interfaces:**
- Consumes: `validateQuestion` (Task 4), `lessonSchema` (Task 5)
- Produces: `writeLessonDraft(moduleId: string, lesson: LessonDraftInput): { filePath: string }`

- [ ] **Step 1: Implement `mcp-server/src/writeLessonDraft.ts`**

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './paths.js'
import { validateQuestion } from '../../src/content/validateQuestion.js'
import type { QuizQuestion } from '../../src/content/types.js'

export interface LessonDraftInput {
  id: string
  difficulty: string
  title: string
  questions: QuizQuestion[]
}

export function writeLessonDraft(moduleId: string, lesson: LessonDraftInput): { filePath: string } {
  const filePath = path.join(CONTENT_DIR, moduleId, 'quiz.json')
  if (!fs.existsSync(filePath)) {
    throw new Error(`Không tìm thấy ${filePath} — module "${moduleId}" không tồn tại`)
  }
  if (lesson.questions.length !== 8) {
    throw new Error(`Lesson cần đúng 8 câu hỏi, hiện có ${lesson.questions.length}`)
  }
  const errors = lesson.questions.flatMap((q) => validateQuestion(q))
  if (errors.length > 0) {
    throw new Error(`Câu hỏi không hợp lệ:\n${errors.join('\n')}`)
  }

  const file = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as { moduleId: string; lessons: { id: string }[] }
  if (file.lessons.some((l) => l.id === lesson.id)) {
    throw new Error(`Lesson id "${lesson.id}" đã tồn tại trong module "${moduleId}"`)
  }

  file.lessons.push(lesson)
  fs.writeFileSync(filePath, JSON.stringify(file, null, 2) + '\n', 'utf-8')
  return { filePath }
}
```

- [ ] **Step 2: Register the tool in `mcp-server/src/index.ts`**

Add the import:

```typescript
import { writeLessonDraft } from './writeLessonDraft.js'
import type { LessonDraftInput } from './writeLessonDraft.js'
```

Add the registration:

```typescript
server.registerTool(
  'write_lesson_draft',
  {
    title: 'Write lesson draft',
    description: 'Thêm 1 lesson mới (đúng 8 câu) vào quiz.json của module đang có',
    inputSchema: { moduleId: moduleIdEnum, lesson: lessonSchema },
  },
  async ({ moduleId, lesson }) => {
    const result = writeLessonDraft(moduleId, lesson as unknown as LessonDraftInput)
    return { content: [{ type: 'text', text: `Đã thêm lesson vào ${result.filePath}` }] }
  },
)
```

- [ ] **Step 3: Type-check**

Run: `cd mcp-server && npx tsc --noEmit && cd ..`
Expected: no errors.

- [ ] **Step 4: Manual smoke test**

Run (against the real `mm` module, then clean up):

```bash
node --experimental-strip-types -e "
import('./mcp-server/src/writeLessonDraft.js').then(async ({ writeLessonDraft }) => {
  const result = writeLessonDraft('mm', {
    id: 'zz-test-lesson',
    difficulty: 'basic',
    title: 'Test',
    questions: Array.from({ length: 8 }, (_, j) => ({
      id: 'zz-lesson-q-' + j,
      type: 'true-false',
      difficulty: 'basic',
      explanation: 'e',
      statement: 's',
      answer: true,
    })),
  })
  console.log(result)
})
"
git diff src/content/mm/quiz.json | head -20
git checkout -- src/content/mm/quiz.json
```

Expected: the script prints the `filePath`, the diff shows the new lesson was appended, and
`git checkout` reverts the smoke-test change before you commit anything real.

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/writeLessonDraft.ts mcp-server/src/index.ts
git commit -m "feat: add write_lesson_draft MCP tool"
```

## Task 7: MCP tool — `write_table_entry`

**Files:**
- Create: `mcp-server/src/writeTableEntry.ts`
- Modify: `mcp-server/src/index.ts`

**Interfaces:**
- Consumes: `validateTableEntry`, `getAllTables` (Task 4/5), `tableEntrySchema` (Task 5)
- Produces: `writeTableEntry(moduleId: string, table: Omit<TableEntry, 'module'>): { filePath:
  string }`

- [ ] **Step 1: Implement `mcp-server/src/writeTableEntry.ts`**

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './paths.js'
import { getAllTables } from '../../src/content/index.js'
import { validateTableEntry } from '../../src/content/validateQuestion.js'
import type { TableEntry } from '../../src/content/types.js'

export function writeTableEntry(moduleId: string, table: Omit<TableEntry, 'module'>): { filePath: string } {
  const filePath = path.join(CONTENT_DIR, moduleId, 'tables.json')
  if (!fs.existsSync(filePath)) {
    throw new Error(`Không tìm thấy ${filePath} — module "${moduleId}" không tồn tại`)
  }

  const entry: TableEntry = { ...table, module: moduleId }
  const existingIds = new Set(getAllTables().map((t) => t.id.toUpperCase()))
  existingIds.add(entry.id.toUpperCase())
  const errors = validateTableEntry(entry, existingIds)
  if (errors.length > 0) {
    throw new Error(`Table "${entry.id}" không hợp lệ:\n${errors.join('\n')}`)
  }

  const tables = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as TableEntry[]
  const idx = tables.findIndex((t) => t.id.toUpperCase() === entry.id.toUpperCase())
  if (idx >= 0) tables[idx] = entry
  else tables.push(entry)

  fs.writeFileSync(filePath, JSON.stringify(tables, null, 2) + '\n', 'utf-8')
  return { filePath }
}
```

- [ ] **Step 2: Register the tool in `mcp-server/src/index.ts`**

Add the import: `import { writeTableEntry } from './writeTableEntry.js'`

Add the registration:

```typescript
server.registerTool(
  'write_table_entry',
  {
    title: 'Write table entry',
    description: 'Thêm hoặc sửa 1 entry bảng wiki trong tables.json của module',
    inputSchema: { moduleId: moduleIdEnum, table: tableEntrySchema },
  },
  async ({ moduleId, table }) => {
    const result = writeTableEntry(moduleId, table)
    return { content: [{ type: 'text', text: `Đã ghi table vào ${result.filePath}` }] }
  },
)
```

- [ ] **Step 3: Type-check**

Run: `cd mcp-server && npx tsc --noEmit && cd ..`
Expected: no errors.

- [ ] **Step 4: Manual smoke test**

```bash
node --experimental-strip-types -e "
import('./mcp-server/src/writeTableEntry.js').then(async ({ writeTableEntry }) => {
  const result = writeTableEntry('mm', {
    id: 'ZZTEST',
    name: 'Test table',
    purpose: 'p',
    whereUsed: 'w',
    keyFields: [{ field: 'ID', description: 'id' }],
    relatedTables: [],
  })
  console.log(result)
})
"
git diff src/content/mm/tables.json | head -20
git checkout -- src/content/mm/tables.json
```

Expected: diff shows the new `ZZTEST` entry appended; `git checkout` reverts it.

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/writeTableEntry.ts mcp-server/src/index.ts
git commit -m "feat: add write_table_entry MCP tool"
```

## Task 8: MCP tool — `write_lab_exercise_draft`

**Files:**
- Create: `mcp-server/src/writeLabExerciseDraft.ts`
- Modify: `mcp-server/src/index.ts`

**Interfaces:**
- Consumes: `validateExerciseMeta` (Task 4), `EXERCISE_CATEGORIES` (existing, from
  `src/content/lab/types.ts`)
- Produces: `writeLabExerciseDraft(input: WriteLabExerciseDraftInput): { dir: string }`

- [ ] **Step 1: Implement `mcp-server/src/writeLabExerciseDraft.ts`**

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './paths.js'
import { validateExerciseMeta } from '../../src/content/validateQuestion.js'
import type { ExerciseMeta } from '../../src/content/lab/types.js'

export interface WriteLabExerciseDraftInput {
  id: string
  exercise: ExerciseMeta
  sourceFiles: { filename: string; content: string }[]
}

export function writeLabExerciseDraft(input: WriteLabExerciseDraftInput): { dir: string } {
  if (!/^[a-z0-9-]+$/.test(input.id)) {
    throw new Error(`id "${input.id}" không hợp lệ — chỉ dùng chữ thường, số, dấu gạch ngang`)
  }
  const dir = path.join(CONTENT_DIR, 'lab', input.id)
  if (fs.existsSync(dir)) {
    throw new Error(`Exercise "${input.id}" đã tồn tại tại ${dir}`)
  }

  const actualFilenames = input.sourceFiles.map((f) => f.filename)
  const errors = validateExerciseMeta(input.exercise, actualFilenames)
  if (errors.length > 0) {
    throw new Error(`Exercise không hợp lệ:\n${errors.join('\n')}`)
  }

  const filesDir = path.join(dir, 'files')
  fs.mkdirSync(filesDir, { recursive: true })

  fs.writeFileSync(path.join(dir, 'exercise.json'), JSON.stringify(input.exercise, null, 2) + '\n', 'utf-8')
  for (const file of input.sourceFiles) {
    fs.writeFileSync(path.join(filesDir, file.filename), file.content, 'utf-8')
  }

  return { dir }
}
```

- [ ] **Step 2: Register the tool in `mcp-server/src/index.ts`**

Add the imports:

```typescript
import { writeLabExerciseDraft } from './writeLabExerciseDraft.js'
import { EXERCISE_CATEGORIES } from '../../src/content/lab/types.js'
```

Add the zod schema (near the other schema constants):

```typescript
const exerciseMetaSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.enum(Object.keys(EXERCISE_CATEGORIES) as [string, ...string[]]),
  difficulty: z.enum(['basic', 'intermediate', 'advanced']),
  relatedExerciseIds: z.array(z.string()),
  sourceFiles: z.array(z.string()),
  problemStatement: z.string(),
  concepts: z.array(z.string()),
  tablesUsed: z.array(z.string()),
  walkthrough: z.string(),
  sampleOutput: z.string(),
})
```

Add the registration:

```typescript
server.registerTool(
  'write_lab_exercise_draft',
  {
    title: 'Write Code Lab exercise draft',
    description: 'Tạo 1 bài tập Code Lab mới (exercise.json + file .abap) trong src/content/lab/<id>/, chưa commit',
    inputSchema: {
      id: z.string(),
      exercise: exerciseMetaSchema,
      sourceFiles: z.array(z.object({ filename: z.string(), content: z.string() })),
    },
  },
  async ({ id, exercise, sourceFiles }) => {
    const result = writeLabExerciseDraft({ id, exercise: exercise as ExerciseMeta, sourceFiles })
    return { content: [{ type: 'text', text: `Đã tạo bài tập nháp tại ${result.dir}` }] }
  },
)
```

Note: `exercise as ExerciseMeta` needs `import type { ExerciseMeta } from '../../src/content/lab/types.js'` added to the existing import list too (it's likely already imported for
`exerciseMetaSchema`'s inferred type — add it explicitly if `tsc` complains it's missing).

- [ ] **Step 3: Type-check**

Run: `cd mcp-server && npx tsc --noEmit && cd ..`
Expected: no errors.

- [ ] **Step 4: Manual smoke test**

```bash
node --experimental-strip-types -e "
import('./mcp-server/src/writeLabExerciseDraft.js').then(async ({ writeLabExerciseDraft }) => {
  const result = writeLabExerciseDraft({
    id: 'zz-test-exercise',
    exercise: {
      id: 'zz-test-exercise',
      title: 'Test',
      category: 'algorithm',
      difficulty: 'basic',
      relatedExerciseIds: [],
      sourceFiles: ['zz_test.abap'],
      problemStatement: 'p',
      concepts: ['loop'],
      tablesUsed: [],
      walkthrough: 'w',
      sampleOutput: 'Kết quả minh họa',
    },
    sourceFiles: [{ filename: 'zz_test.abap', content: 'REPORT zz_test.' }],
  })
  console.log(result)
})
"
rm -rf src/content/lab/zz-test-exercise
```

Expected: prints `{ dir: '...src/content/lab/zz-test-exercise' }`, creates the files, then
removed by the cleanup command. Confirm `git status` is clean before continuing.

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/writeLabExerciseDraft.ts mcp-server/src/index.ts
git commit -m "feat: add write_lab_exercise_draft MCP tool"
```

## Task 9: MCP tool — `publish_content`, and update `mcp-server/README.md`

**Files:**
- Create: `mcp-server/src/publishContent.ts`
- Modify: `mcp-server/src/index.ts`
- Modify: `mcp-server/README.md`

**Interfaces:**
- Produces: `publishContent(commitMessage: string): { commitHash: string }`

- [ ] **Step 1: Implement `mcp-server/src/publishContent.ts`**

```typescript
import { execFileSync } from 'node:child_process'
import { REPO_ROOT } from './paths.js'

export function publishContent(commitMessage: string): { commitHash: string } {
  const testResult = runFullTestSuite()
  if (!testResult.success) {
    throw new Error(`Test thất bại, không publish:\n${testResult.output}`)
  }

  try {
    execFileSync('git', ['add', 'src/content'], { cwd: REPO_ROOT })
    execFileSync('git', ['commit', '-m', commitMessage], { cwd: REPO_ROOT })
    execFileSync('git', ['push', 'origin', 'main'], { cwd: REPO_ROOT })
  } catch (err) {
    throw new Error(`Lỗi khi commit/push: ${(err as Error).message}`)
  }

  const commitHash = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf-8' }).trim()
  return { commitHash }
}

function runFullTestSuite(): { success: boolean; output: string } {
  try {
    const output = execFileSync('npx', ['vitest', 'run'], { cwd: REPO_ROOT, encoding: 'utf-8' })
    return { success: true, output }
  } catch (err) {
    const execErr = err as { stdout?: string; message: string }
    return { success: false, output: execErr.stdout ?? execErr.message }
  }
}
```

- [ ] **Step 2: Register the tool in `mcp-server/src/index.ts`**

Add the import: `import { publishContent } from './publishContent.js'`

Add the registration:

```typescript
server.registerTool(
  'publish_content',
  {
    title: 'Publish content',
    description: 'Chạy toàn bộ test suite, nếu pass thì commit + push nội dung src/content lên main',
    inputSchema: { commitMessage: z.string() },
  },
  async ({ commitMessage }) => {
    const result = publishContent(commitMessage)
    return { content: [{ type: 'text', text: `Đã publish, commit ${result.commitHash}` }] }
  },
)
```

- [ ] **Step 3: Type-check**

Run: `cd mcp-server && npx tsc --noEmit && cd ..`
Expected: no errors.

- [ ] **Step 4: Update `mcp-server/README.md`'s tool table**

Replace the existing tool table with:

```markdown
| Tool | Việc làm |
|---|---|
| `list_modules` | 5 module SAP Quest |
| `get_quiz_lessons(moduleId)` | Toàn bộ lesson/câu hỏi hiện có |
| `get_tables(moduleId?)` | Bảng wiki nghiệp vụ |
| `get_exercises()` | Metadata bài tập Code Lab |
| `read_progress_export(path?)` | Tiến trình học đã xuất, kèm câu hỏi trong reviewPool |
| `write_practice_set(id, title, moduleId, note, questions)` | Ghi bộ câu hỏi nháp (ôn tập tạm) |
| `publish_practice_set(id)` | Validate + test hẹp + commit + push bộ câu hỏi ôn tập tạm |
| `write_module_draft(id, order, module, tables, lessons)` | Tạo 1 module SAP mới (module.json + tables.json + quiz.json), chưa commit |
| `write_lesson_draft(moduleId, lesson)` | Thêm 1 lesson (đúng 8 câu) vào module đang có |
| `write_table_entry(moduleId, table)` | Thêm/sửa 1 entry bảng wiki |
| `write_lab_exercise_draft(id, exercise, sourceFiles)` | Tạo 1 bài tập Code Lab mới |
| `publish_content(commitMessage)` | Chạy **toàn bộ** test suite + commit + push nội dung module/lesson/wiki/exercise lên `main` |
```

(This replaces the single old row `| \`get_quiz_lessons\` | \`moduleId\`, \`track\` | ... |`
with the no-`track` version, and adds all 5 new tools.)

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/publishContent.ts mcp-server/src/index.ts mcp-server/README.md
git commit -m "feat: add publish_content MCP tool, document all content-authoring tools"
```

## Task 10: Full verification pass

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 2: Run the build**

Run: `npm run build`
Expected: `tsc -b` and `vite build` succeed.

- [ ] **Step 3: Run the linter**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Type-check the MCP server**

Run: `cd mcp-server && npx tsc --noEmit && cd ..`
Expected: no errors.

- [ ] **Step 5: End-to-end manual check**

1. `npm run dev`, confirm the app still lists all 5 modules in the same order as before (Enterprise Structure, MM, CO, FI-GL, SD).
2. Confirm Wiki (`/wiki`) and Code Lab (`/lab`) still list everything (17 exercises).
3. `git status` — should be clean (no smoke-test leftovers from Tasks 5–8).

---

## Self-Review Notes

- **Spec coverage:** §4.1 (auto-discovery + `order` field) → Tasks 1–3. §4.2 (loosen lesson
  count) → Task 2 Step 1. §4.3 (5 tools) → Tasks 5–9. §4.4 (shared validators) → Task 4.
- **Placeholder scan:** no TBD/TODO; every step has full code or an exact command, including
  smoke-test cleanup commands so no task leaves stray files behind.
- **Type consistency:** `WriteModuleDraftInput`, `LessonDraftInput`, `WriteLabExerciseDraftInput`
  are each defined once (Tasks 5, 6, 8) and imported by exact name into `index.ts` in the same
  task. `validateTableEntry(table, allKnownTableIds: Set<string>)` and
  `validateExerciseMeta(meta, actualFilenames: string[])` signatures are identical between their
  Task 4 definition, Task 4's own test/refactor call sites, and Tasks 5/7/8's mcp-server call
  sites.
