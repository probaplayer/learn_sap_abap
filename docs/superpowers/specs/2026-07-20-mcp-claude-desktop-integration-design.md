# Thiết kế: Tích hợp MCP server với Claude Desktop cho SAP Quest

**Ngày:** 2026-07-20
**Trạng thái:** Chờ duyệt

## 1. Bối cảnh & mục tiêu

SAP Quest là app học SAP kiểu game (React + Vite + TS, deploy tĩnh lên GitHub Pages qua
GitHub Actions, không có backend). Người dùng chính (đồng thời là dev) muốn dùng **Claude
Desktop** — không phải phiên Claude Code đang code cùng — để:

1. Đọc được nội dung hiện có của app (module, quiz, bảng wiki, bài tập Code Lab).
2. Đọc được tiến trình học của chính mình (XP, streak, câu hay sai, lesson đã hoàn thành).
3. Dựa vào đó, tự suy luận ra học viên đang yếu ở đâu (module/khái niệm nào hay sai).
4. Soạn một bộ câu hỏi luyện tập mới, nhắm đúng vào điểm yếu đó.
5. Ghi bộ câu hỏi này vào repo, và tự động commit + push để bản deploy cập nhật.
6. Có một trang trên web để thực sự làm được bộ câu hỏi đó.

**Ngoài phạm vi (out of scope):** tính năng chat AI cho người dùng cuối trên bản deploy công
khai (đã cân nhắc và loại bỏ ở bước brainstorm — MCP chỉ phục vụ chính người phát triển qua
Claude Desktop, không phải multi-user).

## 2. Kiến trúc tổng thể

```
Claude Desktop  <──stdio (MCP protocol)──>  MCP server (Node/TS, chạy local)
                                                  │  đọc/ghi trực tiếp file trên đĩa
                                                  ▼
                                    repo sap-quest (src/content/**, git)
                                                  │
                                                  │ MCP tự commit + push khi "publish"
                                                  ▼
                                    GitHub Actions build lại → GitHub Pages
                                                  │
                                                  ▼
                                    Website (bản deploy, hoặc npm run dev/preview local)
                                                  │  bấm "Xuất tiến trình" → tải progress.json
                                                  ▼
                                    Người dùng lưu file → MCP đọc lại (path cấu hình sẵn)
```

Nguyên tắc thiết kế cốt lõi: **MCP server chỉ là công cụ đọc/ghi dữ liệu + thao tác git.**
Việc "phân tích điểm yếu" và "soạn câu hỏi mới" là Claude Desktop tự suy luận trên dữ liệu thô
mà tool cung cấp — không xây thêm một tầng thuật toán phân tích riêng trong MCP server (tránh
trùng lặp năng lực vốn có của LLM, đúng tinh thần YAGNI).

### Vì sao không tự động đồng bộ progress qua HTTP?

Đã cân nhắc việc web tự động gửi progress sang một server local mỗi khi có thay đổi, nhưng bị
chặn bởi chính sách mixed-content của trình duyệt: trang phục vụ qua `https://` (GitHub Pages)
không thể gọi `http://localhost` dù chạy trên máy người dùng — trình duyệt chặn cứng, không có
cách nào lách bằng code phía client. Quyết định: dùng cơ chế xuất **thủ công** (nút tải file),
đơn giản, không phụ thuộc việc chạy local hay deploy.

## 3. MCP server

### 3.1 Vị trí & công nghệ

- Thư mục mới `mcp-server/` ngay trong repo này (không phải repo riêng) — để dùng chung type
  từ `src/content/types.ts` và đọc/ghi trực tiếp `src/content/**` bằng đường dẫn tương đối.
- Node.js + TypeScript, dùng `@modelcontextprotocol/sdk` (SDK chính thức của Anthropic).
- Transport: **stdio** — đúng chuẩn cách Claude Desktop khởi chạy MCP server local (khai báo
  trong `claude_desktop_config.json` bằng `command` + `args`).
- Chạy trực tiếp qua `npx tsx mcp-server/src/index.ts` — không cần bước build/compile riêng
  để giảm ma sát khi chỉnh sửa.

### 3.2 Danh sách tool

