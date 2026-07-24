import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './paths.js'
import { listModules } from './contentReaders.js'

export interface UpdateModuleInfoInput {
  id: string
  module: {
    name: string
    shortName: string
    icon: string
    color: string
    description: string
    businessPurpose: string
    order: number
  }
}

export function updateModuleInfo(input: UpdateModuleInfoInput): { filePath: string } {
  const filePath = path.join(CONTENT_DIR, input.id, 'module.json')
  if (!fs.existsSync(filePath)) {
    throw new Error(`Không tìm thấy ${filePath} — module "${input.id}" không tồn tại`)
  }

  const otherModules = listModules().filter((m) => m.id !== input.id)
  if (otherModules.some((m) => m.order === input.module.order)) {
    throw new Error(`order ${input.module.order} đã được dùng bởi module khác`)
  }

  const moduleJson = {
    id: input.id,
    order: input.module.order,
    name: input.module.name,
    shortName: input.module.shortName,
    icon: input.module.icon,
    color: input.module.color,
    description: input.module.description,
    businessPurpose: input.module.businessPurpose,
  }
  fs.writeFileSync(filePath, JSON.stringify(moduleJson, null, 2) + '\n', 'utf-8')
  return { filePath }
}
