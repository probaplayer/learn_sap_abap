import type { ModuleId, ModuleInfo, TableEntry, QuizFile, Lesson, QuizQuestion } from './types'

const moduleFiles = import.meta.glob('./*/module.json', { eager: true }) as Record<string, { default: ModuleInfo }>
const tableFiles = import.meta.glob('./*/tables.json', { eager: true }) as Record<string, { default: TableEntry[] }>
const quizFiles = import.meta.glob('./*/quiz.json', { eager: true }) as Record<string, { default: QuizFile }>

// import.meta.glob keys look like "./mm/module.json" — the module id is the path segment
// right after "./".
function idFromGlobKey(key: string): ModuleId {
  return key.split('/')[1]
}

export const MODULES: Record<ModuleId, ModuleInfo> = Object.fromEntries(
  Object.entries(moduleFiles).map(([key, mod]) => [idFromGlobKey(key), mod.default]),
)

export const TABLES: Record<ModuleId, TableEntry[]> = Object.fromEntries(
  Object.entries(tableFiles).map(([key, tables]) => [idFromGlobKey(key), tables.default]),
)

export const QUIZ_LESSONS: Record<ModuleId, Lesson[]> = Object.fromEntries(
  Object.entries(quizFiles).map(([key, quiz]) => [idFromGlobKey(key), quiz.default.lessons]),
)

export const MODULE_ORDER: ModuleId[] = Object.keys(MODULES).sort((a, b) => MODULES[a].order - MODULES[b].order)

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
