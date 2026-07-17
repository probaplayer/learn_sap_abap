import type { ModuleId, ModuleInfo, TableEntry, QuizTrackFile, Track, Lesson, QuizQuestion } from './types'

import mmModule from './mm/module.json'
import mmTables from './mm/tables.json'
import mmSyntax from './mm/quiz-syntax.json'
import mmBusiness from './mm/quiz-business.json'

import coModule from './co/module.json'
import coTables from './co/tables.json'
import coSyntax from './co/quiz-syntax.json'
import coBusiness from './co/quiz-business.json'

import fiGlModule from './fi-gl/module.json'
import fiGlTables from './fi-gl/tables.json'
import fiGlSyntax from './fi-gl/quiz-syntax.json'
import fiGlBusiness from './fi-gl/quiz-business.json'

import esModule from './enterprise-structure/module.json'
import esTables from './enterprise-structure/tables.json'
import esSyntax from './enterprise-structure/quiz-syntax.json'
import esBusiness from './enterprise-structure/quiz-business.json'

import sdModule from './sd/module.json'
import sdTables from './sd/tables.json'
import sdSyntax from './sd/quiz-syntax.json'
import sdBusiness from './sd/quiz-business.json'

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

export const QUIZ_TRACKS: Record<ModuleId, { syntax: QuizTrackFile; business: QuizTrackFile }> = {
  mm: { syntax: mmSyntax as QuizTrackFile, business: mmBusiness as QuizTrackFile },
  co: { syntax: coSyntax as QuizTrackFile, business: coBusiness as QuizTrackFile },
  'fi-gl': { syntax: fiGlSyntax as QuizTrackFile, business: fiGlBusiness as QuizTrackFile },
  'enterprise-structure': { syntax: esSyntax as QuizTrackFile, business: esBusiness as QuizTrackFile },
  sd: { syntax: sdSyntax as QuizTrackFile, business: sdBusiness as QuizTrackFile },
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

export function getLessons(moduleId: ModuleId, track: Track): Lesson[] {
  return QUIZ_TRACKS[moduleId][track].lessons
}

export function getLessonIds(moduleId: ModuleId, track: Track): string[] {
  return getLessons(moduleId, track).map((l) => l.id)
}

export function getLesson(moduleId: ModuleId, track: Track, lessonId: string): Lesson | undefined {
  return getLessons(moduleId, track).find((l) => l.id === lessonId)
}

export function findQuestion(moduleId: ModuleId, questionId: string): QuizQuestion | undefined {
  for (const track of ['syntax', 'business'] as Track[]) {
    for (const lesson of getLessons(moduleId, track)) {
      const found = lesson.questions.find((q) => q.id === questionId)
      if (found) return found
    }
  }
  return undefined
}

export function getAllLessonsByModuleTrack(): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const moduleId of MODULE_ORDER) {
    for (const track of ['syntax', 'business'] as Track[]) {
      result[`${moduleId}:${track}`] = getLessonIds(moduleId, track)
    }
  }
  return result
}
