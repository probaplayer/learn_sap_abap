import { describe, expect, it } from 'vitest'
import { validateTableEntry, validateExerciseMeta } from './validateQuestion'
import type { TableEntry } from './types'
import type { ExerciseMeta } from './lab/types'

const baseTable: TableEntry = {
  id: 'MARA',
  name: 'General Material Data',
  module: 'mm',
  purpose: 'Lưu dữ liệu chung của vật tư',
  whereUsed: 'Material master',
  keyFields: [{ field: 'MATNR', description: 'Material number' }],
  relatedTables: [],
}

describe('validateTableEntry', () => {
  it('passes for a well-formed table entry', () => {
    expect(validateTableEntry(baseTable, new Set(['MARA']))).toEqual([])
  })

  it('flags missing keyFields', () => {
    const errors = validateTableEntry({ ...baseTable, keyFields: [] }, new Set(['MARA']))
    expect(errors).toContain('[MARA] needs >=1 keyFields')
  })

  it('flags a relatedTables entry that does not exist', () => {
    const errors = validateTableEntry({ ...baseTable, relatedTables: ['NOPE'] }, new Set(['MARA']))
    expect(errors).toContain('[MARA] unknown related table NOPE')
  })

  it('flags a whitespace-only name', () => {
    const errors = validateTableEntry({ ...baseTable, name: '   ' }, new Set(['MARA']))
    expect(errors).toContain('[MARA] missing name')
  })
})

const baseExercise: ExerciseMeta = {
  id: 'test-ex',
  title: 'Test exercise',
  category: 'algorithm',
  difficulty: 'basic',
  relatedExerciseIds: [],
  sourceFiles: ['test.abap'],
  problemStatement: 'Làm gì đó',
  concepts: ['loop'],
  tablesUsed: [],
  walkthrough: 'Bước 1...',
  sampleOutput: 'Kết quả minh họa',
}

describe('validateExerciseMeta', () => {
  it('passes when sourceFiles matches the actual files', () => {
    expect(validateExerciseMeta(baseExercise, ['test.abap'])).toEqual([])
  })

  it('flags a sourceFiles mismatch', () => {
    const errors = validateExerciseMeta(baseExercise, ['other.abap'])
    expect(errors.some((e) => e.includes('sourceFiles'))).toBe(true)
  })

  it('flags missing concepts', () => {
    const errors = validateExerciseMeta({ ...baseExercise, concepts: [] }, ['test.abap'])
    expect(errors).toContain('[test-ex] needs >=1 concepts')
  })

  it('flags a whitespace-only title', () => {
    const errors = validateExerciseMeta({ ...baseExercise, title: '   ' }, ['test.abap'])
    expect(errors).toContain('[test-ex] missing title')
  })
})
