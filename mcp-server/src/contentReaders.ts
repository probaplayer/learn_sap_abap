import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './paths.js'
import type { ModuleId } from '../../src/content/types.js'

export type { ModuleId }

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
}

interface ModuleJson {
  id: string
  order: number
  [key: string]: unknown
}

function listModuleIds(): string[] {
  return fs
    .readdirSync(CONTENT_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter((d) => fs.existsSync(path.join(CONTENT_DIR, d.name, 'module.json')))
    .map((d) => d.name)
}

function readModule(moduleId: string): ModuleJson {
  return readJson(path.join(CONTENT_DIR, moduleId, 'module.json'))
}

export const MODULE_ORDER: ModuleId[] = listModuleIds().sort(
  (a, b) => readModule(a).order - readModule(b).order,
)

export function listModules() {
  // Read dynamically to catch modules created after MCP server startup (e.g., in smoke tests)
  const ids = listModuleIds().sort((a, b) => readModule(a).order - readModule(b).order)
  return ids.map((id) => readModule(id))
}

export function getQuizLessons(moduleId: ModuleId) {
  const file = readJson<{ moduleId: string; lessons: unknown[] }>(path.join(CONTENT_DIR, moduleId, 'quiz.json'))
  return file.lessons
}

export function getTables(moduleId?: ModuleId) {
  const ids = moduleId ? [moduleId] : listModuleIds().sort((a, b) => readModule(a).order - readModule(b).order)
  return ids.flatMap((id) => readJson<unknown[]>(path.join(CONTENT_DIR, id, 'tables.json')))
}

export function getAllTables() {
  return getTables()
}

export function getExercises() {
  const labDir = path.join(CONTENT_DIR, 'lab')
  const exerciseDirs = fs
    .readdirSync(labDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)

  return exerciseDirs.map((dir) => readJson(path.join(labDir, dir, 'exercise.json')))
}
