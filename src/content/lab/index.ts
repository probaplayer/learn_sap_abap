import type { Exercise, ExerciseMeta } from './types'

const metaFiles = import.meta.glob('./*/exercise.json', { eager: true }) as Record<string, { default: ExerciseMeta }>
const rawFiles = import.meta.glob('./*/files/*.abap', { eager: true, query: '?raw', import: 'default' }) as Record<
  string,
  string
>

// import.meta.glob keys look like "./zday2-exe-01/exercise.json" — the exercise id directory
// name is the path segment right after "./".
function dirFromMetaKey(key: string): string {
  return key.split('/')[1]
}

export const EXERCISES: Exercise[] = Object.entries(metaFiles)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([metaKey, mod]) => {
    const meta = mod.default
    const dir = dirFromMetaKey(metaKey)
    const files = meta.sourceFiles.map((filename) => {
      const fileKey = `./${dir}/files/${filename}`
      const code = rawFiles[fileKey]
      if (code === undefined) {
        throw new Error(`Exercise ${meta.id}: missing source file ${filename} (expected at ${fileKey})`)
      }
      return { filename, code }
    })
    return { ...meta, files }
  })

export function findExercise(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id)
}
