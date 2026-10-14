import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAnalytics } from '../src/background/analytics'
import { createMemoryStore } from '../src/storage/chrome-store'
import { defaultSettings, parseSettings } from '../src/storage/settings'
import { STORAGE_KEYS } from '../src/shared/limits'
import { createMessageRouter } from '../src/background/message-router'
import { createMockProvider } from '../src/providers/mock'
import { createScheduler } from '../src/background/scheduler'

test('analytics is off for existing installs, default settings and fixtures', async () => {
  const defaults = defaultSettings()
  assert.equal(defaults.analyticsEnabled, false)
  const { analyticsEnabled: _unused, ...legacy } = defaults
  assert.equal(parseSettings(legacy).analyticsEnabled, false)
  let sent = 0
  const transport = (async () => {
    sent += 1
    return new Response()
  }) as typeof fetch
  const store = createMemoryStore({ [STORAGE_KEYS.settings]: defaults })
  await createAnalytics(store, false, transport)('labels_used')
  await store.set(STORAGE_KEYS.settings, {
    ...defaults,
    analyticsEnabled: true,
    providerMode: 'fixture',
  })
  await createAnalytics(store, false, transport)('labels_used')
  await store.set(STORAGE_KEYS.settings, {
    ...defaults,
    analyticsEnabled: true,
  })
  await createAnalytics(store, true, transport)('labels_used')
  assert.equal(sent, 0)
})

test('only fixed events leave the browser; daily markers survive worker restarts', async () => {
  const store = createMemoryStore({
    [STORAGE_KEYS.settings]: { ...defaultSettings(), analyticsEnabled: true },
  })
  const bodies: unknown[] = []
  const transport = (async (_url, options) => {
    assert.equal(options?.credentials, 'omit')
    assert.equal(options?.referrerPolicy, 'no-referrer')
    bodies.push(JSON.parse(String(options?.body)))
    return new Response()
  }) as typeof fetch
  let now = Date.parse('2026-10-12T20:00:00Z')
  const reporter = createAnalytics(store, false, transport, () => now)
  await Promise.all([
    reporter('labels_used'),
    reporter('labels_used'),
    reporter('analytics_enabled'),
    reporter('analytics_enabled'),
  ])
  assert.deepEqual(bodies, [
    { source: 'extension', event: 'labels_used' },
    { source: 'extension', event: 'analytics_enabled' },
  ])
  const restarted = createAnalytics(store, false, transport, () => now)
  await restarted('labels_used')
  await restarted('analytics_enabled')
  assert.equal(bodies.length, 2)
  now += 86400000
  await restarted('labels_used')
  assert.equal(bodies.length, 3)
  await store.set(STORAGE_KEYS.settings, defaultSettings())
  await restarted('category_created')
  assert.equal(bodies.length, 3)
})

test('analytics failures never fail classification callers or queue retries', async () => {
  const store = createMemoryStore({
    [STORAGE_KEYS.settings]: { ...defaultSettings(), analyticsEnabled: true },
  })
  let calls = 0
  const transport = (async () => {
    calls += 1
    throw new Error('offline')
  }) as typeof fetch
  const reporter = createAnalytics(store, false, transport)
  await reporter('labels_used')
  await reporter('labels_used')
  assert.equal(calls, 1)
})

test('settings report category additions and activation transitions only after successful saves', async () => {
  const store = createMemoryStore({
    [STORAGE_KEYS.settings]: {
      ...defaultSettings(),
      analyticsEnabled: true,
      enabled: true,
      disclosureAcknowledged: true,
    },
    [STORAGE_KEYS.secret]: { apiKey: 'synthetic-key' },
  })
  const events: string[] = []
  const router = createMessageRouter({
    store,
    testBuild: true,
    extensionId: 'test',
    now: Date.now,
    timeZone: () => 'UTC',
    createProvider: () => createMockProvider(),
    sendToTab: async () => {},
    listTabIds: async () => [],
    openOptions: async () => {},
    recordAnalytics: async (event) => {
      events.push(event)
    },
  })
  const sender = { id: 'test', url: 'chrome-extension://test/options.html' }
  const categories = [
    ...defaultSettings().categories,
    {
      id: 'new_category',
      name: 'Private category name',
      description: 'Private category description',
      color: '#38634d',
      enabled: true,
    },
  ]
  await router.handle({ type: 'saveSettings', patch: { categories } }, sender)
  await router.handle(
    { type: 'saveSettings', patch: { categoryThreshold: 0.75 } },
    sender,
  )
  await router.handle({ type: 'setPaused', paused: true }, sender)
  await router.handle({ type: 'setPaused', paused: false }, sender)
  await router.handle({ type: 'setPaused', paused: false }, sender)
  assert.deepEqual(events, ['category_created', 'extension_enabled'])
})

test('fresh matched classifications report label use; failures, cache hits and fixture mode do not', async () => {
  for (const [subject, providerMode, expected] of [
    ['Invoice due today', 'typesafe', 1],
    ['[error] invoice', 'typesafe', 0],
    ['Invoice due today', 'fixture', 0],
  ] as const) {
    const store = createMemoryStore({
      [STORAGE_KEYS.settings]: {
        ...defaultSettings(),
        analyticsEnabled: true,
        enabled: true,
        disclosureAcknowledged: true,
        providerMode,
      },
      [STORAGE_KEYS.secret]: { apiKey: 'synthetic-key' },
    })
    const events: string[] = []
    const scheduler = createScheduler({
      store,
      now: Date.now,
      timeZone: () => 'UTC',
      createProvider: () => createMockProvider(),
      sendToTab: async () => {},
      listTabIds: async () => [],
      recordAnalytics: async (event) => {
        events.push(event)
      },
    })
    const rows = [
      {
        threadId: 'synthetic-thread',
        accountScope: 'a'.repeat(64),
        fingerprint: 'b'.repeat(64),
        senderName: null,
        senderAddress: null,
        subject,
        snippet: null,
        dateLabel: null,
        listIndex: 0,
        unread: true,
        threadUrl: null,
      },
    ]
    await scheduler.classifyBatch(rows, 1)
    for (let i = 0; i < 100; i++) {
      const jobs = await store.get<unknown[]>(STORAGE_KEYS.jobs)
      if (
        scheduler.stats().evaluations > 0 &&
        scheduler.stats().inFlight === 0 &&
        jobs
      )
        break
      await new Promise((resolve) => setTimeout(resolve, 5))
    }
    assert.equal(events.length, expected)
    await scheduler.classifyBatch(rows, 1)
    await new Promise((resolve) => setTimeout(resolve, 20))
    assert.equal(events.length, expected)
  }
})
