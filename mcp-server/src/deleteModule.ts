import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR, GENERATED_DIR } from './paths.js'
import { MODULE_ORDER } from './contentReaders.js'
import type { TableEntry } from '../../src/content/types.js'

export interface DeleteModuleResult {
  deletedId: string
  remainingModules: { id: string; order: number; name: string }[]
}

// Live-scanning helpers: this file does its own filesystem scans instead of reusing
// contentReaders.ts's cached helpers because a module created earlier in the same MCP server
// session via write_module_draft wouldn't be visible in the cached MODULE_ORDER (which is
// computed once at process startup), and this tool specifically needs to see it.
function listModuleIdsLive(): string[] {
  return fs
    .readdirSync(CONTENT_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter((d) => fs.existsSync(path.join(CONTENT_DIR, d.name, 'module.json')))
    .map((d) => d.name)
}

function readModuleLive(id: string): { id: string; order: number; name: string } {
  return JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, id, 'module.json'), 'utf-8'))
}

function readTablesLive(id: string): TableEntry[] {
  return JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, id, 'tables.json'), 'utf-8'))
}

export function deleteModule(id: string): DeleteModuleResult {
  const allIds = listModuleIdsLive()
  if (!allIds.includes(id)) {
    throw new Error(`Module "${id}" không tồn tại`)
  }

  const allTables = allIds.flatMap((mid) => readTablesLive(mid))
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

  const idx = MODULE_ORDER.indexOf(id)
  if (idx !== -1) MODULE_ORDER.splice(idx, 1)

  const remainingModules = allIds
    .filter((mid) => mid !== id)
    .map((mid) => readModuleLive(mid))
    .sort((a, b) => a.order - b.order)

  return { deletedId: id, remainingModules }
}
