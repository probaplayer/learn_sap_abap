import { describe, expect, it } from 'vitest'
import { INITIAL_PROGRESS } from './types'
import {
  completeLesson,
  isLessonUnlocked,
  levelForXp,
  recordAnswer,
  recordPracticeAnswer,
  updateStreak,
} from './progress'

describe('levelForXp', () => {
  it('starts at level 1 with 0 xp', () => {
    expect(levelForXp(0)).toBe(1)
  })

  it('increases as xp grows', () => {
    expect(levelForXp(50)).toBe(2)
    expect(levelForXp(200)).toBe(3)
  })

  it('clamps negative xp to level 1', () => {
    expect(levelForXp(-100)).toBe(1)
  })
})

describe('isLessonUnlocked', () => {
  const order = ['basic', 'intermediate', 'advanced']

  it('always unlocks the first lesson', () => {
    expect(isLessonUnlocked(INITIAL_PROGRESS, 'mm', order, 'basic')).toBe(true)
  })

  it('locks the next lesson until the previous one is completed', () => {
    expect(isLessonUnlocked(INITIAL_PROGRESS, 'mm', order, 'intermediate')).toBe(false)

    const withBasicDone = { ...INITIAL_PROGRESS, completedLessons: ['mm:basic'] }
    expect(isLessonUnlocked(withBasicDone, 'mm', order, 'intermediate')).toBe(true)
    expect(isLessonUnlocked(withBasicDone, 'mm', order, 'advanced')).toBe(false)
  })
})

describe('recordAnswer', () => {
  it('awards 10 xp for a correct non-review answer and leaves the pool untouched', () => {
    const { state, xpGained } = recordAnswer(INITIAL_PROGRESS, {
      moduleId: 'mm',
      questionId: 'q1',
      correct: true,
      isReview: false,
    })
    expect(xpGained).toBe(10)
    expect(state.reviewPool.mm ?? []).toEqual([])
  })

  it('adds a wrong answer to the review pool at streak 0', () => {
    const { state, xpGained } = recordAnswer(INITIAL_PROGRESS, {
      moduleId: 'mm',
      questionId: 'q1',
      correct: false,
      isReview: false,
    })
    expect(xpGained).toBe(0)
    expect(state.reviewPool.mm).toEqual([{ questionId: 'q1', correctStreak: 0 }])
  })

  it('increments the review streak on correct review answers and evicts at streak 2', () => {
    let state = INITIAL_PROGRESS
    ;({ state } = recordAnswer(state, { moduleId: 'mm', questionId: 'q1', correct: false, isReview: false }))

    const first = recordAnswer(state, { moduleId: 'mm', questionId: 'q1', correct: true, isReview: true })
    expect(first.xpGained).toBe(5)
    expect(first.state.reviewPool.mm).toEqual([{ questionId: 'q1', correctStreak: 1 }])

    const second = recordAnswer(first.state, { moduleId: 'mm', questionId: 'q1', correct: true, isReview: true })
    expect(second.state.reviewPool.mm).toEqual([])
  })

  it('resets the review streak to 0 on a wrong answer while reviewing', () => {
    let state = INITIAL_PROGRESS
    ;({ state } = recordAnswer(state, { moduleId: 'mm', questionId: 'q1', correct: false, isReview: false }))
    ;({ state } = recordAnswer(state, { moduleId: 'mm', questionId: 'q1', correct: true, isReview: true }))
    const result = recordAnswer(state, { moduleId: 'mm', questionId: 'q1', correct: false, isReview: true })
    expect(result.state.reviewPool.mm).toEqual([{ questionId: 'q1', correctStreak: 0 }])
  })
})

