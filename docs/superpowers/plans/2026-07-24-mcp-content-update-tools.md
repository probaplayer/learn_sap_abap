# MCP Content-Authoring Update Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 3 MCP tools — `update_module_info`, `update_lesson_draft`, `update_lab_exercise_draft`
— that let Claude edit existing module/lesson/Code-Lab-exercise content (as opposed to the
existing `write_*` tools, which only create new content and error if the target already exists).

**Architecture:** Mirror the existing `write_*` tool pattern exactly (one file per tool in
`mcp-server/src/`, reusing `validateQuestion`/`validateTableEntry`/`validateExerciseMeta` and the
existing zod schemas in `mcp-server/src/index.ts`), but each `update_*` tool errors if its target
does **not** exist (inverse of `write_*`), and overwrites the existing content instead of creating
new files. `write_table_entry` already upserts and needs no changes. Publishing is unchanged —
the existing `publish_content(commitMessage)` tool commits+pushes any change under `src/content/**`.

**Tech Stack:** No new dependency — same stack as the existing mcp-server tools (`node:fs`,
`node:path`, `zod`, the app-side `validateQuestion.ts`). Corresponding design:
[docs/superpowers/specs/2026-07-24-mcp-content-update-tools-design.md](../specs/2026-07-24-mcp-content-update-tools-design.md).

## Global Constraints

- No new npm dependency in either `package.json` or `mcp-server/package.json`.
- Every `update_*` tool validates its **entire** input before mutating any file on disk — never
  partially write, then discover a validation error (spec §2, "nguyên tắc validate-trước-ghi-sau").
- `update_module_info` never changes a module's `id` (no directory rename) — the input has no
  field for it.
- `update_lesson_draft`/`update_lab_exercise_draft` replace the **entire** target lesson/exercise
  by id — no partial (single-question / single-file) edits in this plan.
- No new automated test for these tools (established mcp-server pattern) — verify each via a
  manual smoke test against real content, then revert the smoke-test change with
  `git checkout --` before committing the real feature (never leave smoke-test mutations in a
  commit).
- `src/content/**` JSON schemas are unchanged — no task in this plan touches `src/content/types.ts`,
  `content.test.ts`, or `lab.test.ts`.

---

## File Structure

- **Create `mcp-server/src/updateModuleInfo.ts`** — `updateModuleInfo(input)`.
- **Create `mcp-server/src/updateLessonDraft.ts`** — `updateLessonDraft(moduleId, lesson)`.
- **Create `mcp-server/src/updateLabExerciseDraft.ts`** — `updateLabExerciseDraft(input)`.
- **Modify `mcp-server/src/index.ts`** — register the 3 new tools, add one new zod schema
  (`moduleInfoSchema`), reuse `lessonSchema`/`exerciseMetaSchema`/`moduleIdEnum` already defined.
- **Modify `mcp-server/README.md`** — extend the tool table from 12 to 15 rows.

## Task 1: `update_module_info`

**Files:**
- Create: `mcp-server/src/updateModuleInfo.ts`
- Modify: `mcp-server/src/index.ts`

**Interfaces:**
- Consumes: `listModules()` (from `mcp-server/src/contentReaders.ts`, already exported — returns
  an array of `{ id: string; order: number; [key: string]: unknown }`)
- Produces: `updateModuleInfo(input: UpdateModuleInfoInput): { filePath: string }`

- [ ] **Step 1: Implement `mcp-server/src/updateModuleInfo.ts`**

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './paths.js'
import { listModules } from './contentReaders.js'

export interface UpdateModuleInfoInput {
  id: string
  module: {
    name: string
    shortName: string
    icon: string
    color: string
    description: string
    businessPurpose: string
    order: number
  }
}

