import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './paths.js'
import { MODULE_ORDER, MODULES, QUIZ_LESSONS, TABLES } from '../../src/content/index.js'
import type { ModuleId } from '../../src/content/types.js'

export { MODULE_ORDER }
export type { ModuleId }

export function listModules() {
  return MODULE_ORDER.map((id) => MODULES[id])
}

export function getQuizLessons(moduleId: ModuleId) {
  return QUIZ_LESSONS[moduleId]
}

export function getTables(moduleId?: ModuleId) {
  const ids = moduleId ? [moduleId] : MODULE_ORDER
  return ids.flatMap((id) => TABLES[id])
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
}

export function getExercises() {
  const labDir = path.join(CONTENT_DIR, 'lab')
  const exerciseDirs = fs
    .readdirSync(labDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)

  return exerciseDirs.map((dir) => readJson(path.join(labDir, dir, 'exercise.json')))
}
