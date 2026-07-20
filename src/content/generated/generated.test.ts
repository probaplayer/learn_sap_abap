import { describe, expect, it } from 'vitest'
import { GENERATED_SETS } from './index'
import { validateQuestion } from '../validateQuestion'
import { MODULE_ORDER, QUIZ_TRACKS } from '../index'

describe('generated practice sets', () => {
  it('every set has a valid moduleId and at least one valid question', () => {
    for (const set of GENERATED_SETS) {
      expect(MODULE_ORDER.includes(set.moduleId), `${set.id}: invalid moduleId ${set.moduleId}`).toBe(true)
      expect(set.questions.length, `${set.id}: has no questions`).toBeGreaterThan(0)

      for (const q of set.questions) {
        const errors = validateQuestion(q)
        expect(errors, `${set.id}/${q.id}: ${errors.join('; ')}`).toEqual([])
      }
    }
  })

  it('generated question ids never collide with official quiz ids or each other', () => {
    const officialIds = new Set<string>()
    for (const moduleId of MODULE_ORDER) {
      for (const track of ['syntax', 'business'] as const) {
        for (const lesson of QUIZ_TRACKS[moduleId][track].lessons) {
          for (const q of lesson.questions) officialIds.add(q.id)
        }
      }
    }

    const seen = new Set<string>()
    for (const set of GENERATED_SETS) {
      for (const q of set.questions) {
        expect(officialIds.has(q.id), `${set.id}/${q.id} collides with an official quiz question id`).toBe(false)
        expect(seen.has(q.id), `duplicate generated question id: ${q.id}`).toBe(false)
        seen.add(q.id)
      }
    }
  })

  it('set ids are unique', () => {
    const ids = new Set(GENERATED_SETS.map((s) => s.id))
    expect(ids.size).toBe(GENERATED_SETS.length)
  })
})
