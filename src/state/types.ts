export interface ReviewEntry {
  questionId: string
  correctStreak: number
}

export interface ProgressState {
  xp: number
  completedLessons: string[]
  reviewPool: Record<string, ReviewEntry[]>
  perfectLessons: string[]
  lastActiveDate: string | null
  streak: number
  badges: string[]
}

export const INITIAL_PROGRESS: ProgressState = {
  xp: 0,
  completedLessons: [],
  reviewPool: {},
  perfectLessons: [],
  lastActiveDate: null,
  streak: 0,
  badges: [],
}
