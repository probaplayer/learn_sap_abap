import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR } from './paths.js'
import { validateExerciseMeta } from '../../src/content/validateQuestion.js'
import type { ExerciseMeta } from '../../src/content/lab/types.js'

export interface WriteLabExerciseDraftInput {
  id: string
  exercise: ExerciseMeta
  sourceFiles: { filename: string; content: string }[]
}

export function writeLabExerciseDraft(input: WriteLabExerciseDraftInput): { dir: string } {
  if (!/^[a-z0-9-]+$/.test(input.id)) {
    throw new Error(`id "${input.id}" không hợp lệ — chỉ dùng chữ thường, số, dấu gạch ngang`)
  }
  const dir = path.join(CONTENT_DIR, 'lab', input.id)
  if (fs.existsSync(dir)) {
    throw new Error(`Exercise "${input.id}" đã tồn tại tại ${dir}`)
  }

  const actualFilenames = input.sourceFiles.map((f) => f.filename)
  const errors = validateExerciseMeta(input.exercise, actualFilenames)
  if (errors.length > 0) {
    throw new Error(`Exercise không hợp lệ:\n${errors.join('\n')}`)
  }

  for (const file of input.sourceFiles) {
    if (path.basename(file.filename) !== file.filename || file.filename.includes('..')) {
      throw new Error(`Tên file không hợp lệ: "${file.filename}" — chỉ được dùng tên file đơn giản, không chứa đường dẫn`)
    }
  }

  const filesDir = path.join(dir, 'files')
  fs.mkdirSync(filesDir, { recursive: true })

  fs.writeFileSync(path.join(dir, 'exercise.json'), JSON.stringify(input.exercise, null, 2) + '\n', 'utf-8')
  for (const file of input.sourceFiles) {
    fs.writeFileSync(path.join(filesDir, file.filename), file.content, 'utf-8')
  }

  return { dir }
}
