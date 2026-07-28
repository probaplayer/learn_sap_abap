# Thiết kế: Xóa nội dung + sửa/xóa câu hỏi lẻ + sắp xếp module qua MCP

**Ngày:** 2026-07-28
**Trạng thái:** Chờ duyệt

## 1. Bối cảnh & mục tiêu

Các spec trước ([2026-07-23](2026-07-23-progress-autosync-and-content-authoring-design.md),
[2026-07-24](2026-07-24-mcp-content-update-tools-design.md)) đã cho Claude Desktop **tạo mới**
(`write_*`) và **sửa toàn bộ** (`update_*`) module/lesson/table/bài tập qua MCP. Lúc đó, xóa nội
dung và sửa từng câu hỏi lẻ bị loại khỏi phạm vi ("chưa có nhu cầu").

Giờ có nhu cầu thật: đã tạo nhầm/thử nghiệm module (`fi-ar`), và muốn sửa từng câu hỏi lẻ thay vì
phải soạn lại nguyên 8 câu mỗi lần chỉnh 1 câu. Toàn bộ việc thêm/sửa nội dung SAP Quest **luôn**
đi qua Claude Desktop + MCP (không có UI soạn thảo nào khác), nên các tool mới cần trả về đủ
thông tin để Claude tự vận hành mà không phải đoán hay hỏi lại người dùng.

**Trong phạm vi:**
- `delete_module(id)` — xóa hẳn 1 module (`src/content/<id>/`).
- `delete_lesson(moduleId, lessonId)` — xóa 1 lesson khỏi module đang có.
- `add_question(moduleId, lessonId, question)` — thêm 1 câu hỏi vào cuối 1 lesson đang có.
- `update_question(moduleId, lessonId, questionId, question)` — thay nội dung 1 câu hỏi theo id,
  giữ nguyên vị trí trong lesson.
- `delete_question(moduleId, lessonId, questionId)` — xóa 1 câu hỏi khỏi lesson.
- `reorder_modules(orderedIds)` — gán lại `order` cho toàn bộ module theo 1 danh sách thứ tự mới.
- Nới lỏng ràng buộc "mỗi lesson đúng 8 câu" → "tối thiểu 8 câu" (để xóa 1 câu không tự động vi
  phạm invariant).
- Từ nay, mọi tool **tạo/sửa câu hỏi** (`write_module_draft`, `write_lesson_draft`,
  `update_lesson_draft`, `add_question`, `update_question`) chỉ chấp nhận
  `type: 'multiple-choice'` — chặn tạo mới câu hỏi loại khác.
- 6 tool mới trả về kết quả/lỗi chi tiết (số liệu cụ thể, danh sách id liên quan) thay vì chỉ
  "thành công"/"thất bại" chung chung.

**Ngoài phạm vi (out of scope) — đã xác nhận với người dùng:**
- Xóa table wiki entry, xóa bài tập Code Lab — không có nhu cầu ở vòng này.
- Migrate/xóa các câu hỏi `true-false`/`fill-blank`/`matching` **đã có sẵn** trong nội dung cũ (144
  câu trên 8 module) — hàm `validateQuestion` dùng chung (đang được `content.test.ts` dùng để
  validate toàn bộ nội dung hiện có) giữ nguyên, vẫn chấp nhận cả 4 loại. Ràng buộc
  multiple-choice-only chỉ áp dụng cho đường ghi mới, không đụng dữ liệu cũ.
- Tool "đọc tổng quan toàn hệ thống" (1 tool duy nhất trả về hết module + lesson + số câu) — người
  dùng chỉ chọn yêu cầu response chi tiết hơn cho từng tool, không cần tool tổng quan mới.
- Viết lại description của 7 tool cũ — chỉ 6 tool mới cần response chi tiết; tool cũ giữ nguyên,
  tránh phình phạm vi ngoài yêu cầu.
- Đổi số câu tối thiểu của 1 lesson khi tạo mới (`write_lesson_draft`/`write_module_draft` vẫn yêu
  cầu ≥8 câu lúc tạo) — chỉ nới lỏng để cho phép **xóa bớt** khỏi lesson đã có nhiều hơn 8 câu,
  không hạ chuẩn khi tạo lesson mới.

## 2. Kiến trúc chung

