import type { QuizQuestion, TableEntry } from './types'
import type { ExerciseMeta } from './lab/types'

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

export function validateTableEntry(table: TableEntry, allKnownTableIds: Set<string>): string[] {
  const errors: string[] = []
  if (!table.id || table.id.trim().length === 0) errors.push('missing id')
  if (!table.name || table.name.trim().length === 0) errors.push(`[${table.id}] missing name`)
  if (!table.purpose || table.purpose.trim().length === 0) errors.push(`[${table.id}] missing purpose`)
  if (!table.whereUsed || table.whereUsed.trim().length === 0) errors.push(`[${table.id}] missing whereUsed`)
  if (!Array.isArray(table.keyFields) || table.keyFields.length === 0) {
    errors.push(`[${table.id}] needs >=1 keyFields`)
  }
  for (const rid of table.relatedTables ?? []) {
    if (!allKnownTableIds.has(rid.toUpperCase())) {
      errors.push(`[${table.id}] unknown related table ${rid}`)
    }
  }
  return errors
}

export function validateExerciseMeta(meta: ExerciseMeta, actualFilenames: string[]): string[] {
  const errors: string[] = []
  if (!meta.id || meta.id.trim().length === 0) errors.push('missing id')
  if (!meta.title || meta.title.trim().length === 0) errors.push(`[${meta.id}] missing title`)
  if (!meta.problemStatement || meta.problemStatement.trim().length === 0) {
    errors.push(`[${meta.id}] missing problemStatement`)
  }
  if (!meta.walkthrough || meta.walkthrough.trim().length === 0) errors.push(`[${meta.id}] missing walkthrough`)
  if (!meta.sampleOutput || meta.sampleOutput.trim().length === 0) errors.push(`[${meta.id}] missing sampleOutput`)
  if (!Array.isArray(meta.concepts) || meta.concepts.length === 0) {
    errors.push(`[${meta.id}] needs >=1 concepts`)
  }
  if (JSON.stringify(meta.sourceFiles) !== JSON.stringify(actualFilenames)) {
    errors.push(
      `[${meta.id}] sourceFiles ${JSON.stringify(meta.sourceFiles)} does not match actual files ${JSON.stringify(actualFilenames)}`,
    )
  }
  return errors
}
