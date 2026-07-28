import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './paths.js'
import type { QuizQuestion } from '../../src/content/types.js'

export interface DeleteQuestionResult {
  deletedQuestionId: string
  remainingQuestionIds: string[]
}

export function deleteQuestion(moduleId: string, lessonId: string, questionId: string): DeleteQuestionResult {
  const filePath = path.join(CONTENT_DIR, moduleId, 'quiz.json')
  if (!fs.existsSync(filePath)) {
    throw new Error(`Không tìm thấy ${filePath} — module "${moduleId}" không tồn tại`)
  }

  const file = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
    moduleId: string
    lessons: { id: string; questions: QuizQuestion[] }[]
  }
  const lesson = file.lessons.find((l) => l.id === lessonId)
  if (!lesson) {
    throw new Error(
      `Không tìm thấy lesson id "${lessonId}" trong module "${moduleId}". Lesson hiện có: ${file.lessons
        .map((l) => l.id)
        .join(', ')}`,
    )
  }

  const idx = lesson.questions.findIndex((q) => q.id === questionId)
  if (idx === -1) {
    throw new Error(
      `Không tìm thấy câu hỏi id "${questionId}" trong lesson "${lessonId}". Câu hỏi hiện có: ${lesson.questions
        .map((q) => q.id)
        .join(', ')}`,
    )
  }

  if (lesson.questions.length - 1 < 8) {
    throw new Error(
      `Lesson "${lessonId}" hiện có ${lesson.questions.length} câu — cần giữ tối thiểu 8, không thể xóa thêm`,
    )
  }

  lesson.questions.splice(idx, 1)
  fs.writeFileSync(filePath, JSON.stringify(file, null, 2) + '\n', 'utf-8')

  return { deletedQuestionId: questionId, remainingQuestionIds: lesson.questions.map((q) => q.id) }
}
