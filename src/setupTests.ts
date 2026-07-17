import '@testing-library/jest-dom'

// jsdom's own localStorage is shadowed by Node's experimental global
// `localStorage` in this environment, which throws unless run with
// --localstorage-file. Replace it with a plain in-memory polyfill so
// state/storage.ts (and anything relying on window.localStorage) behaves
// the same in tests as it does in a real browser.
if (typeof window !== 'undefined') {
  class MemoryStorage implements Storage {
    private store = new Map<string, string>()
    get length() {
      return this.store.size
    }
    clear(): void {
      this.store.clear()
    }
    getItem(key: string): string | null {
      return this.store.has(key) ? this.store.get(key)! : null
    }
    key(index: number): string | null {
      return Array.from(this.store.keys())[index] ?? null
    }
    removeItem(key: string): void {
      this.store.delete(key)
    }
    setItem(key: string, value: string): void {
      this.store.set(key, String(value))
    }
  }

  Object.defineProperty(window, 'localStorage', {
    value: new MemoryStorage(),
    writable: true,
    configurable: true,
  })
}
