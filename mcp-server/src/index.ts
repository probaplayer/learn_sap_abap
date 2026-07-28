import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { getExercises, getQuizLessons, getTables, listModules, MODULE_ORDER } from './contentReaders.js'
import { readProgressExport } from './progressExport.js'
import { writePracticeSet } from './writePracticeSet.js'
import { publishPracticeSet } from './publishPracticeSet.js'
import { publishContent } from './publishContent.js'
import { writeModuleDraft } from './writeModuleDraft.js'
import type { WriteModuleDraftInput } from './writeModuleDraft.js'
import { updateModuleInfo } from './updateModuleInfo.js'
import { writeLessonDraft } from './writeLessonDraft.js'
import type { LessonDraftInput } from './writeLessonDraft.js'
import { updateLessonDraft } from './updateLessonDraft.js'
import type { UpdateLessonDraftInput } from './updateLessonDraft.js'
import { writeTableEntry } from './writeTableEntry.js'
import { writeLabExerciseDraft } from './writeLabExerciseDraft.js'
import { updateLabExerciseDraft } from './updateLabExerciseDraft.js'
import { deleteModule } from './deleteModule.js'
import { deleteLesson } from './deleteLesson.js'
import { addQuestion } from './addQuestion.js'
import { updateQuestion } from './updateQuestion.js'
import { deleteQuestion } from './deleteQuestion.js'
import { reorderModules } from './reorderModules.js'
import { EXERCISE_CATEGORIES } from '../../src/content/lab/types.js'
import type { QuizQuestion } from '../../src/content/types.js'
import type { ExerciseMeta } from '../../src/content/lab/types.js'

const server = new McpServer({ name: 'sap-quest', version: '0.1.0' })

const moduleIdEnum = z.enum(MODULE_ORDER)
const looseQuestionSchema = z.record(z.string(), z.unknown())
const tableFieldSchema = z.object({ field: z.string(), description: z.string() })
const tableEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  purpose: z.string(),
  whereUsed: z.string(),
  keyFields: z.array(tableFieldSchema),
  relatedTables: z.array(z.string()),
})
const moduleInfoSchema = z.object({
  name: z.string(),
  shortName: z.string(),
  icon: z.string(),
  color: z.string(),
  description: z.string(),
  businessPurpose: z.string(),
  order: z.number(),
})
const lessonSchema = z.object({
  id: z.string(),
  difficulty: z.enum(['basic', 'intermediate', 'advanced']),
  title: z.string(),
  questions: z.array(looseQuestionSchema),
})
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

server.registerTool(
  'list_modules',
  {
    title: 'List SAP modules',
    description: 'Trả về danh sách 5 module SAP Quest kèm mô tả nghiệp vụ',
    inputSchema: {},
  },
  async () => ({ content: [{ type: 'text', text: JSON.stringify(listModules(), null, 2) }] }),
)

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

server.registerTool(
  'get_tables',
  {
    title: 'Get wiki tables',
    description: 'Trả về bảng wiki SAP (ngữ cảnh nghiệp vụ) của 1 module, hoặc tất cả nếu không truyền moduleId',
    inputSchema: { moduleId: moduleIdEnum.optional() },
  },
  async ({ moduleId }) => ({ content: [{ type: 'text', text: JSON.stringify(getTables(moduleId), null, 2) }] }),
)

server.registerTool(
  'get_exercises',
  {
    title: 'Get Code Lab exercises',
    description: 'Trả về metadata các bài tập Code Lab hiện có',
    inputSchema: {},
  },
  async () => ({ content: [{ type: 'text', text: JSON.stringify(getExercises(), null, 2) }] }),
)

server.registerTool(
  'read_progress_export',
  {
    title: 'Read progress export',
    description: 'Đọc file progress đã xuất từ web, kèm nội dung câu hỏi trong reviewPool',
    inputSchema: { path: z.string().optional() },
  },
  async ({ path }) => ({ content: [{ type: 'text', text: JSON.stringify(readProgressExport(path), null, 2) }] }),
)

server.registerTool(
  'write_practice_set',
  {
    title: 'Write practice set draft',
    description: 'Ghi 1 bộ câu hỏi luyện tập mới vào src/content/generated (chưa commit)',
    inputSchema: {
      id: z.string(),
      title: z.string(),
      moduleId: moduleIdEnum,
      note: z.string(),
      questions: z.array(looseQuestionSchema),
    },
  },
  async ({ id, title, moduleId, note, questions }) => {
    const result = writePracticeSet({
      id,
      title,
      moduleId,
      note,
      questions: questions as unknown as QuizQuestion[],
    })
    return { content: [{ type: 'text', text: `Đã ghi nháp tại ${result.filePath}` }] }
  },
)

server.registerTool(
  'publish_practice_set',
  {
    title: 'Publish practice set',
    description: 'Validate + chạy test + commit & push bộ câu hỏi đã ghi lên main',
    inputSchema: { id: z.string() },
  },
  async ({ id }) => {
    const result = publishPracticeSet(id)
    return { content: [{ type: 'text', text: `Đã publish, commit ${result.commitHash}` }] }
  },
)

server.registerTool(
  'write_module_draft',
  {
    title: 'Write new module draft',
    description:
      'Tạo 1 module SAP mới (module.json + tables.json + quiz.json) trong src/content/<id>/, chưa commit. Mỗi lesson cần tối thiểu 8 câu, chỉ chấp nhận câu hỏi type multiple-choice.',
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

server.registerTool(
  'write_lesson_draft',
  {
    title: 'Write lesson draft',
    description: 'Thêm 1 lesson mới (tối thiểu 8 câu, chỉ multiple-choice) vào quiz.json của module đang có',
    inputSchema: { moduleId: moduleIdEnum, lesson: lessonSchema },
  },
  async ({ moduleId, lesson }) => {
    const result = writeLessonDraft(moduleId, lesson as unknown as LessonDraftInput)
    return { content: [{ type: 'text', text: `Đã thêm lesson vào ${result.filePath}` }] }
  },
)

server.registerTool(
  'update_lesson_draft',
  {
    title: 'Update lesson draft',
    description:
      'Thay toàn bộ nội dung 1 lesson đã có (tối thiểu 8 câu, chỉ multiple-choice) trong quiz.json của module, theo lesson.id',
    inputSchema: { moduleId: moduleIdEnum, lesson: lessonSchema },
  },
  async ({ moduleId, lesson }) => {
    const result = updateLessonDraft(moduleId, lesson as unknown as UpdateLessonDraftInput)
    return { content: [{ type: 'text', text: `Đã cập nhật lesson trong ${result.filePath}` }] }
  },
)

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

const transport = new StdioServerTransport()
await server.connect(transport)
