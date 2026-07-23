import type { ModuleId, ModuleInfo, TableEntry, QuizFile, Lesson, QuizQuestion } from './types'

import mmModule from './mm/module.json'
import mmTables from './mm/tables.json'
import mmQuiz from './mm/quiz.json'

import coModule from './co/module.json'
import coTables from './co/tables.json'
import coQuiz from './co/quiz.json'

import fiGlModule from './fi-gl/module.json'
import fiGlTables from './fi-gl/tables.json'
import fiGlQuiz from './fi-gl/quiz.json'

import esModule from './enterprise-structure/module.json'
import esTables from './enterprise-structure/tables.json'
import esQuiz from './enterprise-structure/quiz.json'

import sdModule from './sd/module.json'
import sdTables from './sd/tables.json'
import sdQuiz from './sd/quiz.json'

export const MODULE_ORDER: ModuleId[] = ['enterprise-structure', 'mm', 'co', 'fi-gl', 'sd']

export const MODULES: Record<ModuleId, ModuleInfo> = {
  mm: mmModule as ModuleInfo,
  co: coModule as ModuleInfo,
  'fi-gl': fiGlModule as ModuleInfo,
  'enterprise-structure': esModule as ModuleInfo,
  sd: sdModule as ModuleInfo,
}

export const TABLES: Record<ModuleId, TableEntry[]> = {
  mm: mmTables as TableEntry[],
  co: coTables as TableEntry[],
  'fi-gl': fiGlTables as TableEntry[],
  'enterprise-structure': esTables as TableEntry[],
  sd: sdTables as TableEntry[],
}

export const QUIZ_LESSONS: Record<ModuleId, Lesson[]> = {
  mm: (mmQuiz as QuizFile).lessons,
  co: (coQuiz as QuizFile).lessons,
  'fi-gl': (fiGlQuiz as QuizFile).lessons,
  'enterprise-structure': (esQuiz as QuizFile).lessons,
  sd: (sdQuiz as QuizFile).lessons,
}

export function getAllTables(): TableEntry[] {
  return MODULE_ORDER.flatMap((id) => TABLES[id])
}

export function findTable(moduleId: ModuleId, tableId: string): TableEntry | undefined {
  return TABLES[moduleId]?.find((t) => t.id.toUpperCase() === tableId.toUpperCase())
}

export function findTableAnyModule(tableId: string): TableEntry | undefined {
  return getAllTables().find((t) => t.id.toUpperCase() === tableId.toUpperCase())
}

export function getLessons(moduleId: ModuleId): Lesson[] {
  return QUIZ_LESSONS[moduleId]
}

export function getLessonIds(moduleId: ModuleId): string[] {
  return getLessons(moduleId).map((l) => l.id)
}

export function getLesson(moduleId: ModuleId, lessonId: string): Lesson | undefined {
  return getLessons(moduleId).find((l) => l.id === lessonId)
}

export function findQuestion(moduleId: ModuleId, questionId: string): QuizQuestion | undefined {
  for (const lesson of getLessons(moduleId)) {
    const found = lesson.questions.find((q) => q.id === questionId)
    if (found) return found
  }
  return undefined
}

export function getAllLessonsByModule(): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const moduleId of MODULE_ORDER) {
    result[moduleId] = getLessonIds(moduleId)
  }
  return result
}