| Tool | Input | Việc làm |
|---|---|---|
| `list_modules` | — | Trả về 5 module (`id`, `name`, `businessPurpose`) từ `content/*/module.json` |
| `get_quiz_lessons` | `moduleId`, `track` | Trả về toàn bộ lesson + câu hỏi hiện có của track đó (để Claude biết văn phong, độ khó, và tránh trùng lặp khi soạn câu mới) |
| `get_tables` | `moduleId?` | Trả về bảng wiki (ngữ cảnh nghiệp vụ SAP dùng để soạn câu hỏi business) |
| `get_exercises` | — | Trả về metadata các bài tập Code Lab (nếu điểm yếu liên quan cú pháp ABAP) |
| `read_progress_export` | `path?` | Đọc file progress đã xuất; mặc định `~/Downloads/sap-quest-progress.json`, cấu hình qua env var `SAP_QUEST_PROGRESS_PATH`, hoặc override qua tham số `path`. Trả về xp/streak/badges/completedLessons + `reviewPool` đã join sẵn với nội dung câu hỏi gốc (câu hỏi gì, đáp án gì, explanation gì) để Claude không cần gọi thêm tool khác mới hiểu được vì sao câu đó "yếu" |
| `write_practice_set` | `id`, `title`, `moduleId`, `note`, `questions[]` | Validate schema câu hỏi (dùng lại logic validate hiện có trong `content.test.ts`, xem mục 4.2), ghi file `src/content/generated/<id>.json`. **Không commit.** Trả về lỗi validate cụ thể nếu có, để Claude tự sửa và gọi lại |
| `publish_practice_set` | `id` | Validate lại file đã ghi + chạy `npx vitest run` phần content liên quan; nếu pass: `git add`, `git commit`, `git push` lên `main` để GitHub Actions tự build & deploy. Nếu fail: trả lỗi, không commit gì |

Tách `write_practice_set` (soạn nháp) và `publish_practice_set` (xuất bản) thành 2 bước để có
một điểm dừng tự nhiên trong hội thoại — bạn xem nội dung nháp trước khi yêu cầu Claude
"publish" — vẫn giữ đúng yêu cầu tự động commit + push (chỉ là 2 lệnh gọi tool, không phải bạn
tự chạy `git` tay), nhưng tránh việc nội dung sai schema/hỏng test bị đẩy thẳng lên `main`.

### 3.3 Cấu hình phía Claude Desktop

File `claude_desktop_config.json` của người dùng cần thêm 1 entry MCP server trỏ tới
`npx tsx <đường dẫn tuyệt đối>/mcp-server/src/index.ts`, cộng với biến môi trường
`SAP_QUEST_PROGRESS_PATH` nếu muốn đổi vị trí file export mặc định. Việc hướng dẫn cấu hình cụ
thể sẽ nằm trong README của `mcp-server/`, không lặp lại trong tài liệu này.

## 4. Nội dung tự sinh (generated practice sets)

### 4.1 Định dạng & vị trí file

`src/content/generated/<id>.json`:

```json
{
  "id": "focus-co-valuation-2026-07-20",
  "title": "Ôn lại: Định giá tồn kho trong CO",
  "moduleId": "co",
  "createdAt": "2026-07-20",
  "note": "Sinh ra vì bạn hay sai các câu về MBEW/giá chuẩn trong track business",
  "questions": [ /* QuizQuestion[], schema y hệt content/types.ts */ ]
}
```

Dùng lại nguyên `QuizQuestion` union type đã có (`multiple-choice` / `true-false` /
`fill-blank` / `matching`) — **không** bị ràng buộc "3 lesson x 8 câu" như quiz chính thức,
vì đây là nội dung nhất thời, cá nhân hóa, không thuộc lộ trình cố định.

### 4.2 Validate dùng chung

Hàm `validateQuestion` hiện đang định nghĩa inline trong `src/content/content.test.ts` sẽ được
tách ra file `src/content/validateQuestion.ts`, export dùng chung cho:
- `content.test.ts` (test hiện có, không đổi hành vi)
- `src/content/generated/generated.test.ts` (test mới, xem mục 6)
- `mcp-server` (tool `write_practice_set` import trực tiếp cùng hàm này để validate trước khi
  ghi file — tránh viết lại logic validate ở 2 nơi)

### 4.3 Tự động nhận file mới

`src/content/generated/index.ts` dùng `import.meta.glob('./*.json', { eager: true })` của Vite
để tự động liệt kê mọi file trong thư mục — không cần sửa tay một file aggregator mỗi khi có
set mới (khác với cách `content/index.ts` và `content/lab/index.ts` hiện tại import thủ công
từng file, vì ở đây số lượng file thay đổi thường xuyên và không thể biết trước tên file).

## 5. Thay đổi trên website

### 5.1 Nút "Xuất tiến trình"

