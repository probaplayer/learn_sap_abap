import { describe, expect, it } from 'vitest'
import { MODULE_ORDER, MODULES, QUIZ_TRACKS, TABLES } from './index'
import type { QuizQuestion } from './types'

const TRACKS = ['syntax', 'business'] as const
const DIFFICULTIES = ['basic', 'intermediate', 'advanced']
const QUESTION_TYPES = ['multiple-choice', 'true-false', 'fill-blank', 'matching']

function validateQuestion(q: QuizQuestion): string[] {
  const errors: string[] = []
  if (!q.id) errors.push('missing id')
  if (!DIFFICULTIES.includes(q.difficulty)) errors.push(`invalid difficulty: ${q.difficulty}`)
  if (!QUESTION_TYPES.includes(q.type)) errors.push(`invalid type: ${q.type}`)
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

describe('content schema validation', () => {
  it('every module has a module.json with matching id', () => {
    for (const moduleId of MODULE_ORDER) {
      expect(MODULES[moduleId].id).toBe(moduleId)
      expect(MODULES[moduleId].name.length).toBeGreaterThan(0)
      expect(MODULES[moduleId].businessPurpose.length).toBeGreaterThan(0)
    }
  })

  it('every table entry belongs to its module and has key fields', () => {
    for (const moduleId of MODULE_ORDER) {
      expect(TABLES[moduleId].length).toBeGreaterThan(0)
      for (const table of TABLES[moduleId]) {
        expect(table.module).toBe(moduleId)
        expect(table.id.length).toBeGreaterThan(0)
        expect(table.keyFields.length).toBeGreaterThan(0)
      }
    }
  })

  it('every track has 3 lessons of 8 questions each, all valid', () => {
    const allIds = new Set<string>()

    for (const moduleId of MODULE_ORDER) {
      for (const track of TRACKS) {
        const file = QUIZ_TRACKS[moduleId][track]
        expect(file.moduleId).toBe(moduleId)
        expect(file.track).toBe(track)
        expect(file.lessons.length).toBe(3)

        for (const lesson of file.lessons) {
          expect(lesson.questions.length).toBe(8)

          for (const q of lesson.questions) {
            const errors = validateQuestion(q)
            expect(errors, `${moduleId}/${track}/${lesson.id}: ${errors.join('; ')}`).toEqual([])

            expect(allIds.has(q.id), `duplicate question id: ${q.id}`).toBe(false)
            allIds.add(q.id)
          }
        }
      }
    }
  })

  it('related tables reference tables that actually exist somewhere', () => {
    const allTableIds = new Set(MODULE_ORDER.flatMap((m) => TABLES[m].map((t) => t.id.toUpperCase())))
    for (const moduleId of MODULE_ORDER) {
      for (const table of TABLES[moduleId]) {
        for (const rid of table.relatedTables) {
          expect(allTableIds.has(rid.toUpperCase()), `${moduleId}/${table.id} -> unknown related table ${rid}`).toBe(
            true,
          )
        }
      }
    }
  })
})
