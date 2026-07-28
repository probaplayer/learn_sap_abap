# MCP Content Delete/Edit Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6 new MCP tools (`delete_module`, `delete_lesson`, `add_question`, `update_question`, `delete_question`, `reorder_modules`) so Claude Desktop can delete content and edit/delete individual quiz questions without going through whole-lesson replaces, plus relax the fixed "exactly 8 questions per lesson" rule and restrict all new-question authoring to `multiple-choice` only.

**Architecture:** Follow the existing `mcp-server/src/*.ts` pattern exactly — one file per tool, each exporting a single function that validates its input against the on-disk JSON in `src/content/`, then reads/mutates/writes the relevant JSON file directly with `node:fs`. No new abstraction layer; reuse `mcp-server/src/contentReaders.ts` and `src/content/validateQuestion.ts` wherever the existing tools already do.

**Tech Stack:** TypeScript, `tsx` (dev-time TS execution, no build step for mcp-server), `zod` (MCP tool input schemas), `@modelcontextprotocol/sdk`, Vitest (app-side content tests only — mcp-server itself has no automated test suite).

## Global Constraints

- Spec: [docs/superpowers/specs/2026-07-28-mcp-content-crud-tools-design.md](../specs/2026-07-28-mcp-content-crud-tools-design.md) — read it before starting; every task below implements one section of it.
- Every new/modified mcp-server function must validate its entire input **before** writing/deleting anything on disk (validate-then-mutate, never partial-write).
- Every error thrown must be a Vietnamese message that names the specific offending id(s)/count(s) — never a generic "invalid" or "conflict" message. This is a hard requirement from the spec (§2, §3), not a style preference.
- The 6 new tools must return a structured result object (not just a confirmation string) as specified per-tool in spec §3 — the MCP tool handler in `index.ts` serializes this via `JSON.stringify(result, null, 2)` in its response text, same pattern already used by `list_modules`/`get_quiz_lessons`/etc.
- Do **not** modify `validateQuestion()` in `src/content/validateQuestion.ts` — it must keep accepting all 4 question types, because it's what `content.test.ts` uses to validate ~144 existing non-multiple-choice questions. The multiple-choice-only restriction lives in a separate new helper (`requireMultipleChoice`), called only from authoring-tool code paths.
- `mcp-server` has no automated test suite. "Testing" for every task below means: a throwaway smoke-test script run via `npx tsx`, checked by eye against the expected structured output, then deleted (never committed) — matching the pattern documented in the 2026-07-24 spec's Testing section. Every task also ends by running `npx tsc --noEmit` inside `mcp-server/` (must show only the 3 pre-existing cosmetic errors from `validateQuestion.ts`, documented in `mcp-server/README.md`) and, where content files changed, `npx vitest run` from the repo root (must show all tests passing).
- Never leave a temporary/scratch module directory (e.g. `src/content/zz-*`) behind after a task's smoke test — always delete it and confirm with `git status --short` that `src/content/` shows no stray changes before committing.

---

### Task 1: `requireMultipleChoice` helper + relax question-count rule on existing write/update tools

**Files:**
- Create: `mcp-server/src/requireMultipleChoice.ts`
- Modify: `mcp-server/src/writeModuleDraft.ts:34-37` (loop body), `mcp-server/src/writeLessonDraft.ts:19-21`, `mcp-server/src/updateLessonDraft.ts:19-21`
- Modify: `src/content/content.test.ts:55`
- Modify: `CLAUDE.md:48`

**Interfaces:**
- Produces: `requireMultipleChoice(questions: { id?: string; type: string }[]): void` — throws if any question's `type` isn't `'multiple-choice'`. Every later task that authors/edits a single question imports this from `mcp-server/src/requireMultipleChoice.js`.

- [ ] **Step 1: Create the helper**

Create `mcp-server/src/requireMultipleChoice.ts`:

```typescript
export function requireMultipleChoice(questions: { id?: string; type: string }[]): void {
  const bad = questions.filter((q) => q.type !== 'multiple-choice')
  if (bad.length > 0) {
    throw new Error(
      `Chỉ chấp nhận câu hỏi type 'multiple-choice'. Câu hỏi sai type: ${bad
        .map((q) => `${q.id ?? '(không có id)'} (type: ${q.type})`)
        .join(', ')}`,
    )
  }
}
```

- [ ] **Step 2: Wire it into `writeModuleDraft.ts` and relax the count check**

In `mcp-server/src/writeModuleDraft.ts`, add the import at the top (after the existing `import { validateQuestion, validateTableEntry } ...` line):

```typescript
import { requireMultipleChoice } from './requireMultipleChoice.js'
```

Replace the existing loop body (currently lines 34-41):

```typescript
  for (const lesson of input.lessons) {
    if (lesson.questions.length !== 8) {
      throw new Error(`Lesson "${lesson.id}" cần đúng 8 câu hỏi, hiện có ${lesson.questions.length}`)
    }
    const errors = lesson.questions.flatMap((q) => validateQuestion(q))
    if (errors.length > 0) {
      throw new Error(`Lesson "${lesson.id}" có câu hỏi không hợp lệ:\n${errors.join('\n')}`)
    }
  }
```

with:

```typescript
  for (const lesson of input.lessons) {
    if (lesson.questions.length < 8) {
      throw new Error(`Lesson "${lesson.id}" cần tối thiểu 8 câu hỏi, hiện có ${lesson.questions.length}`)
    }
    requireMultipleChoice(lesson.questions)
    const errors = lesson.questions.flatMap((q) => validateQuestion(q))
    if (errors.length > 0) {
      throw new Error(`Lesson "${lesson.id}" có câu hỏi không hợp lệ:\n${errors.join('\n')}`)
    }
  }
```

- [ ] **Step 3: Wire it into `writeLessonDraft.ts`**

Add the import at the top:

```typescript
import { requireMultipleChoice } from './requireMultipleChoice.js'
```

Replace (currently lines 19-25):

```typescript
  if (lesson.questions.length !== 8) {
    throw new Error(`Lesson cần đúng 8 câu hỏi, hiện có ${lesson.questions.length}`)
  }
  const errors = lesson.questions.flatMap((q) => validateQuestion(q))
  if (errors.length > 0) {
    throw new Error(`Câu hỏi không hợp lệ:\n${errors.join('\n')}`)
  }
```

with:

```typescript
  if (lesson.questions.length < 8) {
    throw new Error(`Lesson cần tối thiểu 8 câu hỏi, hiện có ${lesson.questions.length}`)
  }
  requireMultipleChoice(lesson.questions)
  const errors = lesson.questions.flatMap((q) => validateQuestion(q))
  if (errors.length > 0) {
    throw new Error(`Câu hỏi không hợp lệ:\n${errors.join('\n')}`)
  }
```

