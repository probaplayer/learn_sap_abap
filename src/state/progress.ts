import type { ProgressState } from './types'

export const XP_CORRECT_ANSWER = 10
export const XP_REVIEW_CORRECT_ANSWER = 5
export const XP_LESSON_FIRST_COMPLETE_BONUS = 20
export const XP_PRACTICE_CORRECT_ANSWER = 10
export const REVIEW_MASTERY_STREAK = 2
export const STREAK_BADGE_THRESHOLDS = [7, 30] as const

export function lessonKey(moduleId: string, lessonId: string): string {
  return `${moduleId}:${lessonId}`
}

export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1
}

export function isLessonUnlocked(
  state: ProgressState,
  moduleId: string,
  lessonIdsInOrder: string[],
  lessonId: string,
): boolean {
  const idx = lessonIdsInOrder.indexOf(lessonId)
  if (idx <= 0) return true
  const prevKey = lessonKey(moduleId, lessonIdsInOrder[idx - 1])
  return state.completedLessons.includes(prevKey)
}

export function getReviewQuestionIds(state: ProgressState, moduleId: string): string[] {
  return (state.reviewPool[moduleId] ?? []).map((e) => e.questionId)
}

export interface RecordAnswerParams {
  moduleId: string
  questionId: string
  correct: boolean
  isReview: boolean
}

export interface RecordAnswerResult {
  state: ProgressState
  xpGained: number
}

/**
 * Wrong answers join the module's review pool at streak 0.
 * Correct answers while reviewing increment the streak; reaching
 * REVIEW_MASTERY_STREAK removes the question from the pool.
 */
export function recordAnswer(state: ProgressState, params: RecordAnswerParams): RecordAnswerResult {
  const { moduleId, questionId, correct, isReview } = params
  const pool = state.reviewPool[moduleId] ?? []
  let nextPool = pool
  let xpGained = 0

  if (correct) {
    xpGained = isReview ? XP_REVIEW_CORRECT_ANSWER : XP_CORRECT_ANSWER
    if (isReview) {
      nextPool = pool
        .map((e) => (e.questionId === questionId ? { ...e, correctStreak: e.correctStreak + 1 } : e))
        .filter((e) => e.questionId !== questionId || e.correctStreak < REVIEW_MASTERY_STREAK)
    }
  } else {
    const existing = pool.find((e) => e.questionId === questionId)
    nextPool = existing
      ? pool.map((e) => (e.questionId === questionId ? { ...e, correctStreak: 0 } : e))
      : [...pool, { questionId, correctStreak: 0 }]
  }

  return {
    state: {
      ...state,
      xp: state.xp + xpGained,
      reviewPool: { ...state.reviewPool, [moduleId]: nextPool },
    },
    xpGained,
  }
}

export interface RecordPracticeAnswerParams {
  correct: boolean
}

export interface RecordPracticeAnswerResult {
  state: ProgressState
  xpGained: number
}

/**
 * XP-only counterpart to recordAnswer for ad hoc generated practice sets.
 * Deliberately does not touch reviewPool: that pool is looked up by
 * questionId through findQuestion(), which only searches the module's fixed
 * lesson content, not content/generated/** — mixing generated-question ids
 * into reviewPool would make them silently vanish from future review.
 */
export function recordPracticeAnswer(
  state: ProgressState,
  params: RecordPracticeAnswerParams,
): RecordPracticeAnswerResult {
  const xpGained = params.correct ? XP_PRACTICE_CORRECT_ANSWER : 0
  return {
    state: { ...state, xp: state.xp + xpGained },
    xpGained,
  }
}

export function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** A day is "missed" unless the lesson streak was already updated today or yesterday. */
export function updateStreak(state: ProgressState, today: Date): ProgressState {
  const todayStr = toDateString(today)
  if (state.lastActiveDate === todayStr) return state

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = toDateString(yesterday)

  const nextStreak = state.lastActiveDate === yesterdayStr ? state.streak + 1 : 1
  return { ...state, streak: nextStreak, lastActiveDate: todayStr }
}

export function computeEarnedBadges(
  state: ProgressState,
  lessonsByModule: Record<string, string[]>,
): string[] {
  const badges = new Set(state.badges)

  for (const [moduleId, lessonIds] of Object.entries(lessonsByModule)) {
    if (lessonIds.length === 0) continue
    const allDone = lessonIds.every((id) => state.completedLessons.includes(lessonKey(moduleId, id)))
    if (allDone) badges.add(`module-complete:${moduleId}`)
  }

  for (const lid of state.perfectLessons) {
    badges.add(`perfect-lesson:${lid}`)
  }

  for (const threshold of STREAK_BADGE_THRESHOLDS) {
    if (state.streak >= threshold) badges.add(`streak-${threshold}`)
  }

  return Array.from(badges)
}

export interface CompleteLessonParams {
  moduleId: string
  lessonId: string
  mistakeCount: number
  lessonsByModule: Record<string, string[]>
  today?: Date
}

export interface CompleteLessonResult {
  state: ProgressState
  isFirstCompletion: boolean
  bonusXp: number
  newlyEarnedBadges: string[]
}

export function completeLesson(state: ProgressState, params: CompleteLessonParams): CompleteLessonResult {
  const { moduleId, lessonId, mistakeCount, lessonsByModule, today = new Date() } = params
  const key = lessonKey(moduleId, lessonId)
  const isFirstCompletion = !state.completedLessons.includes(key)
  const bonusXp = isFirstCompletion ? XP_LESSON_FIRST_COMPLETE_BONUS : 0

  let next: ProgressState = {
    ...state,
    xp: state.xp + bonusXp,
    completedLessons: isFirstCompletion ? [...state.completedLessons, key] : state.completedLessons,
    perfectLessons:
      mistakeCount === 0 && !state.perfectLessons.includes(key)
        ? [...state.perfectLessons, key]
        : state.perfectLessons,
  }

  next = updateStreak(next, today)

  const badgesBefore = new Set(next.badges)
  const allBadges = computeEarnedBadges(next, lessonsByModule)
  const newlyEarnedBadges = allBadges.filter((b) => !badgesBefore.has(b))
  next = { ...next, badges: allBadges }

  return { state: next, isFirstCompletion, bonusXp, newlyEarnedBadges }
}
