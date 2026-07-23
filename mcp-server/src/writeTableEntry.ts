import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './paths.js'
import { getAllTables } from './contentReaders.js'
import { validateTableEntry } from '../../src/content/validateQuestion.js'
import type { TableEntry } from '../../src/content/types.js'

export function writeTableEntry(moduleId: string, table: Omit<TableEntry, 'module'>): { filePath: string } {
  const filePath = path.join(CONTENT_DIR, moduleId, 'tables.json')
  if (!fs.existsSync(filePath)) {
    throw new Error(`Không tìm thấy ${filePath} — module "${moduleId}" không tồn tại`)
  }

  const entry: TableEntry = { ...table, module: moduleId } as TableEntry
  const existingIds = new Set(getAllTables().map((t) => (t as { id: string }).id.toUpperCase()))
  existingIds.add(entry.id.toUpperCase())
  const errors = validateTableEntry(entry, existingIds)
  if (errors.length > 0) {
    throw new Error(`Table "${entry.id}" không hợp lệ:\n${errors.join('\n')}`)
  }

  const tables = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as TableEntry[]
  const idx = tables.findIndex((t) => t.id.toUpperCase() === entry.id.toUpperCase())
  if (idx >= 0) tables[idx] = entry
  else tables.push(entry)

  fs.writeFileSync(filePath, JSON.stringify(tables, null, 2) + '\n', 'utf-8')
  return { filePath }
}