- [ ] **Step 4: Wire it into `updateLessonDraft.ts`**

Apply the exact same change as Step 3 (same current lines 19-25, same replacement, same import) to `mcp-server/src/updateLessonDraft.ts`.

- [ ] **Step 5: Relax the app-side test assertion**

In `src/content/content.test.ts:55`, change:

```typescript
        expect(lesson.questions.length).toBe(8)
```

to:

```typescript
        expect(lesson.questions.length).toBeGreaterThanOrEqual(8)
```

- [ ] **Step 6: Update CLAUDE.md**

In `CLAUDE.md:48`, change:

```
  **Every module's `quiz.json` must have at least 3 lessons of exactly 8 questions each** — this is
```

to:

```
  **Every module's `quiz.json` must have at least 3 lessons of at least 8 questions each** — this is
```

- [ ] **Step 7: Typecheck**

Run: `cd mcp-server && npx tsc --noEmit`
Expected: only the 3 pre-existing errors in `../src/content/validateQuestion.ts` (documented in `mcp-server/README.md`'s "Lưu ý về `tsc --noEmit`" section) — no new errors.

- [ ] **Step 8: Smoke test — reject non-multiple-choice, reject <8, accept >8**

From the repo root, create a throwaway script `mcp-server/smoke-task1.ts`:

```typescript
import { writeLessonDraft } from './src/writeLessonDraft.js'

const moduleId = 'mm' // any real, existing module — we only test validation, we roll back after

// 1. Should reject: wrong type
try {
  writeLessonDraft(moduleId, {
    id: 'zz-smoke-1',
    difficulty: 'basic',
    title: 'smoke test',
    questions: Array.from({ length: 8 }, (_, i) => ({
      id: `zz-smoke-q${i}`,
      difficulty: 'basic',
      explanation: 'x',
      type: 'true-false',
      statement: 'x',
      answer: true,
    })) as never,
  })
  console.log('FAIL: expected reject on non-multiple-choice, but it succeeded')
} catch (e) {
  console.log('OK (rejected non-multiple-choice):', (e as Error).message)
}

// 2. Should reject: only 7 questions
try {
  writeLessonDraft(moduleId, {
    id: 'zz-smoke-2',
    difficulty: 'basic',
    title: 'smoke test',
    questions: Array.from({ length: 7 }, (_, i) => ({
      id: `zz-smoke-q${i}`,
      difficulty: 'basic',
      explanation: 'x',
      type: 'multiple-choice',
      question: 'x?',
      options: ['a', 'b'],
      answerIndex: 0,
    })) as never,
  })
  console.log('FAIL: expected reject on 7 questions, but it succeeded')
} catch (e) {
  console.log('OK (rejected <8 questions):', (e as Error).message)
}

// 3. Should succeed: 9 questions, all multiple-choice
const result = writeLessonDraft(moduleId, {
  id: 'zz-smoke-3',
  difficulty: 'basic',
  title: 'smoke test',
  questions: Array.from({ length: 9 }, (_, i) => ({
    id: `zz-smoke-q${i}`,
    difficulty: 'basic',
    explanation: 'x',
    type: 'multiple-choice',
    question: 'x?',
    options: ['a', 'b'],
    answerIndex: 0,
  })) as never,
})
console.log('OK (accepted 9 multiple-choice questions):', result.filePath)
```

Run: `cd mcp-server && npx tsx smoke-task1.ts`

Expected output: two `OK (rejected ...)` lines with messages naming the bad type/count, then one `OK (accepted ...)` line.

- [ ] **Step 9: Clean up the smoke test's side effect**

The successful case (case 3) actually wrote a `zz-smoke-3` lesson into `src/content/mm/quiz.json`. Revert it:

```bash
git checkout -- src/content/mm/quiz.json
rm mcp-server/smoke-task1.ts
git status --short
```

Expected: `git status --short` shows no changes under `src/content/` and no `smoke-task1.ts`.

- [ ] **Step 10: Full regression + commit**

Run: `npx vitest run` (from repo root)
Expected: `Test Files 8 passed (8)`, `Tests 55 passed (55)` (same counts as before this task — the assertion changed shape, not the pass count).

```bash
git add mcp-server/src/requireMultipleChoice.ts mcp-server/src/writeModuleDraft.ts mcp-server/src/writeLessonDraft.ts mcp-server/src/updateLessonDraft.ts src/content/content.test.ts CLAUDE.md
git commit -m "feat: restrict new questions to multiple-choice, relax lesson question count to >=8"
```

---

### Task 2: `delete_module` tool

**Files:**
- Create: `mcp-server/src/deleteModule.ts`
- Modify: `mcp-server/src/index.ts` (add import + `server.registerTool('delete_module', ...)`)
- Modify: `mcp-server/README.md` (tool table)

**Interfaces:**
- Consumes: `listModules()`, `getAllTables()` from `mcp-server/src/contentReaders.js` (existing); `CONTENT_DIR`, `GENERATED_DIR` from `mcp-server/src/paths.js` (existing).
- Produces: `deleteModule(id: string): { deletedId: string; remainingModules: { id: string; order: number; name: string }[] }`. No later task depends on this.

- [ ] **Step 1: Implement `deleteModule.ts`**

Create `mcp-server/src/deleteModule.ts`:

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR, GENERATED_DIR } from './paths.js'
import { getAllTables, listModules } from './contentReaders.js'
import type { TableEntry } from '../../src/content/types.js'

export interface DeleteModuleResult {
  deletedId: string
  remainingModules: { id: string; order: number; name: string }[]
}

