import {
  MAX_CONCURRENT,
  MODEL_ID,
  QUESTION_VERSION,
  STORAGE_KEYS,
} from '../shared/limits'
import { configHash } from '../shared/hash'
import {
  decide,
  excludedDecision,
  failedDecision,
  pendingDecision,
} from '../domain/classify'
import { isExcluded } from '../domain/exclusions'
import type { Decision, ValidAnswers } from '../domain/types'
import type { ClassifierProvider } from '../providers/provider'
import { createCache, type CacheEntry } from '../storage/cache'
import type { KeyValueStore } from '../storage/chrome-store'
import { createJobs, type JobRecord } from '../storage/jobs'
import {
  categoryMaterial,
  parseSettings,
  thresholdsOf,
  type Settings,
} from '../storage/settings'
import type { ClassifyRow } from '../shared/schemas'
import type { AnalyticsEvent } from './analytics'

export type TabStatus = {
  view: string
  eligible: number
  classified: number
  queued: number
  accountReady: boolean
}

export type SchedulerDeps = {
  recordAnalytics?: (event: AnalyticsEvent) => Promise<void>
  store: KeyValueStore
  now: () => number
  timeZone: () => string
  createProvider: (
    settings: Settings,
    apiKey: string | null,
    reserve: () => Promise<boolean>,
  ) => ClassifierProvider
  sendToTab: (tabId: number, message: unknown) => Promise<void>
  listTabIds: () => Promise<number[]>
}

export type UsageRecord = {
  day: string
  count: number
  inputTokens: number
  outputTokens: number
}

type RowResult = {
  threadId: string
  fingerprint: string
  decision: Decision
}

