import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR, GENERATED_DIR } from './paths.js'
import { getAllTables, listModules } from './contentReaders.js'
import type { TableEntry } from '../../src/content/types.js'

export interface DeleteModuleResult {
  deletedId: string
  remainingModules: { id: string; order: number; name: string }[]
}

export function deleteModule(id: string): DeleteModuleResult {
  // Fetch everything we need BEFORE mutating anything on disk. listModules()/getAllTables()
  // derive their id set from contentReaders.ts's MODULE_ORDER, which is computed once when the
  // MCP server process started — it will not reflect this deletion until the process restarts.
  // Reading it now (pre-delete) is correct; re-reading it after fs.rmSync below would throw
  // trying to stat the now-deleted module's files.
  const modules = listModules() as { id: string; order: number; name: string }[]
  if (!modules.some((m) => m.id === id)) {
    throw new Error(`Module "${id}" không tồn tại`)
  }

  const allTables = getAllTables() as TableEntry[]
  const ownTableIds = new Set(allTables.filter((t) => t.module === id).map((t) => t.id.toUpperCase()))
  const referencingTables = allTables.filter(
    (t) => t.module !== id && (t.relatedTables ?? []).some((rid) => ownTableIds.has(rid.toUpperCase())),
  )
  if (referencingTables.length > 0) {
    const list = referencingTables
      .map(
        (t) =>
          `${t.id} (module "${t.module}") -> ${t.relatedTables
            .filter((rid) => ownTableIds.has(rid.toUpperCase()))
            .join(', ')}`,
      )
      .join('; ')
    throw new Error(`Không thể xóa module "${id}": các table sau đang tham chiếu tới table của module này: ${list}`)
  }

  const generatedFiles = fs.existsSync(GENERATED_DIR)
    ? fs.readdirSync(GENERATED_DIR).filter((f) => f.endsWith('.json'))
    : []
  const referencingSets: string[] = []
  for (const file of generatedFiles) {
    const set = JSON.parse(fs.readFileSync(path.join(GENERATED_DIR, file), 'utf-8')) as {
      id: string
      moduleId: string
    }
    if (set.moduleId === id) referencingSets.push(set.id)
  }
  if (referencingSets.length > 0) {
    throw new Error(
      `Không thể xóa module "${id}": các bộ luyện tập sau đang tham chiếu module này: ${referencingSets.join(', ')}`,
    )
  }

  fs.rmSync(path.join(CONTENT_DIR, id), { recursive: true, force: true })

  const remainingModules = modules.filter((m) => m.id !== id).sort((a, b) => a.order - b.order)
  return { deletedId: id, remainingModules }
}
