import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR, defaultProgressExportPath } from './paths.js'
import type { ProgressState } from '../../src/state/types.js'

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
}

function findQuestionInModule(moduleId: string, questionId: string) {
  const file = readJson<{ lessons: { questions: { id: string }[] }[] }>(
    path.join(CONTENT_DIR, moduleId, 'quiz.json'),
  )
  for (const lesson of file.lessons) {
    const found = lesson.questions.find((q) => q.id === questionId)
    if (found) return found
  }
  return undefined
}

export function readProgressExport(overridePath?: string) {
  const filePath = overridePath ?? defaultProgressExportPath()
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Không tìm thấy file progress export tại ${filePath}. Hãy bấm nút "Xuất tiến trình" trên web trước, hoặc truyền path khác.`,
    )
  }

  const progress = readJson<ProgressState>(filePath)

  const reviewPoolWithContent = Object.fromEntries(
    Object.entries(progress.reviewPool).map(([moduleId, entries]) => [
      moduleId,
      entries.map((entry) => ({
        ...entry,
        question: findQuestionInModule(moduleId, entry.questionId),
      })),
    ]),
  )

  return { ...progress, reviewPool: reviewPoolWithContent }
}
