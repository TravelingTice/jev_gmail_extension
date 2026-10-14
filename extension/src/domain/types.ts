export type EmailFields = {
  threadId: string
  senderName: string | null
  senderAddress: string | null
  subject: string | null
  snippet: string | null
  dateLabel: string | null
}

export type Category = {
  id: string
  name: string
  description: string
  enabled: boolean
  color: string
}

export type Thresholds = {
  category: number
  critical: number
  reviewLower: number
}

export type RowStatus =
  | 'pending'
  | 'classified'
  | 'review-needed'
  | 'uncategorized'
  | 'excluded'
  | 'failed'

export type ThreadOverride = {
  accountScope: string
  threadId: string
  includeCategoryIds: string[]
  excludeCategoryIds: string[]
  critical: 'force' | 'clear' | null
}

export type ValidAnswers = {
  valid: true
  categories: Record<string, number>
  requiresAction: number
  critical: number
  urgency: number
  urgencyConfidence: number | null
}

export type InvalidAnswers = {
  valid: false
  reason: string
}

export type Decision = {
  status: RowStatus
  matchedCategoryIds: string[]
  categoryProbabilities: Record<string, number>
  requiresActionProbability: number | null
  criticalProbability: number | null
  urgency: number | null
  urgencyConfidence: number | null
  critical: boolean
  actionRequired: boolean
  review: boolean
  overridden: boolean
  detail: string
}

export type Rankable = {
  threadId: string
  listIndex: number
  status: RowStatus
  critical: boolean
  actionRequired: boolean
  urgency: number | null
  criticalProbability: number | null
}
