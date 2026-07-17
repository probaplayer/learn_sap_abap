import { INITIAL_PROGRESS, type ProgressState } from './types'

const STORAGE_KEY = 'sap-quest:progress:v1'

export function isStorageAvailable(): boolean {
  try {
    const testKey = '__sap_quest_storage_test__'
    window.localStorage.setItem(testKey, '1')
    window.localStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}

export function loadProgress(): ProgressState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...INITIAL_PROGRESS }
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return { ...INITIAL_PROGRESS }
    return { ...INITIAL_PROGRESS, ...parsed }
  } catch {
    return { ...INITIAL_PROGRESS }
  }
}

export function saveProgress(state: ProgressState): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}
