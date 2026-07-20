import type { QuizQuestion } from './types'

export const VALID_DIFFICULTIES = ['basic', 'intermediate', 'advanced']
export const VALID_QUESTION_TYPES = ['multiple-choice', 'true-false', 'fill-blank', 'matching']

export function validateQuestion(q: QuizQuestion): string[] {
  const errors: string[] = []
  if (!q.id) errors.push('missing id')
  if (!VALID_DIFFICULTIES.includes(q.difficulty)) errors.push(`invalid difficulty: ${q.difficulty}`)
  if (!VALID_QUESTION_TYPES.includes(q.type)) errors.push(`invalid type: ${q.type}`)
  if (!q.explanation || q.explanation.trim().length === 0) errors.push(`[${q.id}] missing explanation`)

  switch (q.type) {
    case 'multiple-choice':
      if (!q.question) errors.push(`[${q.id}] missing question text`)
      if (!Array.isArray(q.options) || q.options.length < 2) errors.push(`[${q.id}] needs >=2 options`)
      if (q.answerIndex < 0 || q.answerIndex >= (q.options?.length ?? 0)) {
        errors.push(`[${q.id}] answerIndex out of range`)
      }
      break
    case 'true-false':
      if (!q.statement) errors.push(`[${q.id}] missing statement`)
      if (typeof q.answer !== 'boolean') errors.push(`[${q.id}] answer must be boolean`)
      break
    case 'fill-blank':
      if (!q.prompt) errors.push(`[${q.id}] missing prompt`)
      if (!Array.isArray(q.acceptableAnswers) || q.acceptableAnswers.length === 0) {
        errors.push(`[${q.id}] needs >=1 acceptableAnswers`)
      }
      break
    case 'matching':
      if (!Array.isArray(q.pairs) || q.pairs.length < 2) errors.push(`[${q.id}] needs >=2 pairs`)
      if (q.pairs) {
        const lefts = new Set(q.pairs.map((p) => p.left))
        if (lefts.size !== q.pairs.length) errors.push(`[${q.id}] duplicate 'left' values in pairs`)
      }
      break
  }
  return errors
}
