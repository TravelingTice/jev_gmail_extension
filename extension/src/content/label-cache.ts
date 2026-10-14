import type { Decision } from '../domain/types'

const STORAGE_KEY = 'gec.classifications'
const MAX_ENTRIES = 2000

type SavedClassification = {
  accountScope: string
  threadId: string
  configHash: string
  savedAt: number
  decision: Decision
}

const finished = (decision: Decision): boolean =>
  decision.status !== 'pending' && decision.status !== 'failed'

const readEntries = (): SavedClassification[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { entries?: SavedClassification[] }
    return Array.isArray(parsed.entries) ? parsed.entries : []
  } catch {
    return []
  }
}

const writeEntries = (entries: SavedClassification[]): void => {
  const kept = [...entries]
    .sort((left, right) => right.savedAt - left.savedAt)
    .slice(0, MAX_ENTRIES)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ entries: kept }))
  } catch {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ entries: kept.slice(0, Math.floor(MAX_ENTRIES / 4)) }),
      )
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }
}

export const savedClassifications = (
  accountScope: string,
  configHash: string,
): Map<string, Decision> => {
  const found = new Map<string, Decision>()
  if (!configHash || accountScope.startsWith('ephemeral:')) return found
  for (const entry of readEntries()) {
    if (
      entry.accountScope !== accountScope ||
      entry.configHash !== configHash ||
      !entry.decision ||
      !finished(entry.decision)
    ) {
      continue
    }
    found.set(entry.threadId, entry.decision)
  }
  return found
}

export const saveClassification = (
  accountScope: string,
  threadId: string,
  configHash: string,
  decision: Decision,
): void => {
  if (
    !configHash ||
    accountScope.startsWith('ephemeral:') ||
    !finished(decision)
  ) {
    return
  }
  const entries = readEntries().filter(
    (entry) =>
      !(
        entry.accountScope === accountScope &&
        entry.threadId === threadId &&
        entry.configHash === configHash
      ),
  )
  entries.push({
    accountScope,
    threadId,
    configHash,
    savedAt: Date.now(),
    decision,
  })
  writeEntries(entries)
}
