import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { getExercises, getQuizLessons, getTables, listModules, MODULE_ORDER } from './contentReaders.js'
import { readProgressExport } from './progressExport.js'
import { writePracticeSet } from './writePracticeSet.js'
import type { QuizQuestion } from '../../src/content/types.js'

const server = new McpServer({ name: 'sap-quest', version: '0.1.0' })

const moduleIdEnum = z.enum(MODULE_ORDER)
const looseQuestionSchema = z.record(z.string(), z.unknown())

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
    description: 'Trả về toàn bộ lesson và câu hỏi hiện có của 1 module + track',
    inputSchema: { moduleId: moduleIdEnum, track: z.enum(['syntax', 'business']) },
  },
  async ({ moduleId, track }) => ({
    content: [{ type: 'text', text: JSON.stringify(getQuizLessons(moduleId, track), null, 2) }],
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

const transport = new StdioServerTransport()
await server.connect(transport)