Thêm vào `src/components/ProgressHeader.tsx` một nút nhỏ, bấm vào sẽ serialize `ProgressState`
hiện tại (đã có sẵn trong `useProgress()`) thành JSON và trigger tải file
`sap-quest-progress.json` về máy (dùng `Blob` + thẻ `<a download>` tạm, không cần thư viện
mới). Không cần sửa `state/storage.ts`.

### 5.2 Route luyện tập cá nhân hóa

- `/practice` — danh sách các generated set (đọc từ `content/generated/index.ts`), hiển thị
  `title`, `moduleId`, `createdAt`, `note`.
- `/practice/:setId` — chạy set đó, tái dùng nguyên `QuestionCard` component (schema câu hỏi
  giống hệt lesson thường nên không cần code UI mới cho phần hỏi/đáp).
- Trả lời đúng cộng XP qua một hàm pure **mới** `recordPracticeAnswer(state, { correct })`
  trong `src/state/progress.ts` — cộng XP (hằng số riêng `XP_PRACTICE_CORRECT_ANSWER`, cùng
  giá trị `XP_CORRECT_ANSWER` hiện có), **không** đụng đến `reviewPool`, `completedLessons`,
  `perfectLessons`, hay badge.

  Lý do kỹ thuật bắt buộc phải tách riêng: `reviewPool` lưu `questionId` rồi tra ngược nội
  dung câu hỏi qua `findQuestion()` — hàm này chỉ tìm trong 3 lesson cố định của module
  (`QUIZ_TRACKS`), không biết gì về `content/generated/**`. Nếu để câu hỏi tự sinh lọt vào
  `reviewPool`, về sau `getReviewQuestionIds` → `findQuestion` → `filter(Boolean)` sẽ âm thầm
  loại bỏ câu đó khỏi review, tạo ra dữ liệu "rác" không bao giờ hiển thị lại được. Tách hàm
  riêng để không đụng vào cơ chế review đang hoạt động đúng.
- Không gọi `completeLesson` khi xong set — chỉ hiển thị màn hình tổng kết XP (tái dùng đúng
  bố cục summary đang có ở `LessonPage.tsx`), không tạo badge, không ảnh hưởng unlock lesson.

## 6. Testing

- `src/content/generated/generated.test.ts`: áp `validateQuestion` (dùng chung, mục 4.2) cho
  mọi file trong `content/generated/`, kiểm tra `id` không trùng với ID câu hỏi trong quiz
  chính thức lẫn giữa các generated set với nhau. **Không** ép số lượng lesson/câu cố định.
- `src/state/progress.test.ts`: thêm case cho `recordPracticeAnswer` — xác nhận chỉ XP tăng,
  `reviewPool`/`completedLessons`/`perfectLessons`/`badges` không đổi. Theo đúng pattern TDD
  (pure function, test trước khi implement) đang dùng cho các hàm khác trong file này.
- MCP server: test thủ công qua Claude Desktop thực tế (không có bộ test tự động cho phần
  giao tiếp MCP protocol trong phạm vi thiết kế này) — nhưng `write_practice_set` phải tái sử
  dụng đúng `validateQuestion`, nên mọi lỗi schema sẽ hiện ra ngay khi gọi tool, không cần chờ
  đến khi chạy `npx vitest run` trong bước publish.

## 7. Rủi ro & giới hạn đã biết

- **Auto push lên `main`:** `publish_practice_set` push thẳng vào nhánh `main` — đây là nhánh
  duy nhất kích hoạt `deploy.yml`. Vì đây là repo cá nhân và người dùng đã chủ động yêu cầu tự
  động hóa bước này, thiết kế chấp nhận rủi ro này với điều kiện bù trừ: validate + chạy test
  trước khi push, và có bước `write` riêng để xem trước nội dung.
- **Không thấy nội dung mới ngay trên bản deploy:** GitHub Pages chỉ cập nhật sau khi
  GitHub Actions build xong (vài chục giây đến vài phút) — nếu muốn thấy ngay lập tức, cần
  chạy `npm run dev`/`npm run preview` local.
- **File export progress có thể lỗi thời:** nếu quên bấm "Xuất tiến trình" sau khi học thêm,
  `read_progress_export` sẽ đọc dữ liệu cũ — không có cách tự động phát hiện việc này trong
  phạm vi thiết kế (đã cân nhắc đồng bộ tự động qua HTTP nhưng bị chặn bởi mixed-content, xem
  mục 2).