export function updateModuleInfo(input: UpdateModuleInfoInput): { filePath: string } {
  const filePath = path.join(CONTENT_DIR, input.id, 'module.json')
  if (!fs.existsSync(filePath)) {
    throw new Error(`Không tìm thấy ${filePath} — module "${input.id}" không tồn tại`)
  }

  const otherModules = listModules().filter((m) => m.id !== input.id)
  if (otherModules.some((m) => m.order === input.module.order)) {
    throw new Error(`order ${input.module.order} đã được dùng bởi module khác`)
  }

  const moduleJson = { id: input.id, ...input.module }
  fs.writeFileSync(filePath, JSON.stringify(moduleJson, null, 2) + '\n', 'utf-8')
  return { filePath }
}
```

- [ ] **Step 2: Register the tool in `mcp-server/src/index.ts`**

Add near the top, alongside the other tool-logic imports:

```typescript
import { updateModuleInfo } from './updateModuleInfo.js'
```

Add alongside the other zod schema constants (near `tableEntrySchema`):

```typescript
const moduleInfoSchema = z.object({
  name: z.string(),
  shortName: z.string(),
  icon: z.string(),
  color: z.string(),
  description: z.string(),
  businessPurpose: z.string(),
  order: z.number(),
})
```

Add the tool registration (anywhere after `write_module_draft`, before the `StdioServerTransport`
line at the bottom):

```typescript
server.registerTool(
  'update_module_info',
  {
    title: 'Update module info',
    description: 'Sửa metadata (name/shortName/icon/color/description/businessPurpose/order) của 1 module SAP đã có, không đổi id',
    inputSchema: { id: z.string(), module: moduleInfoSchema },
  },
  async ({ id, module }) => {
    const result = updateModuleInfo({ id, module })
    return { content: [{ type: 'text', text: `Đã cập nhật ${result.filePath}` }] }
  },
)
```

- [ ] **Step 3: Type-check**

Run: `cd mcp-server && npx tsc --noEmit && cd ..`
Expected: the same 3 pre-existing, already-documented errors in `../src/content/validateQuestion.ts`
(see `mcp-server/README.md`'s "Lưu ý về `tsc --noEmit`" section) — zero **new** errors.

- [ ] **Step 4: Manual smoke test**

Run (against the real `mm` module — this only tweaks `description`, verified then reverted):

```bash
node --experimental-strip-types -e "
import('./mcp-server/src/updateModuleInfo.js').then(async ({ updateModuleInfo }) => {
  const result = updateModuleInfo({
    id: 'mm',
    module: {
      name: 'Materials Management (MM)',
      shortName: 'MM',
      icon: '📦',
      color: '#58cc02',
      description: 'SMOKE TEST — mô tả tạm thời để kiểm tra update_module_info',
      businessPurpose: 'MM (Materials Management) quản lý dữ liệu vật tư (material master), theo dõi tồn kho theo từng nhà máy (plant) và kho hàng (storage location), hỗ trợ quy trình mua hàng (procurement) từ tạo yêu cầu mua đến nhận hàng. MM lưu trữ định giá vật tư (giá chuẩn, giá trị tồn kho) trong bảng MBEW, dữ liệu này được CO (Controlling) sử dụng để tính giá thành sản phẩm và được FI (Financial Accounting) sử dụng để ghi nhận giá trị hàng tồn kho trên sổ sách. Vì vậy MM là mắt xích quan trọng kết nối chuỗi cung ứng vật lý (nhập/xuất kho) với kế toán tài chính và kế toán quản trị.',
      order: 2,
    },
  })
  console.log(result)
})
"
git diff src/content/mm/module.json
```

Expected: prints `{ filePath: '...src/content/mm/module.json' }`, the diff shows only the
`description` line changed to the SMOKE TEST text.

Then confirm the order-conflict check works (should throw, not write anything):

```bash
node --experimental-strip-types -e "
import('./mcp-server/src/updateModuleInfo.js').then(async ({ updateModuleInfo }) => {
  try {
    updateModuleInfo({
      id: 'mm',
      module: { name: 'x', shortName: 'x', icon: 'x', color: '#000', description: 'x', businessPurpose: 'x', order: 3 },
    })
    console.log('FAILED: should have thrown')
  } catch (err) {
    console.log('OK, threw:', err.message)
  }
})
"
```

Expected: prints `OK, threw: order 3 đã được dùng bởi module khác` (module `co` already uses
`order: 3`).

Then revert the smoke-test change and confirm the working tree is clean:

```bash
git checkout -- src/content/mm/module.json
git status
```

Expected: `git status` shows nothing pending under `src/content/`.

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/updateModuleInfo.ts mcp-server/src/index.ts
git commit -m "feat: add update_module_info MCP tool"
```

## Task 2: `update_lesson_draft`

**Files:**
- Create: `mcp-server/src/updateLessonDraft.ts`
- Modify: `mcp-server/src/index.ts`

**Interfaces:**
- Consumes: `validateQuestion` (existing, from `src/content/validateQuestion.ts`)
- Produces: `updateLessonDraft(moduleId: string, lesson: UpdateLessonDraftInput): { filePath: string }`

- [ ] **Step 1: Implement `mcp-server/src/updateLessonDraft.ts`**

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './paths.js'
import { validateQuestion } from '../../src/content/validateQuestion.js'
import type { QuizQuestion } from '../../src/content/types.js'

