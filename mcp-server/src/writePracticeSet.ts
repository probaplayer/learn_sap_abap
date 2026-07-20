import fs from 'node:fs'
import path from 'node:path'
import { GENERATED_DIR } from './paths.js'
import { validateQuestion } from '../../src/content/validateQuestion.js'
import type { QuizQuestion } from '../../src/content/types.js'

export interface WritePracticeSetInput {
  id: string
  title: string
  moduleId: string
  note: string
  questions: QuizQuestion[]
}

export function writePracticeSet(input: WritePracticeSetInput): { filePath: string } {
  if (!/^[a-z0-9-]+$/.test(input.id)) {
    throw new Error(`id "${input.id}" không hợp lệ — chỉ dùng chữ thường, số, dấu gạch ngang`)
  }

  const errors = input.questions.flatMap((q) => validateQuestion(q))
  if (input.questions.length === 0) {
    errors.push('questions không được rỗng')
  }
  if (errors.length > 0) {
    throw new Error(`Câu hỏi không hợp lệ:\n${errors.join('\n')}`)
  }

  if (!fs.existsSync(GENERATED_DIR)) {
    fs.mkdirSync(GENERATED_DIR, { recursive: true })
  }

  const filePath = path.join(GENERATED_DIR, `${input.id}.json`)
  const payload = {
    id: input.id,
    title: input.title,
    moduleId: input.moduleId,
    createdAt: new Date().toISOString().slice(0, 10),
    note: input.note,
    questions: input.questions,
  }
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf-8')

  return { filePath }
}
