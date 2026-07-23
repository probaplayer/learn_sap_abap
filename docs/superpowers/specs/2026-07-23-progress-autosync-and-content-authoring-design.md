# Thiết kế: Tự động lưu tiến trình + mở rộng content-authoring qua MCP

**Ngày:** 2026-07-23
**Trạng thái:** Chờ duyệt

## 1. Bối cảnh & mục tiêu

Tiếp nối [thiết kế MCP server ban đầu](2026-07-20-mcp-claude-desktop-integration-design.md),
người dùng muốn giải quyết 2 hạn chế hiện tại:

1. **Xuất tiến trình thủ công:** mỗi lần muốn Claude Desktop thấy tiến trình học mới nhất phải
   bấm nút "⬇️ Xuất" rồi chờ MCP đọc lại file — dễ quên, dữ liệu dễ lỗi thời.
2. **MCP chỉ soạn được practice set tạm:** `write_practice_set`/`publish_practice_set` chỉ ghi
   vào `src/content/generated/` (nội dung ôn tập cá nhân hóa, không thuộc lộ trình cố định).
   Người dùng muốn Claude qua MCP thêm được nội dung **thường trực**: module SAP mới, lesson
   mới cho module đang có, entry Wiki mới/sửa, và bài tập Code Lab mới.

Đây là 2 sub-project độc lập (data-flow đồng bộ vs. content-authoring pipeline), gộp chung 1
spec theo yêu cầu người dùng, trình bày thành 2 phần tách biệt bên dưới.

**Ngoài phạm vi (out of scope):**
- Đồng bộ tiến trình xuyên thiết bị (vd học trên điện thoại, Claude Desktop chạy trên laptop
  khác) — người dùng đã chọn chỉ tự động hóa trường hợp cùng máy; thiết bị khác vẫn dùng nút
  "Xuất" thủ công như hiện tại.
- Quy trình publish qua PR/branch review — người dùng chọn giữ nguyên validate + test rồi push
  thẳng `main`, kể cả với nội dung lớn hơn (module mới).

## 2. Phần A — Tự động lưu tiến trình (cùng máy với Claude Desktop)

### 2.1 Vì sao không dùng lại phương án HTTP đã bị loại ở spec trước

Spec 2026-07-20 đã loại phương án web gọi HTTP tới 1 server local vì bị chặn bởi chính sách
mixed-content (trang `https://` không gọi được `http://localhost`). Phương án ở đây **không**
đi qua mạng: dùng File System Access API để trình duyệt tự ghi trực tiếp xuống một file trên
đĩa mà người dùng đã cấp quyền — không có request HTTP nào, nên không bị mixed-content chặn.
Đánh đổi: chỉ chạy trên Chrome/Edge, và chỉ tự động khi trang được mở trên đúng máy có file đó
(tức máy chạy Claude Desktop).

### 2.2 Kiến trúc

```
ProgressHeader: nút "🔄 Bật tự động lưu" (mới, cạnh nút "⬇️ Xuất" hiện có)
        │ (lần đầu bấm)
        ▼
window.showSaveFilePicker() → FileSystemFileHandle
        │
        ▼
lưu handle vào IndexedDB (src/state/fileSync.ts) — để nhớ qua các lần load trang sau
        │
ProgressContext: mỗi khi `progress` state đổi
        │
        ▼
handle.queryPermission() → nếu còn quyền: handle.createWritable() ghi đè file
                          → nếu mất quyền: bỏ qua, không lỗi vỡ UI (im lặng log console)
```

- File mới `src/state/fileSync.ts`:
  - `isFileSyncSupported()` — feature-detect `'showSaveFilePicker' in window`.
  - `pickSyncFile(): Promise<FileSystemFileHandle>` — mở dialog, gợi ý tên
    `sap-quest-progress.json`.
  - `storeHandle(handle)` / `loadStoredHandle()` — IndexedDB, 1 object store, 1 key cố định.
    Không thêm dependency ngoài (viết tay bằng `indexedDB` API trực tiếp, phạm vi nhỏ).
  - `writeSyncFile(handle, progress)` — `createWritable()` → ghi `JSON.stringify(progress,
    null, 2)` → `close()`.
- `ProgressContext.tsx`: thêm 1 `useEffect` phụ, chạy song song với effect `saveProgress` hiện
  có (không thay thế localStorage — localStorage vẫn là nguồn dữ liệu chính của app, file sync
  chỉ là bản sao cho MCP đọc).
