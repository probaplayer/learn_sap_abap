import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './paths.js'
import { listModules } from './contentReaders.js'

export interface ReorderModulesResult {
  newOrder: { id: string; order: number }[]
}

export function reorderModules(orderedIds: string[]): ReorderModulesResult {
  const currentIds = (listModules() as { id: string }[]).map((m) => m.id)
  const currentSet = new Set(currentIds)
  const inputSet = new Set(orderedIds)

  const missing = currentIds.filter((id) => !inputSet.has(id))
  const unknown = orderedIds.filter((id) => !currentSet.has(id))
  const seen = new Set<string>()
  const duplicates: string[] = []
  for (const id of orderedIds) {
    if (seen.has(id)) duplicates.push(id)
    seen.add(id)
  }

  if (missing.length > 0 || unknown.length > 0 || duplicates.length > 0) {
    const parts: string[] = []
    if (missing.length > 0) parts.push(`thiếu: ${missing.join(', ')}`)
    if (unknown.length > 0) parts.push(`không tồn tại/thừa: ${unknown.join(', ')}`)
    if (duplicates.length > 0) parts.push(`bị lặp: ${duplicates.join(', ')}`)
    throw new Error(
      `orderedIds không khớp danh sách module hiện có (${parts.join('; ')}). Module hiện có: ${currentIds.join(', ')}`,
    )
  }

  const newOrder = orderedIds.map((id, index) => ({ id, order: index + 1 }))
  const patches = newOrder.map(({ id, order }) => {
    const filePath = path.join(CONTENT_DIR, id, 'module.json')
    const moduleJson = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>
    moduleJson.order = order
    return { filePath, moduleJson }
  })
  for (const { filePath, moduleJson } of patches) {
    fs.writeFileSync(filePath, JSON.stringify(moduleJson, null, 2) + '\n', 'utf-8')
  }

  return { newOrder }
}
