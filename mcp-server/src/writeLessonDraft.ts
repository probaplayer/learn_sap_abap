import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './paths.js'
import { validateQuestion } from '../../src/content/validateQuestion.js'
import type { QuizQuestion } from '../../src/content/types.js'

export interface LessonDraftInput {
  id: string
  difficulty: string
  title: string
  questions: QuizQuestion[]
}

export function writeLessonDraft(moduleId: string, lesson: LessonDraftInput): { filePath: string } {
  const filePath = path.join(CONTENT_DIR, moduleId, 'quiz.json')
  if (!fs.existsSync(filePath)) {
    throw new Error(`Không tìm thấy ${filePath} — module "${moduleId}" không tồn tại`)
  }
  if (lesson.questions.length !== 8) {
    throw new Error(`Lesson cần đúng 8 câu hỏi, hiện có ${lesson.questions.length}`)
  }
  const errors = lesson.questions.flatMap((q) => validateQuestion(q))
  if (errors.length > 0) {
    throw new Error(`Câu hỏi không hợp lệ:\n${errors.join('\n')}`)
  }

  const file = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as { moduleId: string; lessons: { id: string }[] }
  if (file.lessons.some((l) => l.id === lesson.id)) {
    throw new Error(`Lesson id "${lesson.id}" đã tồn tại trong module "${moduleId}"`)
  }

  file.lessons.push(lesson)
  fs.writeFileSync(filePath, JSON.stringify(file, null, 2) + '\n', 'utf-8')
  return { filePath }
}
