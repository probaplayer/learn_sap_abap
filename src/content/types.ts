export type Difficulty = 'basic' | 'intermediate' | 'advanced'
export type ModuleId = string

export interface ModuleInfo {
  id: ModuleId
  order: number
  name: string
  shortName: string
  icon: string
  color: string
  description: string
  businessPurpose: string
}

export interface TableFieldEntry {
  field: string
  description: string
}

export interface TableEntry {
  id: string
  name: string
  module: ModuleId
  purpose: string
  whereUsed: string
  keyFields: TableFieldEntry[]
  relatedTables: string[]
}

interface BaseQuestion {
  id: string
  difficulty: Difficulty
  explanation: string
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: 'multiple-choice'
  question: string
  options: string[]
  answerIndex: number
}

export interface TrueFalseQuestion extends BaseQuestion {
  type: 'true-false'
  statement: string
  answer: boolean
}

export interface FillBlankQuestion extends BaseQuestion {
  type: 'fill-blank'
  prompt: string
  acceptableAnswers: string[]
}

export interface MatchingPair {
  left: string
  right: string
}

export interface MatchingQuestion extends BaseQuestion {
  type: 'matching'
  pairs: MatchingPair[]
}

export type QuizQuestion =
  | MultipleChoiceQuestion
  | TrueFalseQuestion
  | FillBlankQuestion
  | MatchingQuestion

export interface Lesson {
  id: string
  difficulty: Difficulty
  title: string
  questions: QuizQuestion[]
}

export interface QuizFile {
  moduleId: ModuleId
  lessons: Lesson[]
}