export interface UpdateLessonDraftInput {
  id: string
  difficulty: string
  title: string
  questions: QuizQuestion[]
}

export function updateLessonDraft(moduleId: string, lesson: UpdateLessonDraftInput): { filePath: string } {
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
  const idx = file.lessons.findIndex((l) => l.id === lesson.id)
  if (idx === -1) {
    throw new Error(`Không tìm thấy lesson id "${lesson.id}" trong module "${moduleId}"`)
  }

  file.lessons[idx] = lesson
  fs.writeFileSync(filePath, JSON.stringify(file, null, 2) + '\n', 'utf-8')
  return { filePath }
}
```

- [ ] **Step 2: Register the tool in `mcp-server/src/index.ts`**

Add the import:

```typescript
import { updateLessonDraft } from './updateLessonDraft.js'
import type { UpdateLessonDraftInput } from './updateLessonDraft.js'
```

Add the registration:

```typescript
server.registerTool(
  'update_lesson_draft',
  {
    title: 'Update lesson draft',
    description: 'Thay toàn bộ nội dung 1 lesson đã có (đúng 8 câu) trong quiz.json của module, theo lesson.id',
    inputSchema: { moduleId: moduleIdEnum, lesson: lessonSchema },
  },
  async ({ moduleId, lesson }) => {
    const result = updateLessonDraft(moduleId, lesson as unknown as UpdateLessonDraftInput)
    return { content: [{ type: 'text', text: `Đã cập nhật lesson trong ${result.filePath}` }] }
  },
)
```

- [ ] **Step 3: Type-check**

Run: `cd mcp-server && npx tsc --noEmit && cd ..`
Expected: same 3 pre-existing errors only, zero new ones.

- [ ] **Step 4: Manual smoke test**

Run (against the real `mm` module's `basic` lesson — only the `title` is tweaked, questions kept
identical to what's already on disk so the diff is minimal and easy to verify):

```bash
node -e "console.log(JSON.stringify(require('./src/content/mm/quiz.json').lessons.find(l => l.id === 'basic')))" > /tmp/mm-basic-lesson.json
cat /tmp/mm-basic-lesson.json
```

Copy the printed JSON, then run (replace `<PASTE_LESSON_JSON>` with it, keeping `id`/`questions`
identical and only appending `" (SMOKE TEST)"` to `title`):

```bash
node --experimental-strip-types -e "
import('./mcp-server/src/updateLessonDraft.js').then(async ({ updateLessonDraft }) => {
  const lesson = <PASTE_LESSON_JSON>
  lesson.title = lesson.title + ' (SMOKE TEST)'
  const result = updateLessonDraft('mm', lesson)
  console.log(result)
})
"
git diff src/content/mm/quiz.json
```

Expected: prints `{ filePath: '...src/content/mm/quiz.json' }`, diff shows only the `title` line
for the `basic` lesson changed.

Then confirm the not-found check works:

```bash
node --experimental-strip-types -e "
import('./mcp-server/src/updateLessonDraft.js').then(async ({ updateLessonDraft }) => {
  try {
    updateLessonDraft('mm', { id: 'does-not-exist', difficulty: 'basic', title: 'x', questions: Array.from({length:8}, (_,j)=>({id:'zz-q-'+j,type:'true-false',difficulty:'basic',explanation:'e',statement:'s',answer:true})) })
    console.log('FAILED: should have thrown')
  } catch (err) {
    console.log('OK, threw:', err.message)
  }
})
"
```

Expected: prints `OK, threw: Không tìm thấy lesson id "does-not-exist" trong module "mm"`.

Then revert the smoke-test change:

```bash
git checkout -- src/content/mm/quiz.json
git status
```

Expected: `git status` shows nothing pending under `src/content/`.

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/updateLessonDraft.ts mcp-server/src/index.ts
git commit -m "feat: add update_lesson_draft MCP tool"
```

## Task 3: `update_lab_exercise_draft`

**Files:**
- Create: `mcp-server/src/updateLabExerciseDraft.ts`
- Modify: `mcp-server/src/index.ts`

**Interfaces:**
- Consumes: `validateExerciseMeta` (existing, from `src/content/validateQuestion.ts`)
- Produces: `updateLabExerciseDraft(input: UpdateLabExerciseDraftInput): { dir: string }`

- [ ] **Step 1: Implement `mcp-server/src/updateLabExerciseDraft.ts`**

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './paths.js'
import { validateExerciseMeta } from '../../src/content/validateQuestion.js'
import type { ExerciseMeta } from '../../src/content/lab/types.js'

export interface UpdateLabExerciseDraftInput {
  id: string
  exercise: ExerciseMeta
  sourceFiles: { filename: string; content: string }[]
}

