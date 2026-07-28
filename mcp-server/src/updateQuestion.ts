import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './paths.js'
import { requireMultipleChoice } from './requireMultipleChoice.js'
import { validateQuestion } from '../../src/content/validateQuestion.js'
import type { QuizQuestion } from '../../src/content/types.js'

export interface UpdateQuestionResult {
  questionId: string
  updatedFields: string[]
}

export function updateQuestion(
  moduleId: string,
  lessonId: string,
  questionId: string,
  question: QuizQuestion,
): UpdateQuestionResult {
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

  if (question.id !== questionId) {
    throw new Error(
      `update_question không hỗ trợ đổi id câu hỏi (id cũ "${questionId}", id mới "${question.id}"). ` +
        'Muốn đổi id, dùng delete_question rồi add_question.',
    )
  }

  requireMultipleChoice([question])
  const errors = validateQuestion(question)
  if (errors.length > 0) {
    throw new Error(`Câu hỏi không hợp lệ:\n${errors.join('\n')}`)
  }

  const oldQuestion = lesson.questions[idx] as unknown as Record<string, unknown>
  const newQuestion = question as unknown as Record<string, unknown>
  const updatedFields = Object.keys(newQuestion).filter(
    (key) => JSON.stringify(newQuestion[key]) !== JSON.stringify(oldQuestion[key]),
  )

  lesson.questions[idx] = question
  fs.writeFileSync(filePath, JSON.stringify(file, null, 2) + '\n', 'utf-8')

  return { questionId, updatedFields }
}