Giữ nguyên toàn bộ pattern đã thiết lập: mỗi tool = 1 file trong `mcp-server/src/`, validate xong
mới ghi/xóa file trên đĩa, báo lỗi tiếng Việt, chỉ ghi draft (chưa commit) — `publish_content` vẫn
là nơi duy nhất chạy test + commit + push (lưu ý: từ bản sửa gần nhất, `publish_content` không tự
chạy `npx vitest run` nữa do một lỗi môi trường Node/Vitest chưa xác định được nguyên nhân gốc —
người dùng cần tự chạy `npx vitest run` trước khi yêu cầu publish).

**Quy ước response mới (áp dụng cho 6 tool trong spec này):** mỗi tool trả về một object JSON có
cấu trúc rõ ràng (không chỉ 1 câu text xác nhận), và mọi lỗi chặn thao tác phải liệt kê cụ thể
*cái gì* đang gây xung đột (id, vị trí, số liệu hiện tại) — không dùng câu chung chung như "có
tham chiếu" hay "không hợp lệ".

**Nguyên tắc validate-trước-ghi-sau:** giữ nguyên như các spec trước — validate toàn bộ, chỉ ghi
xuống đĩa sau khi mọi điều kiện đã qua.

## 3. Tool mới

### 3.1 `delete_module(id)`

- Đọc danh sách module hiện có qua `listModules()` (đã có trong `contentReaders.ts`); báo lỗi nếu
  `id` không tồn tại.
- **Kiểm tra tham chiếu chéo trước khi xóa** (chặn nếu có):
  1. Lấy toàn bộ table id thuộc module `id` (từ `tables.json` của module đó, qua
     `getTables(id)` đã có sẵn trong `contentReaders.ts`).
  2. Gọi `getAllTables()` (đã có sẵn, trả về table của **mọi** module kèm field `module`), lọc bỏ
     bảng thuộc module `id`, tìm bất kỳ `relatedTables` nào trỏ vào 1 trong các table id ở bước 1.
  3. Duyệt toàn bộ file trong `src/content/generated/*.json` (đọc trực tiếp qua `fs.readdirSync` —
     chưa có reader sẵn cho thư mục này trong `contentReaders.ts`, cần thêm mới), tìm bất kỳ set
     nào có `moduleId === id`.
  4. Nếu bước 2 hoặc 3 có kết quả: throw lỗi liệt kê **chính xác** — table nào (kèm module chứa
     nó) đang trỏ vào table nào sắp bị xóa; set generated nào (kèm id) đang tham chiếu module này.
     Không xóa gì cả.
- Nếu không vướng gì: `fs.rmSync(path.join(CONTENT_DIR, id), { recursive: true, force: true })`.
- **Response thành công:** `{ deletedId: string, remainingModules: { id, order, name }[] }` —
  danh sách module còn lại sắp theo `order`, để Claude biết ngay trạng thái mới mà không cần gọi
  `list_modules` lại.

### 3.2 `delete_lesson(moduleId, lessonId)`

- Đọc `quiz.json` của `moduleId`; báo lỗi nếu module không tồn tại hoặc `lessonId` không tồn tại
  trong `lessons`.
- Chặn nếu `lessons.length - 1 < 3`: throw lỗi nêu rõ số lesson hiện tại và yêu cầu tối thiểu 3.
- Xóa phần tử khớp `lessonId` khỏi mảng `lessons`, ghi lại `quiz.json`.
- **Response thành công:** `{ deletedLessonId: string, remainingLessons: { id, title, difficulty, questionCount }[] }`.

### 3.3 `add_question(moduleId, lessonId, question)`

- Đọc `quiz.json`; báo lỗi nếu `moduleId`/`lessonId` không tồn tại.
- `requireMultipleChoice([question])` (mục 4) — chặn nếu `question.type !== 'multiple-choice'`.
- `validateQuestion(question)` (tái dùng) — chặn nếu thiếu field/sai cấu trúc.
- Chặn nếu `question.id` đã tồn tại **ở bất kỳ đâu trong toàn bộ nội dung** (không chỉ lesson này)
  — khớp đúng quy tắc "id câu hỏi duy nhất toàn hệ thống" mà `content.test.ts` đang enforce. Duyệt
  toàn bộ `QUIZ_LESSONS` (đọc qua `contentReaders.ts`) để lấy tập id hiện có.
