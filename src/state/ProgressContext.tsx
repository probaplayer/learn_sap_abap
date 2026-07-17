import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { ProgressState } from './types'
import type { Track } from '../content/types'
import { loadProgress, saveProgress } from './storage'
import {
  completeLesson as completeLessonPure,
  getReviewQuestionIds,
  isLessonUnlocked as isLessonUnlockedPure,
  levelForXp,
  recordAnswer as recordAnswerPure,
} from './progress'

interface RecordAnswerArgs {
  moduleId: string
  questionId: string
  correct: boolean
  isReview: boolean
}

interface CompleteLessonArgs {
  moduleId: string
  track: Track
  lessonId: string
  mistakeCount: number
  lessonsByModuleTrack: Record<string, string[]>
}

interface ProgressContextValue {
  progress: ProgressState
  level: number
  recordAnswer: (args: RecordAnswerArgs) => number
  completeLesson: (args: CompleteLessonArgs) => { isFirstCompletion: boolean; bonusXp: number; newlyEarnedBadges: string[] }
  isLessonUnlocked: (moduleId: string, track: Track, lessonIdsInOrder: string[], lessonId: string) => boolean
  reviewQuestionIds: (moduleId: string) => string[]
}

const ProgressContext = createContext<ProgressContextValue | null>(null)

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<ProgressState>(() => loadProgress())

  // Mirrors `progress` synchronously (unlike the state variable, which only
  // updates on the next render). recordAnswer/completeLesson read and write
  // through this ref instead of a setState updater so that two calls in the
  // same event handler compose correctly, and so neither pure function ever
  // runs inside a React-invoked updater (StrictMode dev mode double-invokes
  // updater functions, which would silently discard the first result here).
  const latestRef = useRef(progress)

  useEffect(() => {
    latestRef.current = progress
    saveProgress(progress)
  }, [progress])

  const value = useMemo<ProgressContextValue>(
    () => ({
      progress,
      level: levelForXp(progress.xp),
      recordAnswer: (args) => {
        const result = recordAnswerPure(latestRef.current, args)
        latestRef.current = result.state
        setProgress(result.state)
        return result.xpGained
      },
      completeLesson: (args) => {
        const result = completeLessonPure(latestRef.current, args)
        latestRef.current = result.state
        setProgress(result.state)
        return {
          isFirstCompletion: result.isFirstCompletion,
          bonusXp: result.bonusXp,
          newlyEarnedBadges: result.newlyEarnedBadges,
        }
      },
      isLessonUnlocked: (moduleId, track, lessonIdsInOrder, lessonId) =>
        isLessonUnlockedPure(progress, moduleId, track, lessonIdsInOrder, lessonId),
      reviewQuestionIds: (moduleId) => getReviewQuestionIds(progress, moduleId),
    }),
    [progress],
  )

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
}

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext)
  if (!ctx) throw new Error('useProgress must be used within a ProgressProvider')
  return ctx
}
