import { StrictMode } from 'react'
import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { ProgressProvider, useProgress } from './ProgressContext'

function wrapper({ children }: { children: ReactNode }) {
  return (
    <StrictMode>
      <ProgressProvider>{children}</ProgressProvider>
    </StrictMode>
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('ProgressContext under StrictMode', () => {
  // Regression test: React 18/19 StrictMode (dev only) can invoke a setState
  // updater function more than once. The original implementation captured
  // recordAnswer/completeLesson's return values via a side-effecting closure
  // inside such an updater, so calling completeLesson right after
  // recordAnswer in the same handler silently returned bonusXp: 0 even
  // though the persisted xp total was correct. See git history for details.
  it('reports the correct bonusXp when completeLesson runs right after recordAnswer in the same tick', () => {
    const { result } = renderHook(() => useProgress(), { wrapper })

    let bonusXp = -1
    act(() => {
      result.current.recordAnswer({ moduleId: 'mm', questionId: 'q1', correct: true, isReview: false })
      const outcome = result.current.completeLesson({
        moduleId: 'mm',
        track: 'syntax',
        lessonId: 'basic',
        mistakeCount: 0,
        lessonsByModuleTrack: { 'mm:syntax': ['basic'] },
      })
      bonusXp = outcome.bonusXp
    })

    expect(bonusXp).toBe(20)
    expect(result.current.progress.xp).toBe(30)
    expect(result.current.progress.completedLessons).toEqual(['mm:syntax:basic'])
  })
})

describe('recordPracticeAnswer', () => {
  it('adds XP and returns the amount gained, without touching reviewPool', () => {
    const { result } = renderHook(() => useProgress(), { wrapper })

    let xpGained = -1
    act(() => {
      xpGained = result.current.recordPracticeAnswer(true)
    })

    expect(xpGained).toBe(10)
    expect(result.current.progress.xp).toBe(10)
    expect(result.current.progress.reviewPool).toEqual({})
  })
})
