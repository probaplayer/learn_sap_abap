import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'

const here = path.dirname(fileURLToPath(import.meta.url))

export const REPO_ROOT = path.resolve(here, '../..')
export const CONTENT_DIR = path.join(REPO_ROOT, 'src', 'content')
export const GENERATED_DIR = path.join(CONTENT_DIR, 'generated')

export function defaultProgressExportPath(): string {
  return process.env.SAP_QUEST_PROGRESS_PATH ?? path.join(os.homedir(), 'Downloads', 'sap-quest-progress.json')
}