export function deleteModule(id: string): DeleteModuleResult {
  // Fetch everything we need BEFORE mutating anything on disk. listModules()/getAllTables()
  // derive their id set from contentReaders.ts's MODULE_ORDER, which is computed once when the
  // MCP server process started — it will not reflect this deletion until the process restarts.
  // Reading it now (pre-delete) is correct; re-reading it after fs.rmSync below would throw
  // trying to stat the now-deleted module's files.
  const modules = listModules() as { id: string; order: number; name: string }[]
  if (!modules.some((m) => m.id === id)) {
    throw new Error(`Module "${id}" không tồn tại`)
  }

  const allTables = getAllTables() as TableEntry[]
  const ownTableIds = new Set(allTables.filter((t) => t.module === id).map((t) => t.id.toUpperCase()))
  const referencingTables = allTables.filter(
    (t) => t.module !== id && (t.relatedTables ?? []).some((rid) => ownTableIds.has(rid.toUpperCase())),
  )
  if (referencingTables.length > 0) {
    const list = referencingTables
      .map(
        (t) =>
          `${t.id} (module "${t.module}") -> ${t.relatedTables
            .filter((rid) => ownTableIds.has(rid.toUpperCase()))
            .join(', ')}`,
      )
      .join('; ')
    throw new Error(`Không thể xóa module "${id}": các table sau đang tham chiếu tới table của module này: ${list}`)
  }

  const generatedFiles = fs.existsSync(GENERATED_DIR)
    ? fs.readdirSync(GENERATED_DIR).filter((f) => f.endsWith('.json'))
    : []
  const referencingSets: string[] = []
  for (const file of generatedFiles) {
    const set = JSON.parse(fs.readFileSync(path.join(GENERATED_DIR, file), 'utf-8')) as {
      id: string
      moduleId: string
    }
    if (set.moduleId === id) referencingSets.push(set.id)
  }
  if (referencingSets.length > 0) {
    throw new Error(
      `Không thể xóa module "${id}": các bộ luyện tập sau đang tham chiếu module này: ${referencingSets.join(', ')}`,
    )
  }

  fs.rmSync(path.join(CONTENT_DIR, id), { recursive: true, force: true })

  const remainingModules = modules.filter((m) => m.id !== id).sort((a, b) => a.order - b.order)
  return { deletedId: id, remainingModules }
}
```

- [ ] **Step 2: Register the tool in `index.ts`**

Add the import near the other tool imports (after `import { updateLabExerciseDraft } from './updateLabExerciseDraft.js'`):

```typescript
import { deleteModule } from './deleteModule.js'
```

Add the registration right before the existing `server.registerTool('publish_content', ...)` block:

```typescript
server.registerTool(
  'delete_module',
  {
    title: 'Delete module',
    description:
      'Xóa hẳn 1 module SAP đã có (module.json/tables.json/quiz.json) khỏi src/content/<id>/, chưa commit. ' +
      'Chặn nếu module khác có table relatedTables trỏ vào table của module này, hoặc có bộ luyện tập ' +
      'generated đang tham chiếu moduleId này — lỗi sẽ liệt kê chính xác nơi đang tham chiếu.',
    inputSchema: { id: z.string() },
  },
  async ({ id }) => {
    const result = deleteModule(id)
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  },
)
```

- [ ] **Step 3: Typecheck**

Run: `cd mcp-server && npx tsc --noEmit`
Expected: only the 3 known pre-existing errors.

- [ ] **Step 4: Smoke test — success path + both blocking paths**

Uses only throwaway modules (never touches real content, so there is no risk of actually deleting
a real module even if a test case behaves unexpectedly). Create `mcp-server/smoke-task2.ts`:

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR, GENERATED_DIR } from './src/paths.js'
import { deleteModule } from './src/deleteModule.js'

function makeModule(id: string, tableId: string, relatedTables: string[]) {
  const dir = path.join(CONTENT_DIR, id)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'module.json'),
    JSON.stringify(
      { id, order: 999, name: 'Smoke', shortName: 'ZZ', icon: '🧪', color: '#000000', description: 'x', businessPurpose: 'x' },
      null,
      2,
    ),
  )
  fs.writeFileSync(
    path.join(dir, 'tables.json'),
    JSON.stringify(
      [{ id: tableId, name: 'x', module: id, purpose: 'x', whereUsed: 'x', keyFields: [{ field: 'x', description: 'x' }], relatedTables }],
      null,
      2,
    ),
  )
  fs.writeFileSync(path.join(dir, 'quiz.json'), JSON.stringify({ moduleId: id, lessons: [] }, null, 2))
  return dir
}

// Two throwaway modules: zz-smoke-referrer's table points at zz-smoke-target's table.
const targetDir = makeModule('zz-smoke-target', 'ZZTARGET', [])
const referrerDir = makeModule('zz-smoke-referrer', 'ZZREF', ['ZZTARGET'])
fs.mkdirSync(GENERATED_DIR, { recursive: true })
const genFile = path.join(GENERATED_DIR, 'zz-smoke-set.json')

try {
  // 1. Unknown id should be rejected.
  try {
    deleteModule('zz-does-not-exist')
    console.log('FAIL: expected reject on unknown id')
  } catch (e) {
    console.log('OK (rejected unknown id):', (e as Error).message)
  }

  // 2. deleteModule checks table cross-references before generated-set references (see
  // deleteModule.ts) — with only the table referrer in place (no generated set yet), this must
  // be blocked specifically by the table check.
  try {
    deleteModule('zz-smoke-target')
    console.log('FAIL: expected reject due to table cross-reference')
  } catch (e) {
    console.log('OK (rejected — table cross-reference):', (e as Error).message)
  }

  // 3. Delete the referrer (nothing points at it) — should succeed. This removes the table-level
  // block, isolating the generated-set check for the next case.
  const referrerResult = deleteModule('zz-smoke-referrer')
  console.log('OK (deleted referrer):', JSON.stringify(referrerResult.deletedId), '- dir gone:', !fs.existsSync(referrerDir))

  // 4. Add a throwaway generated practice set referencing zz-smoke-target. With the table
  // referrer gone, this isolates the generated-set guard.
  fs.writeFileSync(genFile, JSON.stringify({ id: 'zz-smoke-set', moduleId: 'zz-smoke-target', questions: [] }, null, 2))
  try {
    deleteModule('zz-smoke-target')
    console.log('FAIL: expected reject due to generated-set reference')
  } catch (e) {
    console.log('OK (rejected — generated-set reference):', (e as Error).message)
  }

  // 5. Remove the generated-set file — no more blockers, deletion should now succeed.
  fs.rmSync(genFile)
  const targetResult = deleteModule('zz-smoke-target')
  console.log('OK (deleted target):', JSON.stringify(targetResult.deletedId), '- dir gone:', !fs.existsSync(targetDir))
} finally {
  // Belt-and-suspenders cleanup in case any assertion above threw before its own cleanup ran.
  fs.rmSync(targetDir, { recursive: true, force: true })
  fs.rmSync(referrerDir, { recursive: true, force: true })
  fs.rmSync(genFile, { force: true })
}
```

Run: `cd mcp-server && npx tsx smoke-task2.ts`

Expected: rejection naming `zz-does-not-exist`; rejection naming table `ZZREF` (module `zz-smoke-referrer`) pointing at `ZZTARGET`; `OK (deleted referrer)` with dir gone `true`; rejection naming generated set `zz-smoke-set`; `OK (deleted target)` with dir gone `true`.

- [ ] **Step 5: Clean up and verify no real content was touched**

