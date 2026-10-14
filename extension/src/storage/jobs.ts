import { LEASE_MS, MAX_JOBS, STORAGE_KEYS } from '../shared/limits'
import type { KeyValueStore } from './chrome-store'

export type JobStatus = 'queued' | 'leased' | 'failed'

export type JobRecord = {
  id: string
  accountScope: string
  threadId: string
  fingerprint: string
  configHash: string
  status: JobStatus
  leaseUntil: number
  attempts: number
  tabIds: number[]
  detail: string
  updatedAt: number
}

type JobBlob = { jobs: JobRecord[] }

export const createJobs = (store: KeyValueStore, now: () => number) => {
  const load = async (): Promise<JobRecord[]> => {
    const blob = await store.get<JobBlob>(STORAGE_KEYS.jobs)
    return blob?.jobs ?? []
  }
  const save = async (jobs: JobRecord[]): Promise<void> => {
    const trimmed = [...jobs]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_JOBS)
    await store.set(STORAGE_KEYS.jobs, { jobs: trimmed })
  }
  return {
    list: load,
    save,
    upsert: async (job: JobRecord): Promise<void> => {
      const jobs = (await load()).filter((item) => item.id !== job.id)
      jobs.push(job)
      await save(jobs)
    },
    remove: async (id: string): Promise<void> => {
      await save((await load()).filter((job) => job.id !== id))
    },
    reclaimExpired: async (): Promise<JobRecord[]> => {
      const current = now()
      const jobs = await load()
      const reclaimed = jobs.map((job) =>
        job.status === 'leased' && job.leaseUntil <= current
          ? {
              ...job,
              status: 'queued' as const,
              leaseUntil: 0,
              updatedAt: current,
            }
          : job,
      )
      await save(reclaimed)
      return reclaimed.filter((job) => job.status === 'queued')
    },
    leaseMs: LEASE_MS,
  }
}
