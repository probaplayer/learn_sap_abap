import { existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { MODULE_ORDER, MODULES, QUIZ_LESSONS, TABLES } from './index'
import { validateQuestion, validateTableEntry } from './validateQuestion'

const CONTENT_DIR = dirname(fileURLToPath(import.meta.url))

describe('content schema validation', () => {
  it('discovers every module directory via the content directory scan', () => {
    // Independently walk the filesystem (instead of hard-coding module ids) so this test
    // catches a broken import.meta.glob pattern in index.ts without needing an update every
    // time a module directory is added.
    const moduleDirs = readdirSync(CONTENT_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(CONTENT_DIR, entry.name, 'module.json')))
      .map((entry) => entry.name)

    expect(new Set(MODULE_ORDER)).toEqual(new Set(moduleDirs))
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
