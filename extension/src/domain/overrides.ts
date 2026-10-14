import type { ThreadOverride } from './types'

export const emptyOverride = (
  accountScope: string,
  threadId: string,
): ThreadOverride => ({
  accountScope,
  threadId,
  includeCategoryIds: [],
  excludeCategoryIds: [],
  critical: null,
})

export const setCategoryOverride = (
  current: ThreadOverride,
  categoryId: string,
  mode: 'include' | 'exclude' | 'clear',
): ThreadOverride => {
  const includeCategoryIds = current.includeCategoryIds.filter(
    (id) => id !== categoryId,
  )
  const excludeCategoryIds = current.excludeCategoryIds.filter(
    (id) => id !== categoryId,
  )
  if (mode === 'include') includeCategoryIds.push(categoryId)
  if (mode === 'exclude') excludeCategoryIds.push(categoryId)
  return { ...current, includeCategoryIds, excludeCategoryIds }
}

export const setCriticalOverride = (
  current: ThreadOverride,
  critical: ThreadOverride['critical'],
): ThreadOverride => ({ ...current, critical })

export const overrideIsEmpty = (override: ThreadOverride): boolean =>
  override.includeCategoryIds.length === 0 &&
  override.excludeCategoryIds.length === 0 &&
  override.critical == null

export const dropCategoryFromOverrides = (
  overrides: ThreadOverride[],
  categoryId: string,
): ThreadOverride[] =>
  overrides
    .map((override) => ({
      ...override,
      includeCategoryIds: override.includeCategoryIds.filter(
        (id) => id !== categoryId,
      ),
      excludeCategoryIds: override.excludeCategoryIds.filter(
        (id) => id !== categoryId,
      ),
    }))
    .filter((override) => !overrideIsEmpty(override))
