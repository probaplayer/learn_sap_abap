import { execFileSync } from 'node:child_process'
import { REPO_ROOT } from './paths.js'

// This used to run the full vitest suite here before committing/pushing. Spawning vitest as a
// nested child of this already-running MCP server process fails deterministically on at least
// one real machine ("Vitest failed to find the runner", every file 0 tests) regardless of Node
// version, vitest pool mode, or how the child is spawned — root cause not isolated. Run
// `npx vitest run` yourself before asking for a publish; this only commits + pushes src/content.
export function publishContent(commitMessage: string): { commitHash: string } {
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
