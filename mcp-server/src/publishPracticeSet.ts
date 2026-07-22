import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { GENERATED_DIR, REPO_ROOT } from './paths.js'
import { validateQuestion } from '../../src/content/validateQuestion.js'
import type { QuizQuestion } from '../../src/content/types.js'

interface GeneratedSetFile {
  id: string
  questions: QuizQuestion[]
}

export function publishPracticeSet(id: string): { commitHash: string } {
  if (!/^[a-z0-9-]+$/.test(id)) {
    throw new Error(`id "${id}" không hợp lệ — chỉ dùng chữ thường, số, dấu gạch ngang`)
  }

  const filePath = path.join(GENERATED_DIR, `${id}.json`)
  if (!fs.existsSync(filePath)) {
    throw new Error(`Không tìm thấy file nháp ${filePath}. Gọi write_practice_set trước.`)
  }

  const set = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as GeneratedSetFile
  if (set.id !== id) {
    throw new Error(`File nháp có id "${set.id}" không khớp với id "${id}" được yêu cầu`)
  }
  const errors = set.questions.flatMap((q) => validateQuestion(q))
  if (errors.length > 0) {
    throw new Error(`File không hợp lệ, không publish:\n${errors.join('\n')}`)
  }

  const testResult = runGeneratedContentTests()
  if (!testResult.success) {
    throw new Error(`Test thất bại, không publish:\n${testResult.output}`)
  }

  const relativePath = path.relative(REPO_ROOT, filePath).replace(/\\/g, '/')
  try {
    execSync(`git add ${relativePath}`, { cwd: REPO_ROOT })
    execSync(`git commit -m "Add generated practice set: ${id}"`, { cwd: REPO_ROOT })
    execSync('git push origin main', { cwd: REPO_ROOT })
  } catch (err) {
    throw new Error(`Lỗi khi commit/push: ${(err as Error).message}`)
  }

  const commitHash = execSync('git rev-parse HEAD', { cwd: REPO_ROOT, encoding: 'utf-8' }).trim()
  return { commitHash }
}

function runGeneratedContentTests(): { success: boolean; output: string } {
  try {
    const output = execSync('npx vitest run src/content/generated/generated.test.ts', {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
    })
    return { success: true, output }
  } catch (err) {
    const execErr = err as { stdout?: string; message: string }
    return { success: false, output: execErr.stdout ?? execErr.message }
  }
}