```bash
git status --short
```

Expected: no changes at all — every file this smoke test touched lives entirely outside git-tracked history (throwaway module directories under `src/content/`, a throwaway file under `src/content/generated/`), all removed by the script itself.

```bash
rm mcp-server/smoke-task2.ts
git status --short
```

Expected: clean.

- [ ] **Step 6: Update README**

In `mcp-server/README.md`'s tool table, add a row right before the `publish_content` row:

```
| `delete_module(id)` | Xóa hẳn 1 module đã có, chặn nếu có table/bộ luyện tập khác đang tham chiếu module này |
```

- [ ] **Step 7: Commit**

```bash
git add mcp-server/src/deleteModule.ts mcp-server/src/index.ts mcp-server/README.md
git commit -m "feat: add delete_module MCP tool with cross-reference guard"
```

---

### Task 3: `delete_lesson` tool

**Files:**
- Create: `mcp-server/src/deleteLesson.ts`
- Modify: `mcp-server/src/index.ts`
- Modify: `mcp-server/README.md`

**Interfaces:**
- Produces: `deleteLesson(moduleId: string, lessonId: string): { deletedLessonId: string; remainingLessons: { id: string; title: string; difficulty: string; questionCount: number }[] }`.

- [ ] **Step 1: Implement `deleteLesson.ts`**

Create `mcp-server/src/deleteLesson.ts`:

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './paths.js'

export interface DeleteLessonResult {
  deletedLessonId: string
  remainingLessons: { id: string; title: string; difficulty: string; questionCount: number }[]
}

export function deleteLesson(moduleId: string, lessonId: string): DeleteLessonResult {
  const filePath = path.join(CONTENT_DIR, moduleId, 'quiz.json')
  if (!fs.existsSync(filePath)) {
    throw new Error(`Không tìm thấy ${filePath} — module "${moduleId}" không tồn tại`)
  }

  const file = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
    moduleId: string
    lessons: { id: string; title: string; difficulty: string; questions: unknown[] }[]
  }
  const idx = file.lessons.findIndex((l) => l.id === lessonId)
  if (idx === -1) {
    throw new Error(
      `Không tìm thấy lesson id "${lessonId}" trong module "${moduleId}". Lesson hiện có: ${file.lessons
        .map((l) => l.id)
        .join(', ')}`,
    )
  }
  if (file.lessons.length - 1 < 3) {
    throw new Error(
      `Module "${moduleId}" hiện có ${file.lessons.length} lesson — cần giữ tối thiểu 3, không thể xóa thêm`,
    )
  }

  file.lessons.splice(idx, 1)
  fs.writeFileSync(filePath, JSON.stringify(file, null, 2) + '\n', 'utf-8')

  return {
    deletedLessonId: lessonId,
    remainingLessons: file.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      difficulty: l.difficulty,
      questionCount: l.questions.length,
    })),
  }
}
```

- [ ] **Step 2: Register the tool in `index.ts`**

Add the import:

```typescript
import { deleteLesson } from './deleteLesson.js'
```

Add the registration (before `publish_content`, after `delete_module`):

```typescript
server.registerTool(
  'delete_lesson',
  {
    title: 'Delete lesson',
    description:
      'Xóa 1 lesson khỏi quiz.json của module đang có, chưa commit. Chặn nếu module sẽ còn dưới 3 lesson sau khi xóa.',
    inputSchema: { moduleId: moduleIdEnum, lessonId: z.string() },
  },
  async ({ moduleId, lessonId }) => {
    const result = deleteLesson(moduleId, lessonId)
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  },
)
```

- [ ] **Step 3: Typecheck**

Run: `cd mcp-server && npx tsc --noEmit` — expect only the 3 known errors.

- [ ] **Step 4: Smoke test**

Create `mcp-server/smoke-task3.ts`:

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './src/paths.js'
import { deleteLesson } from './src/deleteLesson.js'

const filePath = path.join(CONTENT_DIR, 'mm', 'quiz.json')
const original = fs.readFileSync(filePath, 'utf-8')
const before = JSON.parse(original) as { lessons: { id: string }[] }
console.log('mm currently has', before.lessons.length, 'lessons')

// 1. Unknown lessonId should be rejected.
try {
  deleteLesson('mm', 'zz-does-not-exist')
  console.log('FAIL: expected reject on unknown lessonId')
} catch (e) {
  console.log('OK (rejected unknown lessonId):', (e as Error).message)
}

// 2. Delete lessons one at a time down to the 3-lesson floor, confirming the block fires exactly
// when it should. Restore the original file after, regardless of outcome.
try {
  let lastResult
  const idsInOrder = before.lessons.map((l) => l.id)
  for (let i = 0; i < idsInOrder.length - 3; i++) {
    lastResult = deleteLesson('mm', idsInOrder[i])
    console.log(`OK (deleted ${idsInOrder[i]}), remaining:`, lastResult.remainingLessons.length)
  }
  // Now exactly 3 should remain — deleting one more must be blocked.
  try {
    deleteLesson('mm', idsInOrder[idsInOrder.length - 3])
    console.log('FAIL: expected reject when only 3 lessons remain')
  } catch (e) {
    console.log('OK (rejected — would drop below 3):', (e as Error).message)
  }
} finally {
  fs.writeFileSync(filePath, original, 'utf-8')
  console.log('Restored mm/quiz.json to original content')
}
```

Run: `cd mcp-server && npx tsx smoke-task3.ts`

Expected: rejection for the unknown id naming it, successive `OK (deleted ...)` lines down to 3 remaining, then a final `OK (rejected — would drop below 3)` naming the current count (3) and the required minimum (3), and a final `Restored mm/quiz.json to original content` line.

- [ ] **Step 5: Verify restoration and clean up**

```bash
git status --short
```

Expected: no changes under `src/content/mm/` (the `finally` block restored the exact original bytes).

```bash
rm mcp-server/smoke-task3.ts
```

- [ ] **Step 6: Update README**

Add a row after `delete_module`:

```
| `delete_lesson(moduleId, lessonId)` | Xóa 1 lesson khỏi module, chặn nếu module sẽ còn dưới 3 lesson |
```

- [ ] **Step 7: Commit**

```bash
git add mcp-server/src/deleteLesson.ts mcp-server/src/index.ts mcp-server/README.md
git commit -m "feat: add delete_lesson MCP tool with minimum-3-lessons guard"
```

---

### Task 4: `add_question` tool

**Files:**
- Create: `mcp-server/src/addQuestion.ts`
- Modify: `mcp-server/src/index.ts`
- Modify: `mcp-server/README.md`

