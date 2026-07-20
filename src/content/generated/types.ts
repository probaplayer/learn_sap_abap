import type { ModuleId, QuizQuestion } from '../types'

export interface GeneratedPracticeSet {
  id: string
  title: string
  moduleId: ModuleId
  createdAt: string
  note: string
  questions: QuizQuestion[]
}
