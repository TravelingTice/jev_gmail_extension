import {
  DEFAULT_CATEGORY_THRESHOLD,
  DEFAULT_CRITICAL_THRESHOLD,
  DEFAULT_DAILY_LIMIT,
  DEFAULT_REVIEW_LOWER,
} from '../shared/limits'
import { categoryColor, STARTER_CATEGORIES } from '../domain/categories'
import { settingsSchema, type Settings } from '../shared/schemas'

export type { Settings }

export const defaultSettings = (): Settings => ({
  version: 1,
  analyticsEnabled: false,
  disclosureAcknowledged: false,
  enabled: false,
  paused: false,
  connectionVerified: false,
  providerMode: 'typesafe',
  categoryThreshold: DEFAULT_CATEGORY_THRESHOLD,
  criticalThreshold: DEFAULT_CRITICAL_THRESHOLD,
  reviewLower: DEFAULT_REVIEW_LOWER,
  includeRead: true,
  dailyLimit: DEFAULT_DAILY_LIMIT,
  priorityContext: '',
  views: { primary: true, inboxTabs: true, labels: true, search: true },
  categories: STARTER_CATEGORIES.map((category) => ({ ...category })),
  exclusions: { senders: [], domains: [] },
  authBlocked: false,
  overrides: [],
})

export const parseSettings = (value: unknown): Settings => {
  const candidate =
    value && typeof value === 'object'
      ? {
          ...(value as Record<string, unknown>),
          categories: Array.isArray(
            (value as { categories?: unknown }).categories,
          )
            ? (
                value as {
                  categories: { color?: string }[]
                }
              ).categories.map((category, index) => ({
                ...category,
                color:
                  typeof category?.color === 'string' &&
                  /^#[0-9a-fA-F]{6}$/.test(category.color)
                    ? category.color
                    : categoryColor(index),
              }))
            : (value as { categories?: unknown }).categories,
        }
      : value
  const parsed = settingsSchema.safeParse(candidate)
  if (parsed.success) return parsed.data
  return defaultSettings()
}

export const thresholdsOf = (
  settings: Settings,
): { category: number; critical: number; reviewLower: number } => ({
  category: settings.categoryThreshold,
  critical: settings.criticalThreshold,
  reviewLower: settings.reviewLower,
})

export { categoryMaterial } from '../shared/category-material'
