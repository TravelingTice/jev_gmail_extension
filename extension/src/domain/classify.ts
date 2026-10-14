import type {
  Decision,
  InvalidAnswers,
  ThreadOverride,
  Thresholds,
  ValidAnswers,
} from './types'

const inUnit = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1

export const validateAnswers = (
  raw: {
    categories: Record<string, unknown>
    requiresAction: unknown
    critical: unknown
    urgency: unknown
    urgencyConfidence: unknown
  },
  categoryIds: string[],
): ValidAnswers | InvalidAnswers => {
  const categories: Record<string, number> = {}
  for (const id of categoryIds) {
    const value = raw.categories[id]
    if (!inUnit(value)) {
      return {
        valid: false,
        reason: 'A category probability was missing or out of range.',
      }
    }
    categories[id] = value
  }
  if (!inUnit(raw.requiresAction) || !inUnit(raw.critical)) {
    return {
      valid: false,
      reason: 'Action or critical probability was missing or out of range.',
    }
  }
  if (
    typeof raw.urgency !== 'number' ||
    !Number.isFinite(raw.urgency) ||
    raw.urgency < 0 ||
    raw.urgency > 3
  ) {
    return { valid: false, reason: 'Urgency was missing or out of range.' }
  }
  if (raw.urgencyConfidence != null && !inUnit(raw.urgencyConfidence)) {
    return { valid: false, reason: 'Urgency confidence was out of range.' }
  }
  return {
    valid: true,
    categories,
    requiresAction: raw.requiresAction,
    critical: raw.critical,
    urgency: raw.urgency,
    urgencyConfidence: raw.urgencyConfidence ?? null,
  }
}

const blank = (detail: string, status: Decision['status']): Decision => ({
  status,
  matchedCategoryIds: [],
  categoryProbabilities: {},
  requiresActionProbability: null,
  criticalProbability: null,
  urgency: null,
  urgencyConfidence: null,
  critical: false,
  actionRequired: false,
  review: false,
  overridden: false,
  detail,
})

export const pendingDecision = (detail: string): Decision =>
  blank(detail, 'pending')

export const excludedDecision = (): Decision =>
  blank(
    'This sender is excluded. No classification request was sent.',
    'excluded',
  )

export const failedDecision = (detail: string): Decision =>
  blank(detail, 'failed')

const statusFor = (matched: string[], review: boolean): Decision['status'] => {
  if (review) return 'review-needed'
  if (matched.length > 0) return 'classified'
  return 'uncategorized'
}

const hasCorrection = (override: ThreadOverride | null): boolean =>
  Boolean(
    override &&
    (override.includeCategoryIds.length > 0 ||
      override.excludeCategoryIds.length > 0 ||
      override.critical),
  )

export const decide = (
  answers: ValidAnswers | InvalidAnswers,
  thresholds: Thresholds,
  override: ThreadOverride | null,
): Decision => {
  const base = answers.valid
    ? fromAnswers(answers, thresholds)
    : failedDecision(answers.reason)
  if (!hasCorrection(override) || !override) return base
  return applyOverride(base, override)
}

const fromAnswers = (
  answers: ValidAnswers,
  thresholds: Thresholds,
): Decision => {
  const matched: string[] = []
  let review = false
  for (const [id, probability] of Object.entries(answers.categories)) {
    if (probability >= thresholds.category) matched.push(id)
    else if (probability >= thresholds.reviewLower) review = true
  }
  const actionAmbiguous =
    answers.requiresAction >= thresholds.reviewLower &&
    answers.requiresAction < thresholds.critical
  const criticalAmbiguous =
    answers.critical >= thresholds.reviewLower &&
    answers.critical < thresholds.critical
  if (actionAmbiguous || criticalAmbiguous) review = true
  const critical = answers.critical >= thresholds.critical
  const actionRequired = answers.requiresAction >= thresholds.critical
  return {
    status: statusFor(matched, review),
    matchedCategoryIds: matched,
    categoryProbabilities: answers.categories,
    requiresActionProbability: answers.requiresAction,
    criticalProbability: answers.critical,
    urgency: answers.urgency,
    urgencyConfidence: answers.urgencyConfidence,
    critical,
    actionRequired,
    review,
    overridden: false,
    detail: review
      ? 'Some judgments are ambiguous and need a look.'
      : matched.length > 0
        ? 'Classified from the subject and preview.'
        : 'No category was a clear match.',
  }
}

const applyOverride = (base: Decision, override: ThreadOverride): Decision => {
  const matched = new Set(base.matchedCategoryIds)
  for (const id of override.excludeCategoryIds) matched.delete(id)
  for (const id of override.includeCategoryIds) matched.add(id)
  const matchedCategoryIds = [...matched]
  let critical = base.critical
  if (override.critical === 'force') critical = true
  if (override.critical === 'clear') critical = false
  const upgraded =
    base.status === 'failed' &&
    (matchedCategoryIds.length > 0 || override.critical === 'force')
  const status =
    base.status === 'failed' && !upgraded
      ? 'failed'
      : base.status === 'excluded'
        ? 'excluded'
        : statusFor(matchedCategoryIds, base.review && base.status !== 'failed')
  return {
    ...base,
    status,
    matchedCategoryIds,
    critical,
    overridden: true,
    detail: upgraded
      ? 'Showing your correction. The model result was unusable.'
      : 'Your correction overrides the model for this thread.',
  }
}
