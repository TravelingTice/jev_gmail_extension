import { createMessageRouter, type IncomingSender } from './message-router'
import { createChromeStore } from '../storage/chrome-store'
import { createMockProvider } from '../providers/mock'
import { createTypeSafeProvider } from '../providers/typesafe'
import type { Settings } from '../storage/settings'
import { createAnalytics } from './analytics'

const testBuild = import.meta.env.MODE === 'test'
const store = createChromeStore()
const mock = createMockProvider()
const recordAnalytics = createAnalytics(store, testBuild)

const router = createMessageRouter({
  store,
  recordAnalytics,
  now: () => Date.now(),
  timeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  testBuild,
  extensionId: chrome.runtime.id,
  createProvider: (_settings: Settings, apiKey, reserve) => {
    if (_settings.providerMode === 'fixture') return mock
    return createTypeSafeProvider({ apiKey: apiKey ?? '', onAttempt: reserve })
  },
  sendToTab: async (tabId, message) => {
    await chrome.tabs.sendMessage(tabId, message)
  },
  listTabIds: async () => {
    const patterns = [
      'https://mail.google.com/*',
      ...(testBuild ? ['http://127.0.0.1:4173/*'] : []),
    ]
    const tabs = await chrome.tabs.query({ url: patterns })
    return tabs.flatMap((tab) => (tab.id == null ? [] : [tab.id]))
  },
  openOptions: async () => {
    const url = chrome.runtime.getURL('options.html')
    const contexts = await chrome.runtime.getContexts({
      contextTypes: [chrome.runtime.ContextType.TAB],
      documentUrls: [url],
    })
    const existing = contexts.find((context) => context.tabId != null)
    if (existing?.tabId != null) {
      const tab = await chrome.tabs.update(existing.tabId, { active: true })
      if (tab?.windowId != null)
        await chrome.windows.update(tab.windowId, { focused: true })
      return
    }
    await chrome.tabs.create({ url })
  },
})

const senderOf = (sender: chrome.runtime.MessageSender): IncomingSender => ({
  id: sender.id,
  url: sender.url,
  tabId: sender.tab?.id,
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void router.handle(message, senderOf(sender)).then(sendResponse)
  return true
})

const boot = async (): Promise<void> => {
  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
  await chrome.alarms.create('gec-recover', { periodInMinutes: 1 })
  await router.recover()
}

chrome.runtime.onInstalled.addListener(() => {
  void boot()
})

chrome.runtime.onStartup.addListener(() => {
  void boot()
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'gec-recover') void router.recover()
})

void chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