export function updateLabExerciseDraft(input: UpdateLabExerciseDraftInput): { dir: string } {
  const dir = path.join(CONTENT_DIR, 'lab', input.id)
  if (!fs.existsSync(dir)) {
    throw new Error(`Không tìm thấy ${dir} — bài tập "${input.id}" không tồn tại`)
  }

  const actualFilenames = input.sourceFiles.map((f) => f.filename)
  const errors = validateExerciseMeta(input.exercise, actualFilenames)
  if (errors.length > 0) {
    throw new Error(`Exercise không hợp lệ:\n${errors.join('\n')}`)
  }
  for (const file of input.sourceFiles) {
    if (path.basename(file.filename) !== file.filename || file.filename.includes('..')) {
      throw new Error(`Tên file không hợp lệ: "${file.filename}" — chỉ được dùng tên file đơn giản, không chứa đường dẫn`)
    }
  }

  const filesDir = path.join(dir, 'files')
  fs.rmSync(filesDir, { recursive: true, force: true })
  fs.mkdirSync(filesDir, { recursive: true })

  fs.writeFileSync(path.join(dir, 'exercise.json'), JSON.stringify(input.exercise, null, 2) + '\n', 'utf-8')
  for (const file of input.sourceFiles) {
    fs.writeFileSync(path.join(filesDir, file.filename), file.content, 'utf-8')
  }

  return { dir }
}
```

- [ ] **Step 2: Register the tool in `mcp-server/src/index.ts`**

Add the import:

```typescript
import { updateLabExerciseDraft } from './updateLabExerciseDraft.js'
```

Add the registration:

```typescript
server.registerTool(
  'update_lab_exercise_draft',
  {
    title: 'Update Code Lab exercise draft',
    description: 'Thay toàn bộ 1 bài tập Code Lab đã có (exercise.json + toàn bộ file .abap) trong src/content/lab/<id>/',
    inputSchema: {
      id: z.string(),
      exercise: exerciseMetaSchema,
      sourceFiles: z.array(z.object({ filename: z.string(), content: z.string() })),
    },
  },
  async ({ id, exercise, sourceFiles }) => {
    const result = updateLabExerciseDraft({ id, exercise: exercise as ExerciseMeta, sourceFiles })
    return { content: [{ type: 'text', text: `Đã cập nhật bài tập tại ${result.dir}` }] }
  },
)
```

Note: `exercise as ExerciseMeta` reuses the same `ExerciseMeta` type import already present in
`index.ts` from Task 8 of the previous plan (`import type { ExerciseMeta } from '../../src/content/lab/types.js'`)
— do not add a duplicate import.

- [ ] **Step 3: Type-check**

Run: `cd mcp-server && npx tsc --noEmit && cd ..`
Expected: same 3 pre-existing errors only, zero new ones.

- [ ] **Step 4: Manual smoke test**

Run (against the real `zday10-exe-01` exercise — only `problemStatement` is tweaked, the single
source file's content is kept byte-identical to what's already on disk):

```bash
node -e "
const fs = require('fs')
const meta = require('./src/content/lab/zday10-exe-01/exercise.json')
const content = fs.readFileSync('./src/content/lab/zday10-exe-01/files/zday10_exe_01_anhbhn.abap', 'utf-8')
fs.writeFileSync('/tmp/zday10-exe-01-meta.json', JSON.stringify(meta))
fs.writeFileSync('/tmp/zday10-exe-01-content.txt', content)
console.log('wrote fixtures')
"
node --experimental-strip-types -e "
import('./mcp-server/src/updateLabExerciseDraft.js').then(async ({ updateLabExerciseDraft }) => {
  const fs = await import('node:fs')
  const exercise = JSON.parse(fs.readFileSync('/tmp/zday10-exe-01-meta.json', 'utf-8'))
  exercise.problemStatement = exercise.problemStatement + ' (SMOKE TEST)'
  const content = fs.readFileSync('/tmp/zday10-exe-01-content.txt', 'utf-8')
  const result = updateLabExerciseDraft({
    id: 'zday10-exe-01',
    exercise,
    sourceFiles: [{ filename: 'zday10_exe_01_anhbhn.abap', content }],
  })
  console.log(result)
})
"
git diff src/content/lab/zday10-exe-01
git status src/content/lab/zday10-exe-01
```

Expected: prints `{ dir: '...src/content/lab/zday10-exe-01' }`; diff shows only the
`problemStatement` line changed; `git status` shows no new/deleted files under
`zday10-exe-01/files/` (confirming the rm+recreate didn't lose or duplicate the one file).

Then confirm the not-found check works:

```bash
node --experimental-strip-types -e "
import('./mcp-server/src/updateLabExerciseDraft.js').then(async ({ updateLabExerciseDraft }) => {
  try {
    updateLabExerciseDraft({
      id: 'does-not-exist',
      exercise: { id: 'does-not-exist', title: 't', category: 'algorithm', difficulty: 'basic', relatedExerciseIds: [], sourceFiles: ['x.abap'], problemStatement: 'p', concepts: ['c'], tablesUsed: [], walkthrough: 'w', sampleOutput: 'Kết quả minh họa' },
      sourceFiles: [{ filename: 'x.abap', content: 'REPORT x.' }],
    })
    console.log('FAILED: should have thrown')
  } catch (err) {
    console.log('OK, threw:', err.message)
  }
})
"
```

Expected: prints `OK, threw: Không tìm thấy ...src/content/lab/does-not-exist — bài tập "does-not-exist" không tồn tại`.

Then revert the smoke-test change:

```bash
git checkout -- src/content/lab/zday10-exe-01
git status
```

Expected: `git status` shows nothing pending under `src/content/`.

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/updateLabExerciseDraft.ts mcp-server/src/index.ts
git commit -m "feat: add update_lab_exercise_draft MCP tool"
```

