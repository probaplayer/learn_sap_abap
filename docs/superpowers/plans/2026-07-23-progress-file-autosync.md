# Progress File Auto-Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the SAP Quest web app automatically keep a local JSON file in sync with the
in-memory `ProgressState`, so the `sap-quest` MCP server (`mcp-server/src/progressExport.ts`)
can always read fresh progress without the user manually clicking "⬇️ Xuất" every time.

**Architecture:** A new browser-only module (`src/state/fileSync.ts`) wraps the File System
Access API (`showSaveFilePicker`, `FileSystemFileHandle`) plus IndexedDB (to remember the
chosen file handle across page loads). `ProgressContext.tsx` gets a parallel write-on-change
effect (localStorage stays the source of truth; the synced file is a mirror). `ProgressHeader.tsx`
gets a new button to opt in.

**Tech Stack:** React 19 + TypeScript, Vitest + `@testing-library/react` (existing stack, no new
dependencies). Corresponding design: [docs/superpowers/specs/2026-07-23-progress-autosync-and-content-authoring-design.md](../specs/2026-07-23-progress-autosync-and-content-authoring-design.md), Phần A.

## Global Constraints

- No new npm dependency — implement IndexedDB persistence and File System Access API wrapping
  by hand (spec Phần A, mục 2.2).
- `localStorage` remains the app's source of truth; the synced file is a write-only mirror. Do
  not read progress back from the file anywhere in the web app.
- Feature must be fully absent (no button, no errors) in browsers without
  `showSaveFilePicker` (Firefox/Safari) — pure feature detection, no polyfill.
- A permission write failure (revoked permission, user deleted the file, etc.) must never throw
  an unhandled error into the UI — log to console and skip that write.
- No automated test is feasible for the actual browser File System Access / IndexedDB calls in
  Vitest + jsdom (jsdom does not implement `indexedDB` or `showSaveFilePicker`) — per the
  approved spec, these are verified manually in Chrome/Edge instead. Code that does NOT touch
  those two browser APIs directly (i.e. `ProgressContext.tsx`'s wiring, tested via mocking the
  `fileSync` module) IS unit tested.

---

## File Structure

- **Create `src/state/fileSync.ts`** — all File System Access API + IndexedDB logic, isolated
  behind small exported functions so `ProgressContext.tsx` never touches `window`/`indexedDB`
  directly. Local ambient TypeScript interfaces defined in this file only (no global `.d.ts`
  changes, no dependency on `@types/wicg-file-system-access`) — see Task 1.
- **Modify `src/state/ProgressContext.tsx`** — load a persisted handle on mount, write the file
  on every `progress` change, expose `fileSyncSupported`, `fileSyncEnabled`, `enableFileSync()`.
- **Modify `src/components/ProgressHeader.tsx`** — new button, only rendered when
  `fileSyncSupported` is true.

## Task 1: Feature detection + local browser-API types

**Files:**
- Create: `src/state/fileSync.ts`
- Test: `src/state/fileSync.test.ts`

**Interfaces:**
- Produces: `isFileSyncSupported(): boolean`

- [ ] **Step 1: Write the failing test**

```typescript
// src/state/fileSync.test.ts
import { afterEach, describe, expect, it } from 'vitest'
import { isFileSyncSupported } from './fileSync'

describe('isFileSyncSupported', () => {
  afterEach(() => {
    // @ts-expect-error test-only cleanup of a property we add below
    delete window.showSaveFilePicker
  })

  it('returns false when the browser has no showSaveFilePicker', () => {
    expect(isFileSyncSupported()).toBe(false)
  })

  it('returns true when the browser exposes showSaveFilePicker', () => {
    // @ts-expect-error assigning a stub for feature-detection purposes only
    window.showSaveFilePicker = () => Promise.resolve()
    expect(isFileSyncSupported()).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/fileSync.test.ts`
