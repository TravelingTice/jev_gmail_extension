export type KeyValueStore = {
  get: <T>(key: string) => Promise<T | undefined>
  set: (key: string, value: unknown) => Promise<void>
  remove: (key: string) => Promise<void>
}

export const createMemoryStore = (
  initial: Record<string, unknown> = {},
): KeyValueStore => {
  const data = new Map<string, unknown>(Object.entries(initial))
  return {
    get: async <T>(key: string) => {
      const value = data.get(key)
      return value === undefined ? undefined : (structuredClone(value) as T)
    },
    set: async (key, value) => {
      data.set(key, structuredClone(value))
    },
    remove: async (key) => {
      data.delete(key)
    },
  }
}

export const createChromeStore = (): KeyValueStore => ({
  get: async <T>(key: string) => {
    const stored = await chrome.storage.local.get(key)
    return stored[key] as T | undefined
  },
  set: async (key, value) => {
    await chrome.storage.local.set({ [key]: value })
  },
  remove: async (key) => {
    await chrome.storage.local.remove(key)
  },
})
