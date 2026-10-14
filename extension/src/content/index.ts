import cssText from '../ui/styles/app.css?inline'
import { loadBrandFont } from '../shared/brand-font'

loadBrandFont()
import { MAX_BATCH } from '../shared/limits'
import {
  configHash as hashConfig,
  fingerprintMetadata,
  sha256Hex,
} from '../shared/hash'
import { categoryMaterial } from '../shared/category-material'
import type { Decision } from '../domain/types'
import type { Settings } from '../shared/schemas'
import {
  chipMount,
  classifyHash,
  extractRows,
  findList,
  readAccountEmail,
  selectedTabLabel,
  viewIsEnabled,
  type ExtractedRow,
} from './gmail-adapter'
import { ensureBar, renderBar } from './mount-panel'
import { watchList } from './observer'
import { removeChips, syncChip } from './row-chips'
import { saveClassification, savedClassifications } from './label-cache'

type StoredRow = ExtractedRow & {
  fingerprint: string
  decision?: Decision
}

const call = <T>(message: unknown): Promise<T> =>
  chrome.runtime.sendMessage(message) as Promise<T>

const themeOf = (doc: Document): 'light' | 'dark' => {
  const color =
    doc.defaultView?.getComputedStyle(doc.body).backgroundColor ?? ''
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!match)
    return doc.defaultView?.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  const luminance =
    (0.2126 * Number(match[1]) +
      0.7152 * Number(match[2]) +
      0.0722 * Number(match[3])) /
    255
  return luminance < 0.45 ? 'dark' : 'light'
}