- `ProgressHeader.tsx`: nút mới chỉ hiện khi `isFileSyncSupported()`; đổi label/icon để phản
  ánh trạng thái đã bật hay chưa (đọc từ việc `loadStoredHandle()` có trả về handle hợp lệ hay
  không lúc mount).

### 2.3 Xử lý lỗi & giới hạn

- Firefox/Safari: không hỗ trợ `showSaveFilePicker` → ẩn nút, hành vi y hệt hiện tại (chỉ có
  nút "Xuất" thủ công).
- Quyền bị thu hồi (người dùng xoá file, đổi trình duyệt, v.v.): `queryPermission` trả về khác
  `'granted'` → bỏ qua lần ghi đó, không throw ra UI; người dùng bấm lại nút để cấp quyền lại.
- Không thay đổi `defaultProgressExportPath()` hay `read_progress_export` phía MCP server — nếu
  người dùng chọn đúng file `sap-quest-progress.json` trong `~/Downloads` khi `pickSyncFile()`,
  luồng đọc phía MCP không cần đổi gì.

## 3. Phần B — Mở rộng content-authoring qua MCP

### 3.1 Đổi cơ chế đăng ký content: import tường minh → tự động quét thư mục

**`src/content/index.ts`:** thay 20 dòng import thủ công bằng
`import.meta.glob('./*/module.json', { eager: true })` (tương tự cho `tables.json`,
`quiz-syntax.json`, `quiz-business.json`), build `MODULES`/`TABLES`/`QUIZ_TRACKS` từ kết quả
quét thay vì object literal liệt kê tay.

- **Thứ tự module:** thứ tự hiện tại (`enterprise-structure, mm, co, fi-gl, sd`) là thứ tự sư
  phạm cố ý, không phải alphabet — nên mỗi `module.json` có thêm field `order: number`,
  `MODULE_ORDER` = id các module đã quét, sort theo `order`.
- **`ModuleId`** (`src/content/types.ts`) đổi từ literal union (`'mm'|'co'|...`) sang `string`.
  Hệ quả chấp nhận: mất kiểm tra kiểu lúc biên dịch cho id module (gõ nhầm id không còn bị
  `tsc` bắt) — bù lại bằng `content.test.ts` chạy lúc test/publish. Đây là đánh đổi để đạt được
  "thả đúng file là module mới tự xuất hiện, không sửa code TS nào".
  - `mcp-server/src/index.ts`: `moduleIdEnum = z.enum(MODULE_ORDER)` đã dynamic theo
    `MODULE_ORDER` sẵn, không cần sửa.

**`src/content/lab/index.ts`:** thay import thủ công bằng
`import.meta.glob('./*/exercise.json', { eager: true })` +
`import.meta.glob('./*/files/*.abap', { eager: true, query: '?raw', import: 'default' })`, map
theo thư mục để ráp `Exercise.files`. Đã xác nhận: thứ tự `EXERCISES` hiện tại trùng khớp thứ
tự alphabet theo tên thư mục (`zco-... < zday10 < zday11 < zday2 < zday5 < zday6 < zday8 <
zday9 < ztest-code`) — quét thư mục giữ nguyên đúng thứ tự, không cần field `order` riêng cho
exercise.

### 3.2 Nới lỏng invariant test

`src/content/content.test.ts`, test "every track has 3 lessons of 8 questions each": đổi
`expect(file.lessons.length).toBe(3)` → `expect(file.lessons.length).toBeGreaterThanOrEqual(3)`.
Giữ nguyên `expect(lesson.questions.length).toBe(8)` — độ dài mỗi lesson vẫn cố định để đồng
nhất trải nghiệm, chỉ số lượng lesson mỗi track được phép tăng.

### 3.3 Tool MCP mới

Mở rộng theo đúng pattern đã có của `write_practice_set`/`publish_practice_set`: ghi thẳng vào
vị trí thật trong `src/content/**` (xem được ngay qua `npm run dev`/`preview`, chưa commit).