**Interfaces:**
- Consumes: `requireMultipleChoice` (Task 1), `validateQuestion` from `src/content/validateQuestion.js` (existing), `MODULE_ORDER`/`getQuizLessons` from `mcp-server/src/contentReaders.js` (existing).
- Produces: `addQuestion(moduleId: string, lessonId: string, question: QuizQuestion): { questionId: string; lessonQuestionCount: number }`.

- [ ] **Step 1: Implement `addQuestion.ts`**

Create `mcp-server/src/addQuestion.ts`:

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './paths.js'
import { MODULE_ORDER, getQuizLessons } from './contentReaders.js'
import { requireMultipleChoice } from './requireMultipleChoice.js'
import { validateQuestion } from '../../src/content/validateQuestion.js'
import type { QuizQuestion } from '../../src/content/types.js'

export interface AddQuestionResult {
  questionId: string
  lessonQuestionCount: number
}

function findExistingQuestionLocation(questionId: string): string | undefined {
  for (const moduleId of MODULE_ORDER) {
    const lessons = getQuizLessons(moduleId) as { id: string; questions: { id: string }[] }[]
    for (const lesson of lessons) {
      if (lesson.questions.some((q) => q.id === questionId)) {
        return `module "${moduleId}", lesson "${lesson.id}"`
      }
    }
  }
  return undefined
}

export function addQuestion(moduleId: string, lessonId: string, question: QuizQuestion): AddQuestionResult {
  const filePath = path.join(CONTENT_DIR, moduleId, 'quiz.json')
  if (!fs.existsSync(filePath)) {
    throw new Error(`Không tìm thấy ${filePath} — module "${moduleId}" không tồn tại`)
  }

  requireMultipleChoice([question])
  const errors = validateQuestion(question)
  if (errors.length > 0) {
    throw new Error(`Câu hỏi không hợp lệ:\n${errors.join('\n')}`)
  }

  const existingLocation = findExistingQuestionLocation(question.id)
  if (existingLocation) {
    throw new Error(`Câu hỏi id "${question.id}" đã tồn tại ở ${existingLocation}`)
  }

  const file = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
    moduleId: string
    lessons: { id: string; questions: QuizQuestion[] }[]
  }
  const lesson = file.lessons.find((l) => l.id === lessonId)
  if (!lesson) {
    throw new Error(
      `Không tìm thấy lesson id "${lessonId}" trong module "${moduleId}". Lesson hiện có: ${file.lessons
        .map((l) => l.id)
        .join(', ')}`,
    )
  }

  lesson.questions.push(question)
  fs.writeFileSync(filePath, JSON.stringify(file, null, 2) + '\n', 'utf-8')

  return { questionId: question.id, lessonQuestionCount: lesson.questions.length }
}
```

- [ ] **Step 2: Register the tool in `index.ts`**

Add the import:

```typescript
import { addQuestion } from './addQuestion.js'
```

Add the registration (after `delete_lesson`):

```typescript
server.registerTool(
  'add_question',
  {
    title: 'Add question to lesson',
    description:
      'Thêm 1 câu hỏi multiple-choice vào cuối 1 lesson đang có, chưa commit. Chặn nếu type khác ' +
      "'multiple-choice', hoặc id câu hỏi đã tồn tại ở bất kỳ module/lesson nào khác.",
    inputSchema: { moduleId: moduleIdEnum, lessonId: z.string(), question: looseQuestionSchema },
  },
  async ({ moduleId, lessonId, question }) => {
    const result = addQuestion(moduleId, lessonId, question as unknown as QuizQuestion)
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  },
)
```

- [ ] **Step 3: Typecheck**

Run: `cd mcp-server && npx tsc --noEmit` — expect only the 3 known errors.

- [ ] **Step 4: Smoke test**

Create `mcp-server/smoke-task4.ts`:

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './src/paths.js'
import { addQuestion } from './src/addQuestion.js'

const filePath = path.join(CONTENT_DIR, 'mm', 'quiz.json')
const original = fs.readFileSync(filePath, 'utf-8')
const before = JSON.parse(original) as { lessons: { id: string; questions: unknown[] }[] }
const targetLessonId = before.lessons[0].id
const beforeCount = before.lessons[0].questions.length

try {
  // 1. Wrong type should be rejected.
  try {
    addQuestion('mm', targetLessonId, {
      id: 'zz-smoke-q1',
      difficulty: 'basic',
      explanation: 'x',
      type: 'true-false',
      statement: 'x',
      answer: true,
    } as never)
    console.log('FAIL: expected reject on non-multiple-choice')
  } catch (e) {
    console.log('OK (rejected non-multiple-choice):', (e as Error).message)
  }

  // 2. Duplicate id (reuse a real existing question id from this same lesson) should be rejected.
  const existingId = (before.lessons[0].questions[0] as { id: string }).id
  try {
    addQuestion('mm', targetLessonId, {
      id: existingId,
      difficulty: 'basic',
      explanation: 'x',
      type: 'multiple-choice',
      question: 'x?',
      options: ['a', 'b'],
      answerIndex: 0,
    } as never)
    console.log('FAIL: expected reject on duplicate id')
  } catch (e) {
    console.log('OK (rejected duplicate id):', (e as Error).message)
  }

  // 3. Valid new question should succeed.
  const result = addQuestion('mm', targetLessonId, {
    id: 'zz-smoke-q-new',
    difficulty: 'basic',
    explanation: 'x',
    type: 'multiple-choice',
    question: 'x?',
    options: ['a', 'b'],
    answerIndex: 0,
  } as never)
  console.log('OK (added):', JSON.stringify(result), 'expected count:', beforeCount + 1)
} finally {
  fs.writeFileSync(filePath, original, 'utf-8')
  console.log('Restored mm/quiz.json to original content')
}
```

Run: `cd mcp-server && npx tsx smoke-task4.ts`

Expected: rejection naming the bad type, rejection naming the duplicate id and its existing location, then `OK (added)` with `lessonQuestionCount` equal to `beforeCount + 1`, then the restore line.

- [ ] **Step 5: Verify restoration and clean up**

```bash
git status --short
rm mcp-server/smoke-task4.ts
```

Expected: clean status.

- [ ] **Step 6: Update README**

```
| `add_question(moduleId, lessonId, question)` | Thêm 1 câu multiple-choice vào cuối lesson, chặn type khác hoặc id trùng toàn hệ thống |
```

- [ ] **Step 7: Commit**

```bash
git add mcp-server/src/addQuestion.ts mcp-server/src/index.ts mcp-server/README.md
git commit -m "feat: add add_question MCP tool"
```

---

### Task 5: `update_question` tool

