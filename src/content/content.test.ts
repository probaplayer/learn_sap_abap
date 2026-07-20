import { describe, expect, it } from 'vitest'
import { MODULE_ORDER, MODULES, QUIZ_TRACKS, TABLES } from './index'
import { validateQuestion } from './validateQuestion'

const TRACKS = ['syntax', 'business'] as const

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
