import {
  CACHE_BYTE_BUDGET,
  CACHE_MAX_ENTRIES,
  CACHE_TTL_MS,
  STORAGE_KEYS,
} from '../shared/limits'
import type { ValidAnswers } from '../domain/types'
import type { KeyValueStore } from './chrome-store'

export type CacheEntry = {
  key: string
  accountScope: string
  threadId: string
  fingerprint: string
  configHash: string
  modelId: string
  questionVersion: number
  savedAt: number
  lastUsedAt: number
  answers: ValidAnswers
}

type CacheBlob = { entries: CacheEntry[] }

const byteLength = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value)).length

const load = async (store: KeyValueStore): Promise<CacheEntry[]> => {
  const blob = await store.get<CacheBlob>(STORAGE_KEYS.cache)
  return blob?.entries ?? []
}

const evict = (entries: CacheEntry[]): CacheEntry[] => {
  const fresh = [...entries].sort(
    (left, right) => right.lastUsedAt - left.lastUsedAt,
  )
  const kept: CacheEntry[] = []
  for (const entry of fresh) {
    if (kept.length >= CACHE_MAX_ENTRIES) break
    const next = [...kept, entry]
    if (byteLength({ entries: next }) > CACHE_BYTE_BUDGET) break
    kept.push(entry)
  }
  return kept
}

export const createCache = (store: KeyValueStore, now: () => number) => ({
  get: async (key: string): Promise<CacheEntry | null> => {
    const entries = await load(store)
    const found = entries.find((entry) => entry.key === key)
    if (!found || now() - found.savedAt > CACHE_TTL_MS) return null
    return found
  },
  find: async (
    accountScope: string,
    threadId: string,
    configHash: string,
  ): Promise<CacheEntry | null> => {
    const entries = await load(store)
    const found = entries.find(
      (entry) =>
        entry.accountScope === accountScope &&
        entry.threadId === threadId &&
        entry.configHash === configHash,
    )
    if (!found || now() - found.savedAt > CACHE_TTL_MS) return null
    return found
  },
  put: async (entry: CacheEntry): Promise<void> => {
    const entries = (await load(store)).filter((item) => item.key !== entry.key)
    entries.push(entry)
    await store.set(STORAGE_KEYS.cache, { entries: evict(entries) })
  },
  clear: async (): Promise<void> => {
    await store.remove(STORAGE_KEYS.cache)
  },
})
