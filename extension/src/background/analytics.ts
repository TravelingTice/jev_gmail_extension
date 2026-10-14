import type { KeyValueStore } from '../storage/chrome-store'
import { parseSettings } from '../storage/settings'
import { STORAGE_KEYS } from '../shared/limits'

export type AnalyticsEvent =
  'analytics_enabled' | 'extension_enabled' | 'category_created' | 'labels_used'

type LocalMarkers = { optedIn?: boolean; labelsDay?: string }

export const createAnalytics = (
  store: KeyValueStore,
  testBuild: boolean,
  transport: typeof fetch = fetch,
  now: () => number = Date.now,
) => {
  let chain = Promise.resolve()
  return (event: AnalyticsEvent): Promise<void> => {
    const run = chain
      .then(async () => {
        const settings = parseSettings(await store.get(STORAGE_KEYS.settings))
        if (
          testBuild ||
          !settings.analyticsEnabled ||
          settings.providerMode === 'fixture'
        )
          return
        const markers =
          (await store.get<LocalMarkers>('analyticsMarkers')) ?? {}
        const day = new Date(now()).toISOString().slice(0, 10)
        if (event === 'analytics_enabled' && markers.optedIn) return
        if (event === 'labels_used' && markers.labelsDay === day) return
        // Mark before sending to avoid duplicate signals after worker restarts.
        // Failed deliveries are dropped; no email-derived data or retry queue is kept.
        if (event === 'analytics_enabled') markers.optedIn = true
        if (event === 'labels_used') markers.labelsDay = day
        await store.set('analyticsMarkers', markers)
        await transport(
          'https://gmailclass.ticekralt.com/api/analytics?action=collect',
          {
            method: 'POST',
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: 'extension', event }),
            signal: AbortSignal.timeout(3000),
          },
        )
      })
      .catch(() => undefined)
    chain = run
    return run
  }
}