- Append `question` vào cuối `lessons[i].questions`, ghi lại `quiz.json`.
- **Response thành công:** `{ questionId: string, lessonQuestionCount: number }`.
- **Lỗi trùng id:** nêu rõ id đó hiện đang thuộc module/lesson nào.

### 3.4 `update_question(moduleId, lessonId, questionId, question)`

- Đọc `quiz.json`; báo lỗi nếu `moduleId`/`lessonId` không tồn tại.
- Tìm index của câu hỏi có `id === questionId` trong `lessons[i].questions`; nếu không thấy, throw
  lỗi liệt kê toàn bộ id câu hỏi đang có trong lesson đó (để Claude biết ngay id nào đúng).
- `requireMultipleChoice([question])` + `validateQuestion(question)`.
- Nếu `question.id !== questionId`: chặn — đổi id qua tool này không được hỗ trợ (tránh vô tình
  tạo trùng/orphan id); báo lỗi yêu cầu giữ nguyên `id` hoặc dùng `delete_question` +
  `add_question` nếu thực sự cần đổi id.
- Thay thế object tại đúng index, ghi lại `quiz.json`.
- **Response thành công:** `{ questionId: string, updatedFields: string[] }` (liệt kê các field cấp
  1 khác giá trị cũ, để xác nhận đúng thứ Claude định sửa).

### 3.5 `delete_question(moduleId, lessonId, questionId)`

- Đọc `quiz.json`; báo lỗi nếu `moduleId`/`lessonId` không tồn tại.
- Tìm index câu hỏi theo `questionId`; báo lỗi liệt kê id hiện có nếu không thấy.
- Chặn nếu `questions.length - 1 < 8`: throw lỗi nêu rõ số câu hiện tại, yêu cầu tối thiểu 8.
- Xóa phần tử khỏi mảng, ghi lại `quiz.json`.
- **Response thành công:** `{ deletedQuestionId: string, remainingQuestionIds: string[] }`.

### 3.6 `reorder_modules(orderedIds)`

```typescript
interface ReorderModulesInput {
  orderedIds: string[] // toàn bộ module id hiện có, theo đúng thứ tự hiển thị mong muốn
}
```

- Lấy tập id module hiện có qua `listModules()`.
- Validate `orderedIds` là **hoán vị chính xác** của tập id hiện có: không thiếu, không thừa,
  không trùng lặp. Nếu sai: throw lỗi liệt kê rõ id nào bị thiếu, id nào thừa/không tồn tại, id
  nào bị lặp — kèm danh sách id hiện có để đối chiếu.
- Với mỗi module, ghi `order = index trong orderedIds + 1` vào `module.json` tương ứng (chỉ sửa
  field `order`, giữ nguyên các field khác — đọc file, sửa 1 field, ghi lại, lặp cho từng module).
- **Response thành công:** `{ newOrder: { id: string, order: number }[] }` — đúng thứ tự mới để
  Claude xác nhận lại với người dùng.

## 4. Ràng buộc "chỉ multiple-choice" cho nội dung mới

Thêm hàm mới trong `mcp-server/src/requireMultipleChoice.ts` (file riêng, xem mục 6):

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

Gọi hàm này (thêm 1 dòng, trước hoặc sau `validateQuestion`) tại:
- `writeModuleDraft.ts` — cho toàn bộ câu hỏi trong mọi lesson được truyền vào.
- `writeLessonDraft.ts`, `updateLessonDraft.ts` — cho toàn bộ câu hỏi của lesson.
- `add_question`, `update_question` (tool mới) — như mô tả ở mục 3.3/3.4.

**Không** gọi hàm này trong `validateQuestion` (dùng chung, được `content.test.ts` gọi để validate
nội dung cũ) — giữ tách biệt hoàn toàn 2 hàm để không phá vỡ validate nội dung hiện có.

## 5. Thay đổi ràng buộc số câu/lesson

- `src/content/content.test.ts` — đổi `expect(lesson.questions.length).toBe(8)` thành
  `expect(lesson.questions.length).toBeGreaterThanOrEqual(8)`.
- `mcp-server/src/writeModuleDraft.ts`, `writeLessonDraft.ts`, `updateLessonDraft.ts` — đổi check
  hiện tại (`questions.length !== 8` → throw) thành `questions.length < 8` → throw. Các tool này
  vẫn yêu cầu **tối thiểu 8 câu khi tạo/thay toàn bộ lesson** — chỉ nới lỏng để không còn chặn khi
  có nhiều hơn 8 câu (vốn sẽ xảy ra sau khi `add_question` được dùng vài lần).
