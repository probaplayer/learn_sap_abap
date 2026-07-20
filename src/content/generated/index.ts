import type { GeneratedPracticeSet } from './types'

const modules = import.meta.glob('./*.json', { eager: true }) as Record<string, { default: GeneratedPracticeSet }>

export const GENERATED_SETS: GeneratedPracticeSet[] = Object.values(modules)
  .map((m) => m.default)
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

export function findGeneratedSet(id: string): GeneratedPracticeSet | undefined {
  return GENERATED_SETS.find((s) => s.id === id)
}