| Tool | Input | Việc làm |
|---|---|---|
| `write_module_draft` | `id`, `order`, `module`, `tables[]`, `quizSyntax`, `quizBusiness` | Validate schema (module info, mỗi `table.keyFields` không rỗng, mỗi câu hỏi qua `validateQuestion`, ≥3 lesson x đúng 8 câu) rồi tạo 4 file trong `src/content/<id>/` |
| `write_lesson_draft` | `moduleId`, `track`, `lesson` | Đọc file quiz hiện có, validate lesson mới (đúng 8 câu, `lesson.id` không trùng, mỗi câu qua `validateQuestion`), append rồi ghi lại |
| `write_table_entry` | `moduleId`, `table` | Validate `table.keyFields` không rỗng và mọi id trong `table.relatedTables` đã tồn tại (dùng lại logic của test "related tables reference tables that actually exist"); upsert theo `table.id` vào `tables.json` |
| `write_lab_exercise_draft` | `id`, `exercise` (ExerciseMeta), `sourceFiles: {filename, content}[]` | Validate `exercise.sourceFiles` khớp danh sách filename thực nhận (đúng invariant `lab.test.ts` đang kiểm), ghi `exercise.json` + từng file `.abap` vào `src/content/lab/<id>/files/` |
| `publish_content` | `commitMessage` | Chạy **toàn bộ** `npx vitest run` (khác với `publish_practice_set` chỉ chạy `generated.test.ts`, vì nội dung ở đây đụng `content.test.ts`/`lab.test.ts`); nếu pass: `git add` các đường dẫn `src/content` đã đổi, `git commit -m <commitMessage>`, `git push origin main` |

`publish_practice_set` giữ nguyên, không đổi — vẫn dùng riêng cho practice set (scope test hẹp
như thiết kế cũ). `publish_content` là tool publish chung mới, dùng cho 4 loại nội dung thường
trực ở trên.

### 3.4 Validate dùng chung

Tái sử dụng `src/content/validateQuestion.ts` đã có (từ spec trước) cho câu hỏi trong
`write_module_draft`/`write_lesson_draft`. Thêm 2 hàm validate nhỏ mới, đặt cùng chỗ:
- `validateTableEntry(table, allKnownTableIds)` — non-empty fields + `relatedTables` tồn tại.
- `validateExerciseMeta(meta, actualFilenames)` — field bắt buộc non-empty + `sourceFiles` khớp
  danh sách file thực nhận.

Cả `mcp-server` và các file test (`content.test.ts`, `lab.test.ts`) import cùng 2 hàm này —
tránh viết lại logic validate ở 2 nơi, đúng nguyên tắc đã áp dụng cho `validateQuestion`.

## 4. Testing

- `src/content/content.test.ts`: cập nhật assertion số lesson (mục 3.2); các test còn lại giữ
  nguyên vì vẫn duyệt qua `MODULE_ORDER`/`TABLES`/`QUIZ_TRACKS` — không quan tâm các giá trị đó
  đến từ import tường minh hay `import.meta.glob`.
- `src/content/lab/lab.test.ts`: không đổi logic, chỉ cần xác nhận vẫn pass sau khi
  `content/lab/index.ts` chuyển sang auto-discovery (số lượng exercise, `sourceFiles` khớp file
  thực load, phải giữ nguyên hành vi).
- Test mới cho 2 hàm validate ở mục 3.4 (`validateTableEntry`, `validateExerciseMeta`) theo
  đúng pattern TDD đang dùng trong repo — viết test trước khi implement.
- Phần A (file sync): không có test tự động khả thi cho File System Access API trong Vitest
  (cần tương tác trình duyệt thật) — xác minh thủ công trên Chrome/Edge: bật tự động lưu, đổi
  progress (trả lời 1 câu), xác nhận file trên đĩa được ghi đè đúng nội dung mới.

## 5. Rủi ro & giới hạn đã biết

- **Mất kiểm tra kiểu compile-time cho `ModuleId`:** chấp nhận đổi lấy khả năng thêm module
  không cần sửa code TS; lỗi id sai sẽ hiện ở `content.test.ts` thay vì `tsc -b`.
- **File System Access API chỉ Chrome/Edge, chỉ cùng máy:** đã nêu ở mục 2.3 — không giải
  quyết đồng bộ xuyên thiết bị (out of scope, mục 1).
- **`publish_content` vẫn push thẳng `main` không qua review:** giống rủi ro đã chấp nhận ở
  spec trước cho `publish_practice_set`, nay áp dụng rộng hơn cho module/lesson/wiki/exercise —
  người dùng đã xác nhận giữ nguyên cơ chế này, bù trừ bằng việc chạy toàn bộ test suite (rộng
  hơn hẳn phạm vi test của `publish_practice_set`) trước khi push.
- **Thứ tự exercise phụ thuộc tên thư mục:** nếu sau này thêm exercise có tên thư mục phá vỡ
  thứ tự alphabet mong muốn (vd cần chèn giữa chừng), sẽ cần thêm field `order` giống module —
  chưa cần thiết ở phạm vi thiết kế này vì thứ tự hiện tại trùng khớp alphabet.
