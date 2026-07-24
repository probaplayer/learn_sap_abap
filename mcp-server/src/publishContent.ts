import { execFileSync } from 'node:child_process'
import { REPO_ROOT } from './paths.js'

export function publishContent(commitMessage: string): { commitHash: string } {
  const testResult = runFullTestSuite()
  if (!testResult.success) {
    throw new Error(`Test thất bại, không publish:\n${testResult.output}`)
  }

  try {
    execFileSync('git', ['add', 'src/content'], { cwd: REPO_ROOT })
    execFileSync('git', ['commit', '-m', commitMessage], { cwd: REPO_ROOT })
    execFileSync('git', ['push', 'origin', 'main'], { cwd: REPO_ROOT })
  } catch (err) {
    throw new Error(`Lỗi khi commit/push: ${(err as Error).message}`)
  }

  const commitHash = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf-8' }).trim()
  return { commitHash }
}

function runFullTestSuite(): { success: boolean; output: string } {
  try {
    const output = execFileSync('npx', ['vitest', 'run'], { cwd: REPO_ROOT, encoding: 'utf-8' })
    return { success: true, output }
  } catch (err) {
    const execErr = err as { stdout?: string; message: string }
    return { success: false, output: execErr.stdout ?? execErr.message }
  }
}
