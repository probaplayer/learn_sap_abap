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

## Lưu ý về `tsc --noEmit`

Chạy `npx tsc --noEmit` trong thư mục này hiện báo 3 lỗi, cả 3 đều ở `../src/content/validateQuestion.ts`
(2 lỗi thiếu phần mở rộng `.js` trong import + 1 lỗi implicit-any). Đây là hệ quả của việc cấu hình
`moduleResolution: nodenext` của `mcp-server` không khớp với kiểu import bundler-style ở phía app khi file
này import chéo sang `../src/content/**`. Các lỗi này chỉ mang tính hiển thị (cosmetic) — không ảnh hưởng
runtime, vì `tsx` vẫn resolve đúng các đường dẫn này khi chạy thực tế. Đây là giới hạn đã biết và được
chấp nhận, không phải là regression.
