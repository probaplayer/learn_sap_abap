# Thiết kế: Bổ sung khả năng sửa nội dung đã có qua MCP

**Ngày:** 2026-07-24
**Trạng thái:** Chờ duyệt

## 1. Bối cảnh & mục tiêu

Spec [2026-07-23-progress-autosync-and-content-authoring-design.md](2026-07-23-progress-autosync-and-content-authoring-design.md)
(Phần C) đã thêm 5 tool MCP cho phép Claude **tạo mới** nội dung thường trực: module SAP mới
(`write_module_draft`), lesson mới cho module đang có (`write_lesson_draft`), entry Wiki mới/sửa
(`write_table_entry` — tool này vốn đã hỗ trợ upsert), bài tập Code Lab mới
(`write_lab_exercise_draft`), và xuất bản (`publish_content`).

Người dùng giờ muốn thêm khả năng **sửa nội dung đã có** — không chỉ tạo mới — để Claude Desktop
có thể chỉnh sửa module/lesson/bài tập đang tồn tại khi được yêu cầu, không riêng gì Wiki (nơi
duy nhất hiện hỗ trợ sửa).

**Trong phạm vi:**
- `update_module_info` — sửa metadata của 1 module đã có (`module.json`): `name`, `shortName`,
  `icon`, `color`, `description`, `businessPurpose`, `order`.
- `update_lesson_draft` — thay toàn bộ nội dung 1 lesson đã có (title/difficulty/8 câu hỏi) theo
  `lesson.id`, trong `quiz.json` của module đó.
- `update_lab_exercise_draft` — thay toàn bộ 1 bài tập Code Lab đã có (`exercise.json` + toàn bộ
  file `.abap`) theo `id`.

**Ngoài phạm vi (out of scope) — đã xác nhận với người dùng:**
- **Phân tích tiến trình học + gợi ý hướng đi (vai trò "giám sát 1:1")** — đây là sub-project
  độc lập, người dùng đã chọn làm sau, chưa nằm trong spec này.
- **Xóa nội dung** (lesson/table entry/bài tập/module) — chưa có nhu cầu, không thêm `delete_*`
  nào ở đây.
- **Đổi `id` của module** (tức đổi tên thư mục `src/content/<id>/`) — rủi ro cao (ảnh hưởng
  URL/progress đã lưu của người học), không cần thiết cho nhu cầu hiện tại.
- **Sửa từng câu hỏi lẻ trong 1 lesson, hoặc sửa từng file `.abap` lẻ trong 1 bài tập** — chọn
  phương án đơn giản hơn: thay toàn bộ lesson/toàn bộ bài tập theo id, Claude tự đọc nội dung cũ
  qua `get_quiz_lessons`/`get_exercises` rồi soạn lại đầy đủ trước khi gọi update.
- Không cần script `.bat` hay bất kỳ cơ chế publish nào khác ngoài `publish_content` đã có —
  `git push` dùng remote đã lưu sẵn trong `.git/config` của bản clone, không cần domain/link
  nào được cung cấp thêm.

## 2. Kiến trúc chung

Giữ nguyên flow "draft rồi publish" đã thiết lập: các tool `update_*` chỉ ghi file (chưa
commit), giống hệt các tool `write_*`. Xuất bản vẫn qua `publish_content(commitMessage)` sẵn có
— chạy toàn bộ `npx vitest run`, pass thì mới `git add/commit/push` lên `main`. Không cần tool
publish mới, vì `publish_content` vốn được thiết kế chung cho mọi thay đổi trong `src/content/**`
(module/lesson/wiki/exercise), không phân biệt tạo mới hay sửa.

**Quy ước đặt tên:** `write_*` = chỉ tạo mới, báo lỗi nếu đã tồn tại. `update_*` = chỉ sửa cái đã
có, báo lỗi nếu chưa tồn tại. Đây là lựa chọn tách biệt (đối lập với upsert-1-tool) để tránh
Claude vô tình ghi đè nội dung cũ khi chỉ định tạo nội dung mới nhưng gõ nhầm `id` trùng —
người dùng đã chọn phương án này khi được hỏi.

**Nguyên tắc validate-trước-ghi-sau (áp dụng cho cả 3 tool):** validate toàn bộ input trước, chỉ
ghi/xóa file trên đĩa sau khi validate qua hết — tránh trường hợp input sai làm hỏng nội dung cũ
giữa chừng (ví dụ: xóa hết file `.abap` cũ rồi mới phát hiện `exercise.json` mới không hợp lệ).

## 3. Tool mới

### 3.1 `update_module_info(id, module)`

```typescript
interface UpdateModuleInfoInput {
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
```

- Đọc `src/content/<id>/module.json`; báo lỗi tiếng Việt nếu module `id` chưa tồn tại.
- `id` trong `module.json` giữ nguyên (không đổi tên thư mục) — input không có trường để đổi
  `id`, chỉ có các trường metadata + `order`.
- Validate `order` mới không trùng `order` của module khác: gọi `listModules()` (đã export sẵn
  trong `mcp-server/src/contentReaders.ts`, trả về mảng `ModuleJson[]` gồm `id`/`order`), lọc bỏ
  phần tử có `id` trùng module đang sửa, rồi kiểm tra không phần tử nào còn lại có cùng `order`
  mới — bắt lỗi sớm ngay tại tool, thay vì để `publish_content` chạy `content.test.ts` mới phát
  hiện trùng `order`.