- `CLAUDE.md` — dòng "Every module's quiz.json must have at least 3 lessons of exactly 8
  questions each" → sửa "exactly 8" thành "at least 8".

## 6. File structure

- File mới trong `mcp-server/src/`: `deleteModule.ts`, `deleteLesson.ts`, `addQuestion.ts`,
  `updateQuestion.ts`, `deleteQuestion.ts`, `reorderModules.ts`, `requireMultipleChoice.ts` (hàm
  helper dùng chung, mục 4).
- Sửa `mcp-server/src/index.ts` — đăng ký 6 tool mới (zod input schema cho mỗi tool, theo đúng
  interface ở mục 3); gọi `requireMultipleChoice` thêm vào `write_module_draft`,
  `write_lesson_draft`, `update_lesson_draft` đã có sẵn (import từ file helper mới).
- Sửa `mcp-server/src/writeModuleDraft.ts`, `writeLessonDraft.ts`, `updateLessonDraft.ts` — thêm
  gọi `requireMultipleChoice` + nới lỏng check số câu (mục 5).
- Sửa `mcp-server/README.md` — thêm 6 dòng vào bảng tool (tổng 21 tool), ghi rõ response trả về gì
  cho từng tool mới.
- Sửa `src/content/content.test.ts`, `CLAUDE.md` theo mục 5.
- Không cần schema/type mới ở `src/content/types.ts` — `QuizQuestion`/`Lesson`/`ModuleInfo` không
  đổi cấu trúc, chỉ đổi ràng buộc số lượng/loại tại tầng validate.

## 7. Testing

Giữ nguyên cách kiểm thử thủ công đã dùng cho các tool mcp-server trước (không có test tự động
riêng cho mcp-server) — mỗi tool mới cần 1 smoke test tay:
1. Gọi trên nội dung tạm/bản sao (không đụng module thật) — xác nhận response đúng cấu trúc mục 3.
2. Gọi trường hợp lỗi (id không tồn tại, xóa vi phạm invariant, type sai) — xác nhận message liệt
   kê đúng chi tiết như mục 3, không phải message chung chung.
3. Sau khi smoke test, chạy `npx vitest run` toàn bộ để xác nhận `content.test.ts`/`lab.test.ts`
   vẫn pass với ràng buộc mới (≥8 câu thay vì đúng 8).
4. `git diff`/`git checkout --` dọn sạch thay đổi thử nghiệm trước khi dùng cho nội dung thật.

## 8. Rủi ro & giới hạn đã biết

- `delete_module` chỉ chặn theo 2 loại tham chiếu đã biết (table `relatedTables`, generated set
  `moduleId`) — nếu sau này có thêm loại tham chiếu chéo mới giữa các module, tool này sẽ không tự
  biết để chặn (không có cơ chế tham chiếu chung/generic).
- Xóa module/lesson/câu hỏi không dọn dẹp dữ liệu `localStorage` phía người học đã lỡ hoàn thành
  (giữ đúng hành vi hiện tại của toàn hệ thống — `completedLessons`/`reviewPool`/`badges` vốn đã
  không tự dọn khi nội dung đổi, xem ghi chú trong `ProgressContext.tsx`). Đây là hạn chế đã tồn
  tại từ trước, không phải hạn chế mới do spec này gây ra.
- `update_question` không cho đổi `id` của câu hỏi (để tránh orphan/trùng id) — nếu cần đổi id
  thật sự, phải `delete_question` rồi `add_question` với id mới, chấp nhận mất vị trí gốc trong
  mảng (câu mới sẽ nằm cuối lesson).
- `reorder_modules` yêu cầu truyền **toàn bộ** danh sách id mỗi lần gọi (không hỗ trợ "chuyển 1
  module lên trước module khác" dạng tương đối) — đơn giản hơn để validate (chỉ cần so khớp tập
  hợp), đổi lại Claude phải tự biết đủ danh sách module hiện có trước khi gọi (gọi `list_modules`
  trước nếu chưa chắc).
- Ràng buộc multiple-choice-only không hồi tố nội dung cũ — ứng dụng vẫn hiển thị và chấm điểm
  đúng cho câu true-false/fill-blank/matching đã publish trước đó; chỉ chặn tạo mới.