**Files:**
- Create: `mcp-server/src/updateQuestion.ts`
- Modify: `mcp-server/src/index.ts`
- Modify: `mcp-server/README.md`

**Interfaces:**
- Produces: `updateQuestion(moduleId: string, lessonId: string, questionId: string, question: QuizQuestion): { questionId: string; updatedFields: string[] }`.

- [ ] **Step 1: Implement `updateQuestion.ts`**

Create `mcp-server/src/updateQuestion.ts`:

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './paths.js'
import { requireMultipleChoice } from './requireMultipleChoice.js'
import { validateQuestion } from '../../src/content/validateQuestion.js'
import type { QuizQuestion } from '../../src/content/types.js'

export interface UpdateQuestionResult {
  questionId: string
  updatedFields: string[]
}

export function updateQuestion(
  moduleId: string,
  lessonId: string,
  questionId: string,
  question: QuizQuestion,
): UpdateQuestionResult {
  const filePath = path.join(CONTENT_DIR, moduleId, 'quiz.json')
  if (!fs.existsSync(filePath)) {
    throw new Error(`Không tìm thấy ${filePath} — module "${moduleId}" không tồn tại`)
  }

  const file = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
    moduleId: string
    lessons: { id: string; questions: QuizQuestion[] }[]
  }
  const lesson = file.lessons.find((l) => l.id === lessonId)
  if (!lesson) {
    throw new Error(
      `Không tìm thấy lesson id "${lessonId}" trong module "${moduleId}". Lesson hiện có: ${file.lessons
        .map((l) => l.id)
        .join(', ')}`,
    )
  }

  const idx = lesson.questions.findIndex((q) => q.id === questionId)
  if (idx === -1) {
    throw new Error(
      `Không tìm thấy câu hỏi id "${questionId}" trong lesson "${lessonId}". Câu hỏi hiện có: ${lesson.questions
        .map((q) => q.id)
        .join(', ')}`,
    )
  }

  if (question.id !== questionId) {
    throw new Error(
      `update_question không hỗ trợ đổi id câu hỏi (id cũ "${questionId}", id mới "${question.id}"). ` +
        'Muốn đổi id, dùng delete_question rồi add_question.',
    )
  }

  requireMultipleChoice([question])
  const errors = validateQuestion(question)
  if (errors.length > 0) {
    throw new Error(`Câu hỏi không hợp lệ:\n${errors.join('\n')}`)
  }

  const oldQuestion = lesson.questions[idx] as unknown as Record<string, unknown>
  const newQuestion = question as unknown as Record<string, unknown>
  const updatedFields = Object.keys(newQuestion).filter(
    (key) => JSON.stringify(newQuestion[key]) !== JSON.stringify(oldQuestion[key]),
  )

  lesson.questions[idx] = question
  fs.writeFileSync(filePath, JSON.stringify(file, null, 2) + '\n', 'utf-8')

  return { questionId, updatedFields }
}
```

- [ ] **Step 2: Register the tool in `index.ts`**

Add the import:

```typescript
import { updateQuestion } from './updateQuestion.js'
```

Add the registration (after `add_question`):

```typescript
server.registerTool(
  'update_question',
  {
    title: 'Update question',
    description:
      'Thay nội dung 1 câu hỏi theo id, giữ nguyên vị trí trong lesson, chưa commit. Không hỗ trợ đổi id ' +
      "câu hỏi. Chặn nếu type khác 'multiple-choice'.",
    inputSchema: {
      moduleId: moduleIdEnum,
      lessonId: z.string(),
      questionId: z.string(),
      question: looseQuestionSchema,
    },
  },
  async ({ moduleId, lessonId, questionId, question }) => {
    const result = updateQuestion(moduleId, lessonId, questionId, question as unknown as QuizQuestion)
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  },
)
```

- [ ] **Step 3: Typecheck**

Run: `cd mcp-server && npx tsc --noEmit` — expect only the 3 known errors.

- [ ] **Step 4: Smoke test**

Create `mcp-server/smoke-task5.ts`:

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './src/paths.js'
import { updateQuestion } from './src/updateQuestion.js'

const filePath = path.join(CONTENT_DIR, 'mm', 'quiz.json')
const original = fs.readFileSync(filePath, 'utf-8')
const before = JSON.parse(original) as { lessons: { id: string; questions: { id: string; explanation: string }[] }[] }
const targetLessonId = before.lessons[0].id
const targetQuestion = before.lessons[0].questions[0]

try {
  // 1. Unknown questionId should be rejected.
  try {
    updateQuestion('mm', targetLessonId, 'zz-does-not-exist', {
      id: 'zz-does-not-exist',
      difficulty: 'basic',
      explanation: 'x',
      type: 'multiple-choice',
      question: 'x?',
      options: ['a', 'b'],
      answerIndex: 0,
    } as never)
    console.log('FAIL: expected reject on unknown questionId')
  } catch (e) {
    console.log('OK (rejected unknown questionId):', (e as Error).message)
  }

  // 2. Attempting to change the id should be rejected.
  try {
    updateQuestion('mm', targetLessonId, targetQuestion.id, {
      id: 'zz-different-id',
      difficulty: 'basic',
      explanation: 'x',
      type: 'multiple-choice',
      question: 'x?',
      options: ['a', 'b'],
      answerIndex: 0,
    } as never)
    console.log('FAIL: expected reject on id change')
  } catch (e) {
    console.log('OK (rejected id change):', (e as Error).message)
  }

  // 3. Valid update (only explanation changes) should succeed and report exactly that field.
  const result = updateQuestion('mm', targetLessonId, targetQuestion.id, {
    id: targetQuestion.id,
    difficulty: 'basic',
    explanation: 'smoke-test-explanation-changed',
    type: 'multiple-choice',
    question: 'x?',
    options: ['a', 'b'],
    answerIndex: 0,
  } as never)
  console.log('OK (updated):', JSON.stringify(result))
} finally {
  fs.writeFileSync(filePath, original, 'utf-8')
  console.log('Restored mm/quiz.json to original content')
}
```

Run: `cd mcp-server && npx tsx smoke-task5.ts`