export const startContent = (): void => {
  if (document.documentElement.dataset.gecStarted === '1') return
  document.documentElement.dataset.gecStarted = '1'
  let generation = 0
  let settings: Settings | null = null
  let accountScope = ''
  let configHash = ''
  let rows = new Map<string, StoredRow>()
  let stopWatch = () => {}
  let ephemeral = ''
  let loadFailed = false
  let busy = false
  let retryTimer = 0

  const ephemeralScope = (): string => {
    if (!ephemeral) ephemeral = `ephemeral:${crypto.randomUUID()}`
    return ephemeral
  }

  const classifiable = (): boolean =>
    Boolean(
      settings?.enabled &&
      settings.disclosureAcknowledged &&
      !settings.authBlocked,
    )

  const showLoader = (): boolean =>
    classifiable() && !settings?.paused && !loadFailed

  const unfinished = (): boolean =>
    [...rows.values()].some(
      (row) => !row.decision || row.decision.status === 'pending',
    )

  const scheduleRetry = (): void => {
    window.clearTimeout(retryTimer)
    retryTimer = window.setTimeout(() => {
      void scan()
    }, 400)
  }

  const paint = (): void => {
    const app = ensureBar()
    const eligible = rows.size
    const classified = [...rows.values()].filter(
      (row) => row.decision && row.decision.status !== 'pending',
    ).length
    const queued = [...rows.values()].filter(
      (row) => row.decision?.status === 'pending',
    ).length
    const enabled = Boolean(settings?.enabled && !settings.paused)
    renderBar(app, cssText, {
      theme: themeOf(document),
      enabled,
      loading: busy,
      onSettings: () => {
        void call({ type: 'openOptions' })
      },
    })
    const active = settings
    for (const row of rows.values()) {
      const mount = chipMount(row.row)
      if (!mount || !row.decision || !active) continue
      const names = row.decision.matchedCategoryIds.map((id) => {
        const category = active.categories.find((item) => item.id === id)
        return {
          id,
          name: category?.name ?? id,
          color: category?.color ?? '#1f7a75',
        }
      })
      syncChip(
        mount,
        {
          threadId: row.threadId,
          names,
        },
        cssText,
        themeOf(document),
      )
    }
    void call({
      type: 'reportStatus',
      status: {
        view: classifyHash(location.hash),
        eligible,
        classified,
        queued,
        accountReady: !accountScope.startsWith('ephemeral:'),
      },
    })
  }

  const scan = async (): Promise<void> => {
    const token = ++generation
    window.clearTimeout(retryTimer)
    loadFailed = false
    stopWatch()
    const earlyView = classifyHash(location.hash)
    if (earlyView !== 'thread' && earlyView !== 'unsupported') {
      const waiting = rows.size === 0 || unfinished() || !findList(document)
      if (!settings || (showLoader() && waiting)) busy = true
      paint()
    }
    settings =
      (await call<{ settings?: Settings }>({ type: 'getSettings' })).settings ??
      null
    if (token !== generation) return
    if (!settings) {
      busy = false
      paint()
      return
    }
    const view = classifyHash(location.hash)
    const tab = selectedTabLabel(document)
    const list = findList(document)
    if (
      view === 'thread' ||
      view === 'unsupported' ||
      !viewIsEnabled(view, tab, settings.views)
    ) {
      rows = new Map()
      busy = false
      if (list) {
        for (const row of list.querySelectorAll('tr.zA')) removeChips(row)
      }
      paint()
      return
    }
    if (!list?.parentElement) {
      rows = new Map()
      busy = showLoader()
      paint()
      if (token === generation) scheduleRetry()
      return
    }
    stopWatch = watchList(list, () => {
      void scan()
    })
    const email = readAccountEmail(document)
    accountScope = email
      ? await sha256Hex(normalizeEmail(email))
      : ephemeralScope()
    configHash = await hashConfig(categoryMaterial(settings))
    const remembered = savedClassifications(accountScope, configHash)
    const extracted = extractRows(list, location.href)
    const next = new Map<string, StoredRow>()
    for (const row of extracted) {
      if (token !== generation) return
      const fingerprint = await fingerprintMetadata(row)
      const previous = rows.get(row.threadId)
      next.set(row.threadId, {
        ...row,
        fingerprint,
        decision:
          remembered.get(row.threadId) ??
          (previous && previous.fingerprint === fingerprint
            ? previous.decision
            : undefined),
      })
    }
    if (token !== generation) return
    for (const row of list.querySelectorAll('tr.zA')) {
      const id = row
        .querySelector('[data-thread-id]')
        ?.getAttribute('data-thread-id')
      if (!id || !next.has(id)) removeChips(row)
    }
    rows = next
    if (!classifiable()) {
      busy = false
      paint()
      return
    }
    busy = showLoader() && unfinished()
    paint()
    const pending = [...rows.values()].filter(
      (row) => !row.decision || row.decision.status === 'pending',
    )
    for (let index = 0; index < pending.length; index += MAX_BATCH) {
      const batch = pending.slice(index, index + MAX_BATCH)
      const response = await call<{
        ok: boolean
        error?: string
        configHash?: string
        results?: {
          threadId: string
          fingerprint: string
          decision: Decision
        }[]
      }>({
        type: 'classifyBatch',
        viewId: `${view}:${accountScope}:${location.hash}`,
        rows: batch.map((row) => ({
          threadId: row.threadId,
          accountScope,
          senderName: row.senderName,
          senderAddress: row.senderAddress,
          subject: row.subject,
          snippet: row.snippet,
          dateLabel: row.dateLabel,
          listIndex: row.listIndex,
          unread: row.unread,
          threadUrl: row.threadUrl,
          fingerprint: row.fingerprint,
        })),
      })
      if (token !== generation) return
      if (!response.ok) {
        loadFailed = true
        busy = false
        paint()
        return
      }
      configHash = response.configHash ?? configHash
      for (const result of response.results ?? []) {
        const row = rows.get(result.threadId)
        if (!row || row.fingerprint !== result.fingerprint) continue
        row.decision = result.decision
        saveClassification(
          accountScope,
          result.threadId,
          configHash,
          result.decision,
        )
      }
      busy = showLoader() && unfinished()
      paint()
    }
    if (token !== generation) return
    busy = showLoader() && unfinished()
    paint()
  }

  chrome.runtime.onMessage.addListener(
    (message: {
      type?: string
      accountScope?: string
      threadId?: string
      fingerprint?: string
      configHash?: string
      decision?: Decision
    }) => {
      if (message.type === 'resubmit' || message.type === 'settingsChanged') {
        void scan()
        return
      }
      if (message.type !== 'decision' || message.accountScope !== accountScope)
        return
      if (message.configHash && configHash && message.configHash !== configHash)
        return
      const row = message.threadId ? rows.get(message.threadId) : undefined
      if (!row || !message.decision || row.fingerprint !== message.fingerprint)
        return
      row.decision = message.decision
      saveClassification(
        accountScope,
        row.threadId,
        message.configHash ?? configHash,
        message.decision,
      )
      busy = showLoader() && unfinished()
      paint()
    },
  )

  window.addEventListener('hashchange', () => {
    rows = new Map()
    void scan()
  })
  void scan()
}

const normalizeEmail = (email: string): string => email.trim().toLowerCase()

startContent()
