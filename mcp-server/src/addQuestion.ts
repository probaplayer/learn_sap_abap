import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './paths.js'
import { MODULE_ORDER, getQuizLessons } from './contentReaders.js'
import { requireMultipleChoice } from './requireMultipleChoice.js'
import { validateQuestion } from '../../src/content/validateQuestion.js'
import type { QuizQuestion } from '../../src/content/types.js'

export interface AddQuestionResult {
  questionId: string
  lessonQuestionCount: number
}

function findExistingQuestionLocation(questionId: string): string | undefined {
  for (const moduleId of MODULE_ORDER) {
    const lessons = getQuizLessons(moduleId) as { id: string; questions: { id: string }[] }[]
    for (const lesson of lessons) {
      if (lesson.questions.some((q) => q.id === questionId)) {
        return `module "${moduleId}", lesson "${lesson.id}"`
      }
    }
  }
  return undefined
}

export function addQuestion(moduleId: string, lessonId: string, question: QuizQuestion): AddQuestionResult {
  const filePath = path.join(CONTENT_DIR, moduleId, 'quiz.json')
  if (!fs.existsSync(filePath)) {
    throw new Error(`Không tìm thấy ${filePath} — module "${moduleId}" không tồn tại`)
  }

  requireMultipleChoice([question])
  const errors = validateQuestion(question)
  if (errors.length > 0) {
    throw new Error(`Câu hỏi không hợp lệ:\n${errors.join('\n')}`)
  }

  const existingLocation = findExistingQuestionLocation(question.id)
  if (existingLocation) {
    throw new Error(`Câu hỏi id "${question.id}" đã tồn tại ở ${existingLocation}`)
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

  lesson.questions.push(question)
  fs.writeFileSync(filePath, JSON.stringify(file, null, 2) + '\n', 'utf-8')

  return { questionId: question.id, lessonQuestionCount: lesson.questions.length }
}