## Task 4: Update README + full verification pass

**Files:**
- Modify: `mcp-server/README.md`

- [ ] **Step 1: Update the tool table**

In `mcp-server/README.md`, add 3 rows to the existing tool table (after the `write_lab_exercise_draft`
row and before or after `publish_content` — keep `publish_content` last since it's the terminal
step of every flow):

```markdown
| `update_module_info(id, module)` | Sửa metadata module đã có (không đổi id) |
| `update_lesson_draft(moduleId, lesson)` | Thay toàn bộ 1 lesson đã có (đúng 8 câu), theo lesson.id |
| `update_lab_exercise_draft(id, exercise, sourceFiles)` | Thay toàn bộ 1 bài tập Code Lab đã có |
```

resulting in 15 total rows (12 existing + these 3), still ending with the `publish_content` row.

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass (this plan touches no app-side test-covered file, so the count should be
unchanged from before this plan started).

- [ ] **Step 3: Run the build**

Run: `npm run build`
Expected: `tsc -b` and `vite build` succeed.

- [ ] **Step 4: Run the linter**

Run: `npm run lint`
Expected: no new errors (the 1 pre-existing `ProgressContext.tsx` fast-refresh warning is expected
and unrelated).

- [ ] **Step 5: Type-check the MCP server**

Run: `cd mcp-server && npx tsc --noEmit && cd ..`
Expected: the same 3 pre-existing errors only.

- [ ] **Step 6: Confirm no smoke-test leftovers**

Run: `git status`
Expected: clean except for the files this plan intentionally created/modified (staged or
committed) — no stray smoke-test mutations under `src/content/`.

- [ ] **Step 7: Commit**

```bash
git add mcp-server/README.md
git commit -m "docs: document update_module_info/update_lesson_draft/update_lab_exercise_draft"
```

---

## Self-Review Notes

- **Spec coverage:** §3.1 (`update_module_info`) → Task 1. §3.2 (`update_lesson_draft`) → Task 2.
  §3.3 (`update_lab_exercise_draft`) → Task 3. §4 (README) → Task 4. §2's
  validate-before-mutate principle is followed in every task's implementation (existence check →
  content validation → only then file writes; Task 3 additionally validates before the
  `fs.rmSync` of the old `files/` dir). §1's out-of-scope items (no delete, no id-rename, no
  partial edits, no new publish tool) are respected — no task introduces any of them.
- **Placeholder scan:** no TBD/TODO; every step has full code or an exact command with expected
  output, including smoke-test revert commands so no task leaves stray content mutations behind.
- **Type consistency:** `UpdateModuleInfoInput`, `UpdateLessonDraftInput`,
  `UpdateLabExerciseDraftInput` are each defined once (Tasks 1/2/3) and imported by exact name
  into `index.ts` in the same task, mirroring the existing `WriteModuleDraftInput`/
  `LessonDraftInput`/`WriteLabExerciseDraftInput` pattern. `moduleInfoSchema` (Task 1) is a new
  schema; `lessonSchema`/`exerciseMetaSchema`/`moduleIdEnum` (Tasks 2/3) are reused unchanged from
  the existing `write_lesson_draft`/`write_lab_exercise_draft` registrations — same shape, so no
  duplicate schema is introduced.
