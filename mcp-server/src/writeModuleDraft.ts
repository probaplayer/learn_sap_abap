import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './paths.js'
import { getAllTables } from './contentReaders.js'
import { validateQuestion, validateTableEntry } from '../../src/content/validateQuestion.js'
import type { QuizQuestion, TableEntry } from '../../src/content/types.js'

export interface WriteModuleDraftInput {
  id: string
  order: number
  module: {
    name: string
    shortName: string
    icon: string
    color: string
    description: string
    businessPurpose: string
  }
  tables: Omit<TableEntry, 'module'>[]
  lessons: { id: string; difficulty: string; title: string; questions: QuizQuestion[] }[]
}

export function writeModuleDraft(input: WriteModuleDraftInput): { dir: string } {
  if (!/^[a-z0-9-]+$/.test(input.id)) {
    throw new Error(`id "${input.id}" không hợp lệ — chỉ dùng chữ thường, số, dấu gạch ngang`)
  }
  const dir = path.join(CONTENT_DIR, input.id)
  if (fs.existsSync(dir)) {
    throw new Error(`Module "${input.id}" đã tồn tại tại ${dir}`)
  }
  if (input.lessons.length < 3) {
    throw new Error(`Module cần ít nhất 3 lesson, hiện có ${input.lessons.length}`)
  }
  for (const lesson of input.lessons) {
    if (lesson.questions.length !== 8) {
      throw new Error(`Lesson "${lesson.id}" cần đúng 8 câu hỏi, hiện có ${lesson.questions.length}`)
    }
    const errors = lesson.questions.flatMap((q) => validateQuestion(q))
    if (errors.length > 0) {
      throw new Error(`Lesson "${lesson.id}" có câu hỏi không hợp lệ:\n${errors.join('\n')}`)
    }
  }
  if (input.tables.length === 0) {
    throw new Error('Module cần ít nhất 1 table entry')
  }
  const existingIds = new Set(getAllTables().map((t) => (t as { id: string }).id.toUpperCase()))
  const newIds = new Set(input.tables.map((t) => t.id.toUpperCase()))
  const allKnownIds = new Set([...existingIds, ...newIds])
  for (const table of input.tables) {
    const entry: TableEntry = { ...table, module: input.id }
    const errors = validateTableEntry(entry, allKnownIds)
    if (errors.length > 0) {
      throw new Error(`Table "${table.id}" không hợp lệ:\n${errors.join('\n')}`)
    }
  }

  fs.mkdirSync(dir, { recursive: true })

  const moduleJson = { id: input.id, order: input.order, ...input.module }
  fs.writeFileSync(path.join(dir, 'module.json'), JSON.stringify(moduleJson, null, 2) + '\n', 'utf-8')

  const tablesJson: TableEntry[] = input.tables.map((t) => ({ ...t, module: input.id }))
  fs.writeFileSync(path.join(dir, 'tables.json'), JSON.stringify(tablesJson, null, 2) + '\n', 'utf-8')

  const quizJson = { moduleId: input.id, lessons: input.lessons }
  fs.writeFileSync(path.join(dir, 'quiz.json'), JSON.stringify(quizJson, null, 2) + '\n', 'utf-8')

  return { dir }
}
