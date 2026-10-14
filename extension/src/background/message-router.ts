import { configHash } from '../shared/hash'
import {
  dropCategoryFromOverrides,
  emptyOverride,
  overrideIsEmpty,
  setCategoryOverride,
  setCriticalOverride,
} from '../domain/overrides'
import { parseExclusion } from '../domain/exclusions'
import { STORAGE_KEYS } from '../shared/limits'
import {
  extensionMessageSchema,
  settingsSchema,
  type ExtensionMessage,
} from '../shared/schemas'
import { createSecrets } from '../storage/secrets'
import {
  categoryMaterial,
  parseSettings,
  type Settings,
} from '../storage/settings'
import { createScheduler, type SchedulerDeps } from './scheduler'

export type IncomingSender = {
  id?: string
  url?: string
  tabId?: number
}

export type RouterDeps = SchedulerDeps & {
  testBuild: boolean
  extensionId: string
  openOptions: () => Promise<void>
}

const EDITABLE = [
  'analyticsEnabled',
  'disclosureAcknowledged',
  'enabled',
  'paused',
  'providerMode',
  'categoryThreshold',
  'criticalThreshold',
  'reviewLower',
  'includeRead',
  'dailyLimit',
  'priorityContext',
  'views',
  'categories',
  'exclusions',
] as const

const pageSender = (sender: IncomingSender, deps: RouterDeps): boolean =>
  (sender.url ?? '').startsWith(`chrome-extension://${deps.extensionId}/`)

const contentSender = (sender: IncomingSender, deps: RouterDeps): boolean => {
  const url = sender.url ?? ''
  if (url.startsWith('https://mail.google.com/')) return true
  return deps.testBuild && url.startsWith('http://127.0.0.1:4173/')
}

const trusted = (sender: IncomingSender, deps: RouterDeps): boolean => {
  if (sender.id !== deps.extensionId) return false
  if (pageSender(sender, deps) || contentSender(sender, deps)) return true
  return sender.tabId == null && !sender.url
}

const normalizeExclusions = (
  settings: Settings,
): Settings | { error: string } => {
  const senders: string[] = []
  const domains: string[] = []
  for (const value of settings.exclusions.senders) {
    const parsed = parseExclusion(value)
    if ('error' in parsed || parsed.kind !== 'sender')
      return {
        error:
          parsed && 'error' in parsed
            ? parsed.error
            : 'Exclusions must be exact email addresses.',
      }
    senders.push(parsed.value)
  }
  for (const value of settings.exclusions.domains) {
    const parsed = parseExclusion(value.startsWith('@') ? value : `@${value}`)
    if ('error' in parsed || parsed.kind !== 'domain')
      return { error: 'Exclusions must be exact domains.' }
    domains.push(parsed.value)
  }
  return {
    ...settings,
    exclusions: {
      senders: [...new Set(senders)],
      domains: [...new Set(domains)],
    },
  }
}

