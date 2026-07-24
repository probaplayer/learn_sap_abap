import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './paths.js'
import { validateQuestion } from '../../src/content/validateQuestion.js'
import type { QuizQuestion } from '../../src/content/types.js'

export interface UpdateLessonDraftInput {
  id: string
  difficulty: string
  title: string
  questions: QuizQuestion[]
}

export function updateLessonDraft(moduleId: string, lesson: UpdateLessonDraftInput): { filePath: string } {
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
  const idx = file.lessons.findIndex((l) => l.id === lesson.id)
  if (idx === -1) {
    throw new Error(`Không tìm thấy lesson id "${lesson.id}" trong module "${moduleId}"`)
  }

  file.lessons[idx] = lesson
  fs.writeFileSync(filePath, JSON.stringify(file, null, 2) + '\n', 'utf-8')
  return { filePath }
}
