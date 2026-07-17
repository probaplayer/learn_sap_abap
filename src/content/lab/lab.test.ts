import { describe, expect, it } from 'vitest'
import { EXERCISES } from './index'
import { EXERCISE_CATEGORIES } from './types'

const VALID_CATEGORIES = new Set(Object.keys(EXERCISE_CATEGORIES))
const VALID_DIFFICULTIES = new Set(['basic', 'intermediate', 'advanced'])

describe('Code Lab content validation', () => {
  it('has 17 exercises with unique ids', () => {
    expect(EXERCISES.length).toBe(17)
    const ids = new Set(EXERCISES.map((e) => e.id))
    expect(ids.size).toBe(EXERCISES.length)
  })

  it('every exercise has a valid category and difficulty', () => {
    for (const ex of EXERCISES) {
      expect(VALID_CATEGORIES.has(ex.category), `${ex.id} has invalid category "${ex.category}"`).toBe(true)
      expect(VALID_DIFFICULTIES.has(ex.difficulty), `${ex.id} has invalid difficulty "${ex.difficulty}"`).toBe(true)
    }
  })

  it('sourceFiles matches the actual loaded files, and every file has non-empty code', () => {
    for (const ex of EXERCISES) {
      const loadedFilenames = ex.files.map((f) => f.filename)
      expect(loadedFilenames, `${ex.id}: sourceFiles mismatch`).toEqual(ex.sourceFiles)
      for (const file of ex.files) {
        expect(file.code.length, `${ex.id}/${file.filename} has empty source`).toBeGreaterThan(0)
      }
    }
  })

  it('has non-empty problemStatement, walkthrough, sampleOutput, and at least one concept', () => {
    for (const ex of EXERCISES) {
      expect(ex.problemStatement.trim().length, `${ex.id}: empty problemStatement`).toBeGreaterThan(0)
      expect(ex.walkthrough.trim().length, `${ex.id}: empty walkthrough`).toBeGreaterThan(0)
      expect(ex.sampleOutput.trim().length, `${ex.id}: empty sampleOutput`).toBeGreaterThan(0)
      expect(ex.concepts.length, `${ex.id}: no concepts listed`).toBeGreaterThan(0)
    }
  })

  it('relatedExerciseIds only reference exercises that actually exist', () => {
    const allIds = new Set(EXERCISES.map((e) => e.id))
    for (const ex of EXERCISES) {
      for (const relatedId of ex.relatedExerciseIds) {
        expect(allIds.has(relatedId), `${ex.id} -> unknown related exercise "${relatedId}"`).toBe(true)
      }
    }
  })

  it('sampleOutput carries the illustrative-data disclaimer', () => {
    for (const ex of EXERCISES) {
      expect(
        ex.sampleOutput.includes('minh họa') || ex.sampleOutput.includes('không phải chạy'),
        `${ex.id}: sampleOutput missing the "not a real run" disclaimer`,
      ).toBe(true)
    }
  })
})
