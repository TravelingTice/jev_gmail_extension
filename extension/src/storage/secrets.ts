import { STORAGE_KEYS } from '../shared/limits'
import type { KeyValueStore } from './chrome-store'

export type SecretRecord = {
  apiKey: string
  suffix: string
}

export const keySuffix = (apiKey: string): string => apiKey.slice(-4)

export const createSecrets = (store: KeyValueStore) => ({
  get: async (): Promise<SecretRecord | null> => {
    const record = await store.get<SecretRecord>(STORAGE_KEYS.secret)
    if (!record?.apiKey) return null
    return record
  },
  set: async (apiKey: string): Promise<void> => {
    await store.set(STORAGE_KEYS.secret, { apiKey, suffix: keySuffix(apiKey) })
  },
  clear: async (): Promise<void> => {
    await store.remove(STORAGE_KEYS.secret)
  },
})