const dayOf = (time: number): string => {
  const date = new Date(time)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

const scopeOk = (value: string): boolean =>
  /^[a-f0-9]{64}$/.test(value) || /^ephemeral:[a-z0-9-]{8,40}$/.test(value)

export const evaluationKey = async (
  row: {
    accountScope: string
    threadId: string
  },
  hash: string,
): Promise<string> =>
  configHash([row.accountScope, row.threadId, hash, MODEL_ID, QUESTION_VERSION])

export const createScheduler = (deps: SchedulerDeps) => {
  const cache = createCache(deps.store, deps.now)
  const jobs = createJobs(deps.store, deps.now)
  const metadata = new Map<string, ClassifyRow>()
  const tabStatus = new Map<number, TabStatus>()
  let inFlight = 0
  let pumping = false
  let evaluations = 0
  let connectionTests = 0
  let usage: UsageRecord = {
    day: dayOf(deps.now()),
    count: 0,
    inputTokens: 0,
    outputTokens: 0,
  }
  let usageChain: Promise<void> = Promise.resolve()
  let usageReady: Promise<void> | null = null

  const loadSettings = async (): Promise<Settings> =>
    parseSettings(await deps.store.get(STORAGE_KEYS.settings))

  const ensureUsage = async (): Promise<void> => {
    if (!usageReady) {
      usageReady = (async () => {
        const stored = await deps.store.get<UsageRecord>(STORAGE_KEYS.usage)
        if (stored) usage = stored
      })()
    }
    await usageReady
  }

  const persistUsage = (): Promise<void> => {
    const run = usageChain.then(() =>
      deps.store.set(STORAGE_KEYS.usage, { ...usage }),
    )
    usageChain = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  const rollUsage = (): void => {
    const day = dayOf(deps.now())
    if (usage.day !== day)
      usage = { day, count: 0, inputTokens: 0, outputTokens: 0 }
  }

  const reserveAttempt = async (settings: Settings): Promise<boolean> => {
    await ensureUsage()
    rollUsage()
    if (usage.count >= settings.dailyLimit) return false
    usage.count += 1
    await persistUsage()
    return true
  }

  const addUsage = (inputTokens?: number, outputTokens?: number): void => {
    usage.inputTokens += inputTokens ?? 0
    usage.outputTokens += outputTokens ?? 0
    void persistUsage()
  }

  const broadcast = async (
    tabIds: number[],
    message: unknown,
  ): Promise<void> => {
    await Promise.all(
      tabIds.map((tabId) =>
        deps.sendToTab(tabId, message).catch(() => undefined),
      ),
    )
  }

  const decisionFor = (
    answers: ValidAnswers,
    settings: Settings,
    row: ClassifyRow,
  ): Decision => {
    const override = settings.overrides.find(
      (item) =>
        item.accountScope === row.accountScope &&
        item.threadId === row.threadId,
    )
    return decide(answers, thresholdsOf(settings), override ?? null)
  }

  const publish = async (job: JobRecord, decision: Decision): Promise<void> => {
    await broadcast(job.tabIds, {
      type: 'decision',
      accountScope: job.accountScope,
      threadId: job.threadId,
      fingerprint: job.fingerprint,
      configHash: job.configHash,
      decision,
    })
  }

  const runJob = async (job: JobRecord, row: ClassifyRow): Promise<void> => {
    try {
      await executeJob(job, row)
    } catch {
      await jobs.upsert({
        ...job,
        status: 'failed',
        detail: 'The request failed.',
        updatedAt: deps.now(),
        leaseUntil: 0,
      })
      await publish(job, failedDecision('The request failed.'))
      metadata.delete(job.id)
    }
  }

  const executeJob = async (
    job: JobRecord,
    row: ClassifyRow,
  ): Promise<void> => {
    const settings = await loadSettings()
    const hash = await configHash(categoryMaterial(settings))
    if (
      hash !== job.configHash ||
      settings.paused ||
      settings.authBlocked ||
      !settings.enabled
    ) {
      await jobs.remove(job.id)
      metadata.delete(job.id)
      return
    }
    const secret = await deps.store.get<{ apiKey: string }>(STORAGE_KEYS.secret)
    if (settings.providerMode === 'typesafe' && !secret?.apiKey) {
      await jobs.remove(job.id)
      await publish(
        job,
        failedDecision('Add an API key in settings before classifying mail.'),
      )
      return
    }
    const provider = deps.createProvider(settings, secret?.apiKey ?? null, () =>
      reserveAttempt(settings),
    )
    evaluations += 1
    const result = await provider.evaluate({
      threadId: row.threadId,
      email: row,
      categories: settings.categories,
      priorityContext: settings.priorityContext,
      evaluatedAt: new Date(deps.now()).toISOString(),
      timeZone: deps.timeZone(),
    })
    if (!result.ok) {
      if (result.kind === 'auth') {
        const next = {
          ...(await loadSettings()),
          authBlocked: true,
          paused: true,
        }
        await deps.store.set(STORAGE_KEYS.settings, next)
      }
      await jobs.upsert({
        ...job,
        status: 'failed',
        attempts: job.attempts + result.attempts,
        detail: result.message,
        updatedAt: deps.now(),
        leaseUntil: 0,
      })
      await publish(job, failedDecision(result.message))
      metadata.delete(job.id)
      return
    }
    addUsage(result.usage?.inputTokens, result.usage?.outputTokens)
    if (!row.accountScope.startsWith('ephemeral:')) {
      const entry: CacheEntry = {
        key: job.id,
        accountScope: row.accountScope,
        threadId: row.threadId,
        fingerprint: row.fingerprint,
        configHash: job.configHash,
        modelId: MODEL_ID,
        questionVersion: QUESTION_VERSION,
        savedAt: deps.now(),
        lastUsedAt: deps.now(),
        answers: result.answers,
      }
      await cache.put(entry)
    }
    const latest = await loadSettings()
    await jobs.remove(job.id)
    metadata.delete(job.id)
    const decision = decisionFor(result.answers, latest, row)
    if (
      settings.providerMode === 'typesafe' &&
      latest.enabled &&
      !latest.paused &&
      hash === (await configHash(categoryMaterial(latest))) &&
      decision.matchedCategoryIds.length > 0
    )
      void deps.recordAnalytics?.('labels_used')
    await publish(job, decision)
  }

  const pump = async (): Promise<void> => {
    if (pumping) return
    pumping = true
    try {
      while (inFlight < MAX_CONCURRENT) {
        const queued = (await jobs.list()).find(
          (job) => job.status === 'queued' && metadata.has(job.id),
        )
        if (!queued) break
        const row = metadata.get(queued.id)
        if (!row) break
        const leased: JobRecord = {
          ...queued,
          status: 'leased',
          leaseUntil: deps.now() + jobs.leaseMs,
          updatedAt: deps.now(),
        }
        await jobs.upsert(leased)
        inFlight += 1
        void runJob(leased, row).finally(() => {
          inFlight -= 1
          void pump()
        })
      }
    } finally {
      pumping = false
    }
  }

  const classifyBatch = async (
    rows: ClassifyRow[],
    tabId: number | undefined,
  ): Promise<
    | { ok: true; configHash: string; results: RowResult[] }
    | { ok: false; error: string }
  > => {
    const settings = await loadSettings()
    if (!settings.disclosureAcknowledged || !settings.enabled)
      return { ok: false, error: 'disabled' }
    const hash = await configHash(categoryMaterial(settings))
    const results: RowResult[] = []
    for (const row of rows) {
      if (!scopeOk(row.accountScope)) continue
      if (isExcluded(row.senderAddress, settings.exclusions)) {
        results.push({
          threadId: row.threadId,
          fingerprint: row.fingerprint,
          decision: excludedDecision(),
        })
        continue
      }
      const id = await evaluationKey(row, hash)
      const override = settings.overrides.find(
        (item) =>
          item.accountScope === row.accountScope &&
          item.threadId === row.threadId,
      )
      if (!row.accountScope.startsWith('ephemeral:')) {
        const cached = await cache.find(row.accountScope, row.threadId, hash)
        if (cached) {
          results.push({
            threadId: row.threadId,
            fingerprint: row.fingerprint,
            decision: decide(
              cached.answers,
              thresholdsOf(settings),
              override ?? null,
            ),
          })
          continue
        }
      }
      const existing = (await jobs.list()).find((job) => job.id === id)
      if (existing?.status === 'failed') {
        results.push({
          threadId: row.threadId,
          fingerprint: row.fingerprint,
          decision: failedDecision(existing.detail || 'Classification failed.'),
        })
        continue
      }
      if (settings.paused || settings.authBlocked) {
        results.push({
          threadId: row.threadId,
          fingerprint: row.fingerprint,
          decision: pendingDecision(
            settings.authBlocked
              ? 'Classification is paused until the API key is replaced.'
              : 'Classification is paused.',
          ),
        })
        continue
      }
      metadata.set(id, row)
      const tabIds = [
        ...new Set([
          ...(existing?.tabIds ?? []),
          ...(tabId == null ? [] : [tabId]),
        ]),
      ]
      if (existing?.status === 'leased' && existing.leaseUntil > deps.now()) {
        await jobs.upsert({ ...existing, tabIds })
      } else {
        await jobs.upsert({
          id,
          accountScope: row.accountScope,
          threadId: row.threadId,
          fingerprint: row.fingerprint,
          configHash: hash,
          status: 'queued',
          leaseUntil: 0,
          attempts: existing?.attempts ?? 0,
          tabIds,
          detail: '',
          updatedAt: deps.now(),
        })
      }
      results.push({
        threadId: row.threadId,
        fingerprint: row.fingerprint,
        decision: pendingDecision('Waiting to classify this loaded message.'),
      })
    }
    void pump()
    return { ok: true, configHash: hash, results }
  }

  return {
    classifyBatch,
    pump,
    tabStatus,
    recover: async (): Promise<void> => {
      await jobs.reclaimExpired()
      const tabIds = await deps.listTabIds()
      await broadcast(tabIds, { type: 'resubmit' })
    },
    retryFailed: async (
      accountScope: string,
      threadIds: string[],
    ): Promise<void> => {
      const current = await jobs.list()
      const next = current.filter(
        (job) =>
          !(
            job.accountScope === accountScope &&
            threadIds.includes(job.threadId) &&
            job.status === 'failed'
          ),
      )
      await jobs.save(next)
    },
    reserveAttempt,
    recordConnectionTest: (): void => {
      connectionTests += 1
    },
    stats: () => ({ evaluations, connectionTests, inFlight }),
    usage: async (): Promise<UsageRecord> => {
      await ensureUsage()
      rollUsage()
      return { ...usage }
    },
    clearWork: async (): Promise<void> => {
      metadata.clear()
      await jobs.save([])
      await cache.clear()
    },
    clearCache: async (): Promise<void> => {
      await cache.clear()
    },
  }
}
