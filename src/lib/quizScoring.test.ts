import { describe, expect, it } from 'vitest'
import { isAnswerCorrect } from './quizScoring'
import type {
  FillBlankQuestion,
  MatchingQuestion,
  MultipleChoiceQuestion,
  TrueFalseQuestion,
} from '../content/types'

const mcq: MultipleChoiceQuestion = {
  id: 'mcq1',
  type: 'multiple-choice',
  difficulty: 'basic',
  explanation: '',
  question: 'MARA là bảng gì?',
  options: ['Material Master - General Data', 'Sales Order', 'GL Account'],
  answerIndex: 0,
}

const tf: TrueFalseQuestion = {
  id: 'tf1',
  type: 'true-false',
  difficulty: 'basic',
  explanation: '',
  statement: 'MARA lưu dữ liệu chung của vật tư, không phân theo plant.',
  answer: true,
}

const fb: FillBlankQuestion = {
  id: 'fb1',
  type: 'fill-blank',
  difficulty: 'basic',
  explanation: '',
  prompt: 'Bảng lưu dữ liệu chung của vật tư là ___.',
  acceptableAnswers: ['MARA', 'mara'],
}

const matching: MatchingQuestion = {
  id: 'mt1',
  type: 'matching',
  difficulty: 'basic',
  explanation: '',
  pairs: [
    { left: 'MARA', right: 'General material data' },
    { left: 'MARC', right: 'Plant data for material' },
  ],
}

describe('isAnswerCorrect', () => {
  it('checks multiple-choice by index', () => {
    expect(isAnswerCorrect(mcq, { type: 'multiple-choice', selectedIndex: 0 })).toBe(true)
    expect(isAnswerCorrect(mcq, { type: 'multiple-choice', selectedIndex: 1 })).toBe(false)
  })

  it('checks true-false by boolean equality', () => {
    expect(isAnswerCorrect(tf, { type: 'true-false', selectedValue: true })).toBe(true)
    expect(isAnswerCorrect(tf, { type: 'true-false', selectedValue: false })).toBe(false)
  })

  it('checks fill-blank case-insensitively and trims whitespace', () => {
    expect(isAnswerCorrect(fb, { type: 'fill-blank', text: 'mara' })).toBe(true)
    expect(isAnswerCorrect(fb, { type: 'fill-blank', text: '  MARA  ' })).toBe(true)
    expect(isAnswerCorrect(fb, { type: 'fill-blank', text: 'MARC' })).toBe(false)
  })

  it('checks matching requires every pair correct', () => {
    expect(
      isAnswerCorrect(matching, {
        type: 'matching',
        mapping: { MARA: 'General material data', MARC: 'Plant data for material' },
      }),
    ).toBe(true)
    expect(
      isAnswerCorrect(matching, {
        type: 'matching',
        mapping: { MARA: 'Plant data for material', MARC: 'General material data' },
      }),
    ).toBe(false)
  })

  it('rejects mismatched answer types', () => {
    expect(isAnswerCorrect(mcq, { type: 'true-false', selectedValue: true })).toBe(false)
  })
})