describe('updateStreak', () => {
  it('sets streak to 1 on first ever activity', () => {
    const result = updateStreak(INITIAL_PROGRESS, new Date('2026-07-17T10:00:00'))
    expect(result.streak).toBe(1)
    expect(result.lastActiveDate).toBe('2026-07-17')
  })

  it('does not change streak twice on the same day', () => {
    const day1 = updateStreak(INITIAL_PROGRESS, new Date('2026-07-17T10:00:00'))
    const sameDay = updateStreak(day1, new Date('2026-07-17T20:00:00'))
    expect(sameDay.streak).toBe(1)
  })

  it('increments streak on a consecutive day', () => {
    const day1 = updateStreak(INITIAL_PROGRESS, new Date('2026-07-17T10:00:00'))
    const day2 = updateStreak(day1, new Date('2026-07-18T09:00:00'))
    expect(day2.streak).toBe(2)
  })

  it('resets streak to 1 after a missed day', () => {
    const day1 = updateStreak(INITIAL_PROGRESS, new Date('2026-07-17T10:00:00'))
    const day3 = updateStreak(day1, new Date('2026-07-19T09:00:00'))
    expect(day3.streak).toBe(1)
  })
})

describe('completeLesson', () => {
  const lessonsByModule = {
    mm: ['basic', 'intermediate', 'advanced'],
  }

  it('awards a first-completion bonus and marks the lesson done', () => {
    const result = completeLesson(INITIAL_PROGRESS, {
      moduleId: 'mm',
      lessonId: 'basic',
      mistakeCount: 1,
      lessonsByModule,
      today: new Date('2026-07-17T10:00:00'),
    })
    expect(result.isFirstCompletion).toBe(true)
    expect(result.bonusXp).toBe(20)
    expect(result.state.completedLessons).toContain('mm:basic')
    expect(result.state.perfectLessons).toEqual([])
  })

  it('does not award a bonus or duplicate on repeat completion', () => {
    const first = completeLesson(INITIAL_PROGRESS, {
      moduleId: 'mm',
      lessonId: 'basic',
      mistakeCount: 0,
      lessonsByModule,
      today: new Date('2026-07-17T10:00:00'),
    })
    const second = completeLesson(first.state, {
      moduleId: 'mm',
      lessonId: 'basic',
      mistakeCount: 2,
      lessonsByModule,
      today: new Date('2026-07-18T10:00:00'),
    })
    expect(second.isFirstCompletion).toBe(false)
    expect(second.bonusXp).toBe(0)
    expect(second.state.completedLessons.filter((k) => k === 'mm:basic')).toHaveLength(1)
  })

  it('records a perfect-lesson badge when there are no mistakes', () => {
    const result = completeLesson(INITIAL_PROGRESS, {
      moduleId: 'mm',
      lessonId: 'basic',
      mistakeCount: 0,
      lessonsByModule,
      today: new Date('2026-07-17T10:00:00'),
    })
    expect(result.state.perfectLessons).toContain('mm:basic')
    expect(result.newlyEarnedBadges).toContain('perfect-lesson:mm:basic')
  })

  it('awards a module-complete badge once every lesson in the module is done', () => {
    let state = INITIAL_PROGRESS
    const complete = (lessonId: string) => {
      const r = completeLesson(state, {
        moduleId: 'mm',
        lessonId,
        mistakeCount: 3,
        lessonsByModule,
        today: new Date('2026-07-17T10:00:00'),
      })
      state = r.state
      return r
    }

    complete('basic')
    complete('intermediate')
    const allDone = complete('advanced')
    expect(allDone.newlyEarnedBadges).toContain('module-complete:mm')
  })
})

describe('recordPracticeAnswer', () => {
  it('adds XP on a correct answer without touching reviewPool/completedLessons/perfectLessons/badges', () => {
    const result = recordPracticeAnswer(INITIAL_PROGRESS, { correct: true })
    expect(result.xpGained).toBe(10)
    expect(result.state.xp).toBe(10)
    expect(result.state.reviewPool).toEqual({})
    expect(result.state.completedLessons).toEqual([])
    expect(result.state.perfectLessons).toEqual([])
    expect(result.state.badges).toEqual([])
  })

  it('adds no XP on a wrong answer and does not add the question to reviewPool', () => {
    const result = recordPracticeAnswer(INITIAL_PROGRESS, { correct: false })
    expect(result.xpGained).toBe(0)
    expect(result.state.xp).toBe(0)
    expect(result.state.reviewPool).toEqual({})
  })
})