- Ghi đè toàn bộ `module.json` bằng `{ id, order, ...module }` (giữ nguyên field `id` gốc).

### 3.2 `update_lesson_draft(moduleId, lesson)`

```typescript
interface UpdateLessonDraftInput {
  id: string
  difficulty: string
  title: string
  questions: QuizQuestion[]
}
```

- Đọc `src/content/<moduleId>/quiz.json`; báo lỗi nếu `moduleId` không tồn tại.
- Báo lỗi nếu **không tìm thấy** `lesson.id` nào khớp trong `file.lessons` (ngược lại hoàn toàn
  với `write_lesson_draft`, vốn báo lỗi nếu **tìm thấy** id trùng).
- Validate đúng 8 câu hỏi + từng câu qua `validateQuestion` (tái dùng, giống `write_lesson_draft`).
- Thay thế toàn bộ object lesson tại đúng vị trí index tìm được (giữ nguyên vị trí trong mảng
  `lessons`, không đẩy xuống cuối) bằng lesson mới.

### 3.3 `update_lab_exercise_draft(id, exercise, sourceFiles)`

```typescript
interface UpdateLabExerciseDraftInput {
  id: string
  exercise: ExerciseMeta
  sourceFiles: { filename: string; content: string }[]
}
```

- Báo lỗi nếu thư mục `src/content/lab/<id>/` chưa tồn tại (ngược lại `write_lab_exercise_draft`,
  vốn báo lỗi nếu đã tồn tại).
- Validate `exercise` qua `validateExerciseMeta` (tái dùng) + validate tên file an toàn cho từng
  entry trong `sourceFiles` (tái dùng đúng logic chống path-traversal đã có trong
  `writeLabExerciseDraft.ts`: `path.basename(f) !== f || f.includes('..')`).
- Chỉ sau khi validate qua hết: xóa toàn bộ nội dung thư mục `files/` cũ
  (`fs.rmSync(filesDir, { recursive: true, force: true })`) rồi tạo lại và ghi các file mới —
  tránh còn sót file `.abap` cũ không còn nằm trong `sourceFiles` mới (ví dụ đổi tên file hoặc bớt
  file). Ghi đè `exercise.json` bằng nội dung mới.

## 4. File structure

- Tạo `mcp-server/src/updateModuleInfo.ts`, `updateLessonDraft.ts`, `updateLabExerciseDraft.ts`
  — mỗi file 1 tool, cùng pattern với các file `write*.ts` hiện có (1 file = 1 trách nhiệm rõ
  ràng, tái dùng validator chung từ `src/content/validateQuestion.ts`).
- Sửa `mcp-server/src/index.ts` — đăng ký 3 tool mới; tái dùng `lessonSchema`/`exerciseMetaSchema`
  zod schema đã định nghĩa sẵn (giống hệt input shape của `write_lesson_draft`/
  `write_lab_exercise_draft`, không cần schema mới).
- Sửa `mcp-server/README.md` — thêm 3 dòng vào bảng tool hiện có (15 tool tổng cộng).
- Không sửa gì ở `src/content/**` hay test app-side (`content.test.ts`/`lab.test.ts`) — schema
  JSON không đổi, các test này validate cấu trúc trên đĩa bất kể được tạo mới hay sửa bằng cách
  nào.

## 5. Testing

Không có test tự động cho các tool mcp-server này — giữ đúng pattern đã thiết lập từ trước (xác
nhận thủ công qua smoke test bằng `node --experimental-strip-types`, cộng với việc
`publish_content`'s toàn bộ test suite gate sẽ chặn nếu nội dung sau khi sửa làm hỏng invariant
nào đó trong `content.test.ts`/`lab.test.ts`).

Mỗi tool cần 1 smoke test thủ công theo mẫu đã dùng ở các tool `write_*` trước:
1. Gọi update trên 1 bản sao/nội dung tạm (không đụng module/lesson/exercise thật), xác nhận ghi
   đúng.
2. Gọi update trên `id` không tồn tại, xác nhận báo lỗi đúng thay vì tạo mới.
3. `git diff`/`git checkout --` để dọn sạch thay đổi thử nghiệm trước khi commit thật.

## 6. Rủi ro & giới hạn đã biết

- `update_module_info` không cho sửa `id`/đổi tên thư mục — nếu người dùng thực sự cần rename
  module sau này, đây sẽ là 1 tool riêng, phức tạp hơn (move thư mục, có thể ảnh hưởng
  `localStorage` progress của người học theo `moduleId` cũ), không nằm trong spec này.
- `update_lesson_draft`/`update_lab_exercise_draft` thay **toàn bộ** lesson/exercise theo id —
  nếu người dùng chỉ muốn sửa 1 câu hỏi hoặc 1 file nhỏ, Claude vẫn phải soạn lại toàn bộ 8 câu/
  toàn bộ danh sách file trước khi gọi tool (tăng token cho mỗi lần sửa nhỏ, nhưng giữ tool đơn
  giản và nhất quán với cấu trúc dữ liệu hiện tại — người dùng đã xác nhận chấp nhận đánh đổi
  này).
- Giống các tool `write_*` khác, `update_*` chỉ ghi draft — `publish_content` vẫn push thẳng
  `main`, không qua PR/branch review (trade-off đã chấp nhận từ spec trước).