Expected: rejection naming the unknown id (with the list of real ids in that lesson), rejection naming both the old and attempted new id, then `OK (updated)` whose `updatedFields` array contains at least `explanation` (and likely `question`/`options`/`answerIndex` too, since the smoke script overwrites the whole question object — that's expected, not a bug), then the restore line.

- [ ] **Step 5: Verify restoration and clean up**

```bash
git status --short
rm mcp-server/smoke-task5.ts
```

Expected: clean status.

- [ ] **Step 6: Update README**

```
| `update_question(moduleId, lessonId, questionId, question)` | Thay nội dung 1 câu hỏi theo id, giữ vị trí, không đổi id được |
```

- [ ] **Step 7: Commit**

```bash
git add mcp-server/src/updateQuestion.ts mcp-server/src/index.ts mcp-server/README.md
git commit -m "feat: add update_question MCP tool"
```

---

### Task 6: `delete_question` tool

**Files:**
- Create: `mcp-server/src/deleteQuestion.ts`
- Modify: `mcp-server/src/index.ts`
- Modify: `mcp-server/README.md`

**Interfaces:**
- Produces: `deleteQuestion(moduleId: string, lessonId: string, questionId: string): { deletedQuestionId: string; remainingQuestionIds: string[] }`.

- [ ] **Step 1: Implement `deleteQuestion.ts`**

Create `mcp-server/src/deleteQuestion.ts`:

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './paths.js'
import type { QuizQuestion } from '../../src/content/types.js'

export interface DeleteQuestionResult {
  deletedQuestionId: string
  remainingQuestionIds: string[]
}

export function deleteQuestion(moduleId: string, lessonId: string, questionId: string): DeleteQuestionResult {
  const filePath = path.join(CONTENT_DIR, moduleId, 'quiz.json')
  if (!fs.existsSync(filePath)) {
    throw new Error(`Không tìm thấy ${filePath} — module "${moduleId}" không tồn tại`)
  }

  const file = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
    moduleId: string
    lessons: { id: string; questions: QuizQuestion[] }[]
  }
  const lesson = file.lessons.find((l) => l.id === lessonId)
  if (!lesson) {
    throw new Error(
      `Không tìm thấy lesson id "${lessonId}" trong module "${moduleId}". Lesson hiện có: ${file.lessons
        .map((l) => l.id)
        .join(', ')}`,
    )
  }

  const idx = lesson.questions.findIndex((q) => q.id === questionId)
  if (idx === -1) {
    throw new Error(
      `Không tìm thấy câu hỏi id "${questionId}" trong lesson "${lessonId}". Câu hỏi hiện có: ${lesson.questions
        .map((q) => q.id)
        .join(', ')}`,
    )
  }

  if (lesson.questions.length - 1 < 8) {
    throw new Error(
      `Lesson "${lessonId}" hiện có ${lesson.questions.length} câu — cần giữ tối thiểu 8, không thể xóa thêm`,
    )
  }

  lesson.questions.splice(idx, 1)
  fs.writeFileSync(filePath, JSON.stringify(file, null, 2) + '\n', 'utf-8')

  return { deletedQuestionId: questionId, remainingQuestionIds: lesson.questions.map((q) => q.id) }
}
```

- [ ] **Step 2: Register the tool in `index.ts`**

Add the import:

```typescript
import { deleteQuestion } from './deleteQuestion.js'
```

Add the registration (after `update_question`):

```typescript
server.registerTool(
  'delete_question',
  {
    title: 'Delete question',
    description: 'Xóa 1 câu hỏi khỏi lesson theo id, chưa commit. Chặn nếu lesson sẽ còn dưới 8 câu sau khi xóa.',
    inputSchema: { moduleId: moduleIdEnum, lessonId: z.string(), questionId: z.string() },
  },
  async ({ moduleId, lessonId, questionId }) => {
    const result = deleteQuestion(moduleId, lessonId, questionId)
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  },
)
```

- [ ] **Step 3: Typecheck**

Run: `cd mcp-server && npx tsc --noEmit` — expect only the 3 known errors.

- [ ] **Step 4: Smoke test**

Create `mcp-server/smoke-task6.ts`. This needs a lesson with more than 8 questions to prove deletion succeeds down to 8 and then blocks — use `add_question` (Task 4, already merged) to pad a real lesson up first, then exercise `delete_question`:

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './src/paths.js'
import { addQuestion } from './src/addQuestion.js'
import { deleteQuestion } from './src/deleteQuestion.js'

const filePath = path.join(CONTENT_DIR, 'mm', 'quiz.json')
const original = fs.readFileSync(filePath, 'utf-8')
const before = JSON.parse(original) as { lessons: { id: string; questions: { id: string }[] }[] }
const targetLessonId = before.lessons[0].id

try {
  // Pad the lesson to 9 questions so we can delete one and still be at the 8-question floor.
  addQuestion('mm', targetLessonId, {
    id: 'zz-smoke-pad',
    difficulty: 'basic',
    explanation: 'x',
    type: 'multiple-choice',
    question: 'x?',
    options: ['a', 'b'],
    answerIndex: 0,
  } as never)

  // 1. Unknown questionId should be rejected.
  try {
    deleteQuestion('mm', targetLessonId, 'zz-does-not-exist')
    console.log('FAIL: expected reject on unknown questionId')
  } catch (e) {
    console.log('OK (rejected unknown questionId):', (e as Error).message)
  }

  // 2. Deleting the padding question (9 -> 8) should succeed.
  const result = deleteQuestion('mm', targetLessonId, 'zz-smoke-pad')
  console.log('OK (deleted pad question):', JSON.stringify(result))

  // 3. Deleting again (would go 8 -> 7) should be blocked.
  const anotherId = result.remainingQuestionIds[0]
  try {
    deleteQuestion('mm', targetLessonId, anotherId)
    console.log('FAIL: expected reject when only 8 questions remain')
  } catch (e) {
    console.log('OK (rejected — would drop below 8):', (e as Error).message)
  }
} finally {
  fs.writeFileSync(filePath, original, 'utf-8')
  console.log('Restored mm/quiz.json to original content')
}
```

Run: `cd mcp-server && npx tsx smoke-task6.ts`

Expected: rejection naming the unknown id, `OK (deleted pad question)`, then rejection naming the current count (8) and the required minimum (8), then the restore line.

- [ ] **Step 5: Verify restoration and clean up**

```bash
git status --short
rm mcp-server/smoke-task6.ts
```

Expected: clean status.

- [ ] **Step 6: Update README**

```
| `delete_question(moduleId, lessonId, questionId)` | Xóa 1 câu hỏi khỏi lesson, chặn nếu lesson sẽ còn dưới 8 câu |
```

- [ ] **Step 7: Commit**

```bash
git add mcp-server/src/deleteQuestion.ts mcp-server/src/index.ts mcp-server/README.md
git commit -m "feat: add delete_question MCP tool"
```

---

### Task 7: `reorder_modules` tool

**Files:**
- Create: `mcp-server/src/reorderModules.ts`
- Modify: `mcp-server/src/index.ts`
- Modify: `mcp-server/README.md`