Expected: FAIL — `Cannot find module './fileSync'` (file doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/state/fileSync.ts
export function isFileSyncSupported(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/state/fileSync.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/state/fileSync.ts src/state/fileSync.test.ts
git commit -m "feat: add file-sync feature detection"
```

## Task 2: File System Access + IndexedDB wrapper (browser-only, manually verified)

**Files:**
- Modify: `src/state/fileSync.ts`

**Interfaces:**
- Consumes: `isFileSyncSupported()` (Task 1)
- Produces:
  - `pickSyncFile(): Promise<ProgressFileHandle>`
  - `storeHandle(handle: ProgressFileHandle): Promise<void>`
  - `loadStoredHandle(): Promise<ProgressFileHandle | null>`
  - `hasWritePermission(handle: ProgressFileHandle): Promise<boolean>`
  - `writeSyncFile(handle: ProgressFileHandle, progress: ProgressState): Promise<void>`
  - Type `ProgressFileHandle` (exported)

No automated test here (Global Constraints) — jsdom has neither `indexedDB` nor
`showSaveFilePicker`. Implement directly, verify with `tsc -b` (type-check) and the manual
browser check in Step 3.

- [ ] **Step 1: Implement the wrapper**

```typescript
// src/state/fileSync.ts (append to the file from Task 1)
import type { ProgressState } from './types'

export interface ProgressFileHandle {
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>
  queryPermission(descriptor: { mode: 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>
  requestPermission(descriptor: { mode: 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>
}

interface SaveFilePickerWindow extends Window {
  showSaveFilePicker(options?: {
    suggestedName?: string
    types?: { description: string; accept: Record<string, string[]> }[]
  }): Promise<ProgressFileHandle>
}

const DB_NAME = 'sap-quest-file-sync'
const STORE_NAME = 'handles'
const HANDLE_KEY = 'progress-file-handle'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function pickSyncFile(): Promise<ProgressFileHandle> {
  if (!isFileSyncSupported()) {
    throw new Error('File System Access API không khả dụng trên trình duyệt này')
  }
  return (window as unknown as SaveFilePickerWindow).showSaveFilePicker({
    suggestedName: 'sap-quest-progress.json',
    types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
  })
}

export async function storeHandle(handle: ProgressFileHandle): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function loadStoredHandle(): Promise<ProgressFileHandle | null> {
  const db = await openDb()
  const handle = await new Promise<ProgressFileHandle | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(HANDLE_KEY)
    request.onsuccess = () => resolve((request.result as ProgressFileHandle | undefined) ?? null)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return handle
}

export async function hasWritePermission(handle: ProgressFileHandle): Promise<boolean> {
  const opts = { mode: 'readwrite' as const }
  const status = await handle.queryPermission(opts)
  if (status === 'granted') return true
  const requested = await handle.requestPermission(opts)
  return requested === 'granted'
}

export async function writeSyncFile(handle: ProgressFileHandle, progress: ProgressState): Promise<void> {
  const writable = await handle.createWritable()
  await writable.write(JSON.stringify(progress, null, 2))
  await writable.close()
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b --noEmit`
Expected: no errors referencing `fileSync.ts`. If TypeScript complains that `IDBDatabase` /
`indexedDB` are not found, add `"lib": ["ES2020", "DOM", "DOM.Iterable"]` to
`tsconfig.app.json`'s `compilerOptions` (check the existing `lib` array first — DOM is very
likely already present since the app already calls `window.localStorage`; only touch this if
`tsc` actually errors).

- [ ] **Step 3: Manual browser verification**

1. `npm run dev`, open the app in Chrome or Edge.
2. Open the browser DevTools console.
3. Paste and run:
   ```js
   const { pickSyncFile, storeHandle, loadStoredHandle, hasWritePermission, writeSyncFile } =
     await import('/src/state/fileSync.ts')
   const handle = await pickSyncFile() // choose/create a file in the picker
   await storeHandle(handle)
   const loaded = await loadStoredHandle()
   console.log('same handle after reload from IndexedDB:', await loaded.isSameEntry(handle))
   console.log('has permission:', await hasWritePermission(handle))
   await writeSyncFile(handle, { xp: 1, completedLessons: [], reviewPool: {}, perfectLessons: [], lastActiveDate: null, streak: 0, badges: [] })
   ```
4. Confirm the picked file now contains that JSON on disk.
5. Reload the page and re-run only `loadStoredHandle()` — confirm it resolves to a handle
   (proves IndexedDB persistence survives a reload) without a new file picker dialog.

- [ ] **Step 4: Commit**

```bash
git add src/state/fileSync.ts
git commit -m "feat: add File System Access + IndexedDB wrapper for progress sync"
```

## Task 3: Wire auto-sync into `ProgressContext`

**Files:**
- Modify: `src/state/ProgressContext.tsx`
- Test: `src/state/ProgressContext.test.tsx`

**Interfaces:**
- Consumes: `isFileSyncSupported`, `pickSyncFile`, `storeHandle`, `loadStoredHandle`,
  `hasWritePermission`, `writeSyncFile`, `ProgressFileHandle` (Tasks 1–2)
- Produces (added to `ProgressContextValue`):
  - `fileSyncSupported: boolean`
  - `fileSyncEnabled: boolean`
  - `enableFileSync: () => Promise<boolean>`

This task IS unit-testable: mock `./fileSync` entirely so no real browser API is touched.

- [ ] **Step 1: Write the failing test**

Add to `src/state/ProgressContext.test.tsx` (new `describe` block, keep the existing ones
untouched):

```typescript
// add near the top of src/state/ProgressContext.test.tsx, alongside the existing imports
import { vi } from 'vitest'

vi.mock('./fileSync', () => ({
  isFileSyncSupported: vi.fn(() => true),
  loadStoredHandle: vi.fn(() => Promise.resolve(null)),
  pickSyncFile: vi.fn(() => Promise.resolve({ id: 'stub-handle' })),
  storeHandle: vi.fn(() => Promise.resolve()),
  hasWritePermission: vi.fn(() => Promise.resolve(true)),
  writeSyncFile: vi.fn(() => Promise.resolve()),
}))

// add this describe block at the end of the file
describe('file sync', () => {
  it('starts disabled, enables after enableFileSync resolves, and writes on progress change', async () => {
    const fileSync = await import('./fileSync')
    const { result } = renderHook(() => useProgress(), { wrapper })

    expect(result.current.fileSyncSupported).toBe(true)
    expect(result.current.fileSyncEnabled).toBe(false)

    await act(async () => {
      const enabled = await result.current.enableFileSync()
      expect(enabled).toBe(true)
    })
    expect(result.current.fileSyncEnabled).toBe(true)
    expect(fileSync.storeHandle).toHaveBeenCalledWith({ id: 'stub-handle' })

    await act(async () => {
      result.current.recordPracticeAnswer(true)
    })
    expect(fileSync.writeSyncFile).toHaveBeenCalledWith(
      { id: 'stub-handle' },
      expect.objectContaining({ xp: 10 }),
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/ProgressContext.test.tsx`
Expected: FAIL — `fileSyncSupported`/`fileSyncEnabled`/`enableFileSync` are `undefined` on
`result.current`.

- [ ] **Step 3: Write minimal implementation**

Modify `src/state/ProgressContext.tsx`:

```typescript
// add to the top-level imports
import {
  isFileSyncSupported,
  loadStoredHandle,
  pickSyncFile,
  storeHandle,
  hasWritePermission,
  writeSyncFile,
  type ProgressFileHandle,
} from './fileSync'
```

```typescript
// extend ProgressContextValue
interface ProgressContextValue {
  progress: ProgressState
  level: number
  recordAnswer: (args: RecordAnswerArgs) => number
  recordPracticeAnswer: (correct: boolean) => number
  completeLesson: (args: CompleteLessonArgs) => { isFirstCompletion: boolean; bonusXp: number; newlyEarnedBadges: string[] }
  isLessonUnlocked: (moduleId: string, track: Track, lessonIdsInOrder: string[], lessonId: string) => boolean
  reviewQuestionIds: (moduleId: string) => string[]
  fileSyncSupported: boolean
  fileSyncEnabled: boolean
  enableFileSync: () => Promise<boolean>
}
```

```tsx
// inside ProgressProvider, alongside the existing `progress`/`latestRef` state
const [syncHandle, setSyncHandle] = useState<ProgressFileHandle | null>(null)

useEffect(() => {
  if (!isFileSyncSupported()) return
  loadStoredHandle().then((handle) => {
    if (handle) setSyncHandle(handle)
  })
}, [])

useEffect(() => {
  if (!syncHandle) return
  hasWritePermission(syncHandle).then((granted) => {
    if (granted) writeSyncFile(syncHandle, progress).catch((err) => console.warn('file sync write failed', err))
  })
}, [progress, syncHandle])
```

```typescript
// inside the useMemo(() => ({ ... }), [progress]) block, add:
fileSyncSupported: isFileSyncSupported(),
fileSyncEnabled: syncHandle !== null,
enableFileSync: async () => {
  try {
    const handle = await pickSyncFile()
    await storeHandle(handle)
    setSyncHandle(handle)
    return true
  } catch {
    return false // user cancelled the picker, or permission denied
  }
},
```

Note: `enableFileSync` and the write-effect are defined inside `ProgressProvider`, so they close
over `setSyncHandle` — `syncHandle` must be added to the `useMemo` dependency array alongside
`progress` since `fileSyncEnabled` reads it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/state/ProgressContext.test.tsx`
Expected: PASS (all tests, including the 2 pre-existing ones — StrictMode double-invoke must
still not double-call `writeSyncFile` in a way that breaks the assertion above; if it does,
confirm the write effect is keyed only on `[progress, syncHandle]`, not on any ref that changes
every render).

- [ ] **Step 5: Commit**

```bash
git add src/state/ProgressContext.tsx src/state/ProgressContext.test.tsx
git commit -m "feat: wire progress file auto-sync into ProgressContext"
```

## Task 4: Add the "Bật tự động lưu" button to `ProgressHeader`

**Files:**
- Modify: `src/components/ProgressHeader.tsx`

**Interfaces:**
- Consumes: `fileSyncSupported`, `fileSyncEnabled`, `enableFileSync` from `useProgress()` (Task 3)

No automated test — no other component in `src/components/` has a render test in this repo
(only hook-level tests exist for state), so this task follows existing project conventions and
is verified manually instead.

- [ ] **Step 1: Implement the button**

Modify `src/components/ProgressHeader.tsx`:

```tsx
export function ProgressHeader() {
  const { progress, level, fileSyncSupported, fileSyncEnabled, enableFileSync } = useProgress()

  return (
    <header className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-700 px-3 sm:px-4 py-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <Link to="/" className="font-extrabold text-lg sm:text-xl text-green-600 dark:text-green-400 shrink-0">
        🎓 <span className="hidden sm:inline">SAP Quest</span>
      </Link>
      <div className="flex items-center gap-2 sm:gap-4 font-bold text-xs sm:text-sm">
        <span title="Cấp độ">🏅 Lv.{level}</span>
        <span title="Tổng XP">⚡ {progress.xp}</span>
        <span title="Chuỗi ngày học liên tiếp">🔥 {progress.streak}</span>
        <button
          onClick={() => downloadProgressExport(progress)}
          title="Xuất tiến trình học (dùng với MCP server + Claude Desktop)"
          className="text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400"
        >
          ⬇️ <span className="hidden sm:inline">Xuất</span>
        </button>
        {fileSyncSupported && (
          <button
            onClick={() => {
              if (!fileSyncEnabled) enableFileSync()
            }}
            title={
              fileSyncEnabled
                ? 'Tự động lưu tiến trình đang bật — MCP server luôn đọc được bản mới nhất'
                : 'Bật tự động lưu tiến trình vào 1 file cố định (dùng với MCP server + Claude Desktop)'
            }
            className="text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400"
          >
            {fileSyncEnabled ? '✅' : '🔄'} <span className="hidden sm:inline">Tự động lưu</span>
          </button>
        )}
        <Link to="/wiki" className="text-sky-600 dark:text-sky-400 hover:underline" title="Wiki">
          📖 <span className="hidden sm:inline">Wiki</span>
        </Link>
        <Link to="/lab" className="text-sky-600 dark:text-sky-400 hover:underline" title="Code Lab">
          🧪 <span className="hidden sm:inline">Code Lab</span>
        </Link>
        <Link to="/practice" className="text-sky-600 dark:text-sky-400 hover:underline" title="Luyện tập cá nhân hóa">
          🎯 <span className="hidden sm:inline">Luyện tập</span>
        </Link>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Manual verification**

1. `npm run dev`, open in Chrome/Edge — confirm "🔄 Tự động lưu" button appears.
2. Click it, pick/create a file in the dialog — button switches to "✅ Tự động lưu".
3. Answer a quiz question anywhere in the app — confirm the picked file's content on disk
   updates to the new XP value (check via your OS file explorer or a text editor, outside the
   browser).
4. Open the same URL in Firefox — confirm the button does not render at all.

- [ ] **Step 3: Commit**

```bash
git add src/components/ProgressHeader.tsx
git commit -m "feat: add auto-save toggle button to ProgressHeader"
```

## Task 5: Full verification pass

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, including the pre-existing `content.test.ts`, `lab.test.ts`,
`progress.test.ts` (untouched by this plan) and the modified `ProgressContext.test.tsx`.

- [ ] **Step 2: Run the build**

Run: `npm run build`
Expected: `tsc -b` and `vite build` both succeed with no type errors.

- [ ] **Step 3: Commit (if anything changed since Task 4)**

```bash
git status
# only commit if there are unstaged changes left over
```

---

## Self-Review Notes

- **Spec coverage:** Phần A §2.2 (architecture) → Tasks 1–3. §2.2 (`ProgressHeader.tsx` button)
  → Task 4. §2.3 (Firefox/Safari hidden, permission revoked → skip silently, no change to
  `read_progress_export`/`defaultProgressExportPath`) → Tasks 1 (feature detect), 3
  (`hasWritePermission` check before every write, catch-and-warn), and no MCP-side files were
  touched by this plan, consistent with "no change needed" in the spec.
- **Placeholder scan:** no TBD/TODO; every step has runnable code or an exact manual procedure.
- **Type consistency:** `ProgressFileHandle` defined once in Task 2, reused verbatim in Tasks 3
  and the test mock in Task 3. `enableFileSync` returns `Promise<boolean>` consistently between
  its Task 3 implementation and the Task 3 test assertion.
