import type { QuizQuestion } from '../content/types'

export type UserAnswer =
  | { type: 'multiple-choice'; selectedIndex: number }
  | { type: 'true-false'; selectedValue: boolean }
  | { type: 'fill-blank'; text: string }
  | { type: 'matching'; mapping: Record<string, string> }

export function isAnswerCorrect(question: QuizQuestion, answer: UserAnswer): boolean {
  switch (question.type) {
    case 'multiple-choice':
      return answer.type === 'multiple-choice' && answer.selectedIndex === question.answerIndex
    case 'true-false':
      return answer.type === 'true-false' && answer.selectedValue === question.answer
    case 'fill-blank': {
      if (answer.type !== 'fill-blank') return false
      const normalized = answer.text.trim().toLowerCase()
      return question.acceptableAnswers.some((a) => a.trim().toLowerCase() === normalized)
    }
    case 'matching':
      return (
        answer.type === 'matching' &&
        question.pairs.every((p) => answer.mapping[p.left] === p.right)
      )
    default:
      return false
  }
}