export const createMessageRouter = (deps: RouterDeps) => {
  const scheduler = createScheduler(deps)
  const secrets = createSecrets(deps.store)

  const load = async (): Promise<Settings> =>
    parseSettings(await deps.store.get(STORAGE_KEYS.settings))
  const save = async (settings: Settings): Promise<void> => {
    await deps.store.set(STORAGE_KEYS.settings, settings)
  }
  const notify = async (): Promise<void> => {
    const tabIds = await deps.listTabIds()
    await Promise.all(
      tabIds.map((tabId) =>
        deps
          .sendToTab(tabId, { type: 'settingsChanged' })
          .catch(() => undefined),
      ),
    )
  }
  const snapshot = async (includeKeyMeta: boolean) => {
    const settings = await load()
    const secret = await secrets.get()
    return {
      ok: true as const,
      settings,
      hasKey: Boolean(secret),
      keySuffix: includeKeyMeta ? (secret?.suffix ?? null) : null,
      usage: await scheduler.usage(),
    }
  }

  const handle = async (
    message: ExtensionMessage,
    sender: IncomingSender,
  ): Promise<unknown> => {
    if (message.type === 'getSettings')
      return snapshot(pageSender(sender, deps))
    if (message.type === 'getPopupState') {
      const state = await snapshot(true)
      return {
        ...state,
        tab: scheduler.tabStatus.get(message.tabId) ?? null,
        authBlocked: state.settings.authBlocked,
      }
    }
    if (message.type === 'saveSettings') {
      const current = await load()
      const next: Settings = {
        ...current,
        overrides: current.overrides.map((override) => ({ ...override })),
      }
      for (const key of EDITABLE) {
        if (key in message.patch) {
          next[key] = message.patch[key] as never
        }
      }
      if (next.providerMode !== current.providerMode)
        next.connectionVerified = false
      const exclusions = normalizeExclusions(next)
      if ('error' in exclusions) return { ok: false, error: exclusions.error }
      const uniqueIds = new Set(
        exclusions.categories.map((category) => category.id),
      )
      if (uniqueIds.size !== exclusions.categories.length)
        return { ok: false, error: 'Category ids must be unique.' }
      if (
        exclusions.reviewLower >= exclusions.categoryThreshold ||
        exclusions.reviewLower >= exclusions.criticalThreshold
      ) {
        return {
          ok: false,
          error: 'The review boundary must sit below both thresholds.',
        }
      }
      let overrides = exclusions.overrides
      for (const category of current.categories) {
        if (!exclusions.categories.some((item) => item.id === category.id)) {
          overrides = dropCategoryFromOverrides(overrides, category.id)
        }
      }
      const stored = { ...exclusions, overrides }
      const parsed = settingsSchema.safeParse(stored)
      if (!parsed.success) return { ok: false, error: 'Settings are invalid.' }
      if (parsed.data.enabled) {
        if (!parsed.data.disclosureAcknowledged)
          return {
            ok: false,
            error: 'Acknowledge what leaves the browser before enabling.',
          }
        if (parsed.data.providerMode === 'typesafe') {
          const secret = await secrets.get()
          if (!secret) {
            return { ok: false, error: 'Save an API key before enabling.' }
          }
        }
      }
      const before = await configHash(categoryMaterial(current))
      const after = await configHash(categoryMaterial(parsed.data))
      await save(parsed.data)
      if (parsed.data.analyticsEnabled) {
        if (!current.analyticsEnabled)
          void deps.recordAnalytics?.('analytics_enabled')
        if (
          parsed.data.enabled &&
          !parsed.data.paused &&
          (!current.enabled || current.paused)
        )
          void deps.recordAnalytics?.('extension_enabled')
        if (
          parsed.data.categories.some(
            (category) =>
              !current.categories.some(
                (previous) => previous.id === category.id,
              ),
          )
        )
          void deps.recordAnalytics?.('category_created')
      }
      if (before !== after) await scheduler.clearCache()
      await notify()
      return snapshot(true)
    }
    if (message.type === 'saveKey') {
      await secrets.set(message.apiKey)
      const settings = await load()
      settings.connectionVerified = false
      settings.authBlocked = false
      settings.enabled = false
      await save(settings)
      await notify()
      return snapshot(true)
    }
    if (message.type === 'removeKey') {
      await secrets.clear()
      const settings = await load()
      settings.connectionVerified = false
      settings.authBlocked = false
      if (settings.providerMode === 'typesafe') settings.enabled = false
      await save(settings)
      await notify()
      return snapshot(true)
    }
    if (message.type === 'testConnection') {
      const settings = await load()
      const secret = await secrets.get()
      if (settings.providerMode === 'typesafe' && !secret)
        return { ok: false, error: 'Add an API key first.' }
      const result = await deps
        .createProvider(settings, secret?.apiKey ?? null, async () => true)
        .testConnection()
      scheduler.recordConnectionTest()
      if (!result.ok) {
        if (result.kind === 'auth') {
          settings.authBlocked = true
          await save(settings)
        }
        return { ok: false, error: result.message }
      }
      settings.connectionVerified = true
      settings.authBlocked = false
      await save(settings)
      await notify()
      return { ok: true, modelId: result.modelId }
    }
    if (message.type === 'clearCache') {
      const settings = await load()
      settings.paused = true
      await save(settings)
      await scheduler.clearWork()
      await notify()
      return {
        ok: true,
        detail:
          'Cached classifications were deleted and classification is paused.',
      }
    }
    if (message.type === 'resetOverrides') {
      const settings = await load()
      settings.overrides = []
      await save(settings)
      await notify()
      return { ok: true }
    }
    if (message.type === 'classifyBatch')
      return scheduler.classifyBatch(message.rows, sender.tabId)
    if (message.type === 'setOverride') {
      const settings = await load()
      const keep = settings.overrides.filter(
        (override) =>
          !(
            override.accountScope === message.accountScope &&
            override.threadId === message.threadId
          ),
      )
      if (!message.reset) {
        let current =
          settings.overrides.find(
            (override) =>
              override.accountScope === message.accountScope &&
              override.threadId === message.threadId,
          ) ?? emptyOverride(message.accountScope, message.threadId)
        if (message.categoryId && message.categoryMode) {
          current = setCategoryOverride(
            current,
            message.categoryId,
            message.categoryMode,
          )
        }
        if (message.critical !== undefined)
          current = setCriticalOverride(current, message.critical)
        if (!overrideIsEmpty(current)) keep.push(current)
      }
      settings.overrides = keep
      const parsed = settingsSchema.safeParse(settings)
      if (!parsed.success)
        return { ok: false, error: 'Could not save that correction.' }
      await save(parsed.data)
      return { ok: true }
    }
    if (message.type === 'retryFailed') {
      await scheduler.retryFailed(message.accountScope, message.threadIds)
      return { ok: true }
    }
    if (message.type === 'reportStatus') {
      if (sender.tabId != null)
        scheduler.tabStatus.set(sender.tabId, message.status)
      return { ok: true }
    }
    if (message.type === 'getDebugStats') {
      if (!deps.testBuild) return { ok: false, error: 'unavailable' }
      return { ok: true, ...scheduler.stats() }
    }
    if (message.type === 'setPaused') {
      const settings = await load()
      if (!settings.enabled) return { ok: false, error: 'disabled' }
      const resuming = settings.paused && !message.paused
      settings.paused = message.paused
      await save(settings)
      if (resuming && settings.analyticsEnabled)
        void deps.recordAnalytics?.('extension_enabled')
      await notify()
      return { ok: true, paused: settings.paused }
    }
    if (message.type === 'openOptions') {
      await deps.openOptions()
      return { ok: true }
    }
    return { ok: false, error: 'invalid message' }
  }

  return {
    handle: async (raw: unknown, sender: IncomingSender): Promise<unknown> => {
      if (!trusted(sender, deps)) return { ok: false, error: 'forbidden' }
      const parsed = extensionMessageSchema.safeParse(raw)
      if (!parsed.success) return { ok: false, error: 'invalid message' }
      const pageOnly = new Set([
        'saveSettings',
        'saveKey',
        'removeKey',
        'testConnection',
        'clearCache',
        'resetOverrides',
        'getPopupState',
      ])
      if (pageOnly.has(parsed.data.type) && !pageSender(sender, deps))
        return { ok: false, error: 'forbidden' }
      if (parsed.data.type === 'getDebugStats' && !deps.testBuild)
        return { ok: false, error: 'unavailable' }
      return handle(parsed.data, sender)
    },
    recover: () => scheduler.recover(),
  }
}