**Interfaces:**
- Produces: `reorderModules(orderedIds: string[]): { newOrder: { id: string; order: number }[] }`.

- [ ] **Step 1: Implement `reorderModules.ts`**

Create `mcp-server/src/reorderModules.ts`:

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './paths.js'
import { listModules } from './contentReaders.js'

export interface ReorderModulesResult {
  newOrder: { id: string; order: number }[]
}

export function reorderModules(orderedIds: string[]): ReorderModulesResult {
  const currentIds = (listModules() as { id: string }[]).map((m) => m.id)
  const currentSet = new Set(currentIds)
  const inputSet = new Set(orderedIds)

  const missing = currentIds.filter((id) => !inputSet.has(id))
  const unknown = orderedIds.filter((id) => !currentSet.has(id))
  const seen = new Set<string>()
  const duplicates: string[] = []
  for (const id of orderedIds) {
    if (seen.has(id)) duplicates.push(id)
    seen.add(id)
  }

  if (missing.length > 0 || unknown.length > 0 || duplicates.length > 0) {
    const parts: string[] = []
    if (missing.length > 0) parts.push(`thiếu: ${missing.join(', ')}`)
    if (unknown.length > 0) parts.push(`không tồn tại/thừa: ${unknown.join(', ')}`)
    if (duplicates.length > 0) parts.push(`bị lặp: ${duplicates.join(', ')}`)
    throw new Error(
      `orderedIds không khớp danh sách module hiện có (${parts.join('; ')}). Module hiện có: ${currentIds.join(', ')}`,
    )
  }

  const newOrder = orderedIds.map((id, index) => ({ id, order: index + 1 }))
  for (const { id, order } of newOrder) {
    const filePath = path.join(CONTENT_DIR, id, 'module.json')
    const moduleJson = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>
    moduleJson.order = order
    fs.writeFileSync(filePath, JSON.stringify(moduleJson, null, 2) + '\n', 'utf-8')
  }

  return { newOrder }
}
```

- [ ] **Step 2: Register the tool in `index.ts`**

Add the import:

```typescript
import { reorderModules } from './reorderModules.js'
```

Add the registration (after `delete_question`):

```typescript
server.registerTool(
  'reorder_modules',
  {
    title: 'Reorder modules',
    description:
      'Gán lại order hiển thị cho toàn bộ module theo 1 danh sách id mới, chưa commit. orderedIds phải là ' +
      'hoán vị chính xác của toàn bộ module id hiện có (gọi list_modules trước nếu chưa chắc danh sách).',
    inputSchema: { orderedIds: z.array(z.string()) },
  },
  async ({ orderedIds }) => {
    const result = reorderModules(orderedIds)
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  },
)
```

- [ ] **Step 3: Typecheck**

Run: `cd mcp-server && npx tsc --noEmit` — expect only the 3 known errors.

- [ ] **Step 4: Smoke test**

Create `mcp-server/smoke-task7.ts`:

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './src/paths.js'
import { listModules } from './src/contentReaders.js'
import { reorderModules } from './src/reorderModules.js'

const modules = listModules() as { id: string; order: number }[]
const originalFiles = new Map(
  modules.map((m) => [m.id, fs.readFileSync(path.join(CONTENT_DIR, m.id, 'module.json'), 'utf-8')]),
)
const currentIds = modules.map((m) => m.id)

try {
  // 1. Missing one id should be rejected.
  try {
    reorderModules(currentIds.slice(1))
    console.log('FAIL: expected reject on missing id')
  } catch (e) {
    console.log('OK (rejected missing id):', (e as Error).message)
  }

  // 2. An unknown id should be rejected.
  try {
    reorderModules([...currentIds, 'zz-does-not-exist'])
    console.log('FAIL: expected reject on unknown id')
  } catch (e) {
    console.log('OK (rejected unknown id):', (e as Error).message)
  }

  // 3. A duplicate should be rejected.
  try {
    reorderModules([...currentIds.slice(1), currentIds[0], currentIds[0]])
    console.log('FAIL: expected reject on duplicate id')
  } catch (e) {
    console.log('OK (rejected duplicate id):', (e as Error).message)
  }

  // 4. A valid full reversal should succeed.
  const reversed = [...currentIds].reverse()
  const result = reorderModules(reversed)
  console.log('OK (reordered):', JSON.stringify(result.newOrder))
} finally {
  for (const [id, content] of originalFiles) {
    fs.writeFileSync(path.join(CONTENT_DIR, id, 'module.json'), content, 'utf-8')
  }
  console.log('Restored all module.json files to original content')
}
```

Run: `cd mcp-server && npx tsx smoke-task7.ts`

Expected: three rejections each naming the specific problem (missing/unknown/duplicate id, plus the full current id list), then `OK (reordered)` showing the exact reversed order with `order` values `1..N`, then the restore line.

- [ ] **Step 5: Verify restoration and clean up**

```bash
git status --short
rm mcp-server/smoke-task7.ts
```

Expected: clean status.

- [ ] **Step 6: Update README**

```
| `reorder_modules(orderedIds)` | Gán lại order hiển thị cho toàn bộ module theo 1 danh sách id mới |
```

- [ ] **Step 7: Commit**

```bash
git add mcp-server/src/reorderModules.ts mcp-server/src/index.ts mcp-server/README.md
git commit -m "feat: add reorder_modules MCP tool"
```

---

### Task 8: Final regression pass

**Files:** none (verification only).

- [ ] **Step 1: Full typecheck**

Run: `cd mcp-server && npx tsc --noEmit`
Expected: only the 3 pre-existing errors in `../src/content/validateQuestion.ts`.

- [ ] **Step 2: Full app test suite**

Run: `npx vitest run` (from repo root)
Expected: `Test Files 8 passed (8)`, `Tests 55 passed (55)`.

- [ ] **Step 3: Confirm no stray scratch files**

```bash
git status --short
```

Expected: clean (nothing but files intentionally committed in Tasks 1-7; no leftover `smoke-task*.ts` files, no stray `zz-*` content directories).

- [ ] **Step 4: Confirm the MCP tool count in README matches reality**

```bash
grep -c '^| \`' mcp-server/README.md
```

Expected: 21 (15 existing + 6 new). If it doesn't match, find the missing row and add it (this would mean a Step 6 in an earlier task was skipped).

- [ ] **Step 5: Final commit (only if Steps 1-4 required any fixes)**

If everything already passed, there is nothing to commit here — Tasks 1-7 already committed their own work. If a fix was needed in Step 4, commit it:

```bash
git add mcp-server/README.md
git commit -m "docs: fix mcp-server tool table row count"
```
