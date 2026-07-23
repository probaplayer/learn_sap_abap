import { describe, expect, it } from 'vitest'
import { MODULE_ORDER, MODULES, QUIZ_LESSONS, TABLES } from './index'
import { validateQuestion, validateTableEntry } from './validateQuestion'

describe('content schema validation', () => {
  it('discovers all 5 known modules via the content directory scan', () => {
    expect(MODULE_ORDER.length).toBe(5)
    expect(new Set(MODULE_ORDER)).toEqual(new Set(['mm', 'co', 'fi-gl', 'enterprise-structure', 'sd']))
  })

  it('every module has a module.json with matching id and a unique order', () => {
    const seenOrders = new Set<number>()
    for (const moduleId of MODULE_ORDER) {
      expect(MODULES[moduleId].id).toBe(moduleId)
      expect(MODULES[moduleId].name.length).toBeGreaterThan(0)
      expect(MODULES[moduleId].businessPurpose.length).toBeGreaterThan(0)
      expect(seenOrders.has(MODULES[moduleId].order), `duplicate order value: ${MODULES[moduleId].order}`).toBe(
        false,
      )
      seenOrders.add(MODULES[moduleId].order)
    }
  })

  it('every table entry is well-formed and belongs to its module', () => {
    const allTableIds = new Set(MODULE_ORDER.flatMap((m) => TABLES[m].map((t) => t.id.toUpperCase())))
    for (const moduleId of MODULE_ORDER) {
      expect(TABLES[moduleId].length).toBeGreaterThan(0)
      for (const table of TABLES[moduleId]) {
        expect(table.module).toBe(moduleId)
        const errors = validateTableEntry(table, allTableIds)
        expect(errors, `${moduleId}/${table.id}: ${errors.join('; ')}`).toEqual([])
      }
    }
  })

  it('every module has at least 3 lessons of 8 questions each, all valid', () => {
    const allIds = new Set<string>()

    for (const moduleId of MODULE_ORDER) {
      const lessons = QUIZ_LESSONS[moduleId]
      expect(lessons.length).toBeGreaterThanOrEqual(3)

      for (const lesson of lessons) {
        expect(lesson.questions.length).toBe(8)

        for (const q of lesson.questions) {
          const errors = validateQuestion(q)
          expect(errors, `${moduleId}/${lesson.id}: ${errors.join('; ')}`).toEqual([])

          expect(allIds.has(q.id), `duplicate question id: ${q.id}`).toBe(false)
          allIds.add(q.id)
        }
      }
    }
  })
})
