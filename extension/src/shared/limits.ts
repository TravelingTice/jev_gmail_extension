export const EXTENSION_NAME = 'GmailClass'
export const EXTENSION_DESCRIPTION =
  'GmailClass - Gmail Email Classifier Powered By Jev'
export const QUESTION_VERSION = 1
export const MODEL_ID = 'jev-latest'
export const METADATA_CHAR_LIMIT = 4000
export const MAX_CATEGORIES = 15
export const MAX_BATCH = 20
export const MAX_CONCURRENT = 2
export const REQUEST_TIMEOUT_MS = 15_000
export const MAX_ATTEMPTS = 3
export const DEFAULT_CATEGORY_THRESHOLD = 0.7
export const DEFAULT_CRITICAL_THRESHOLD = 0.7
export const DEFAULT_REVIEW_LOWER = 0.4
export const DEFAULT_DAILY_LIMIT = 500
export const CACHE_MAX_ENTRIES = 2000
export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const CACHE_BYTE_BUDGET = 2_000_000
export const LEASE_MS = 60_000
export const MAX_JOBS = 100
export const TYPESAFE_ENDPOINT = 'https://api.typesafe.ai/v1/systemone'

export const URGENCY_LABELS = [
  'No time pressure',
  'Next few days',
  'Today',
  'Immediately',
] as const

export const STORAGE_KEYS = {
  settings: 'gec.settings',
  cache: 'gec.cache',
  jobs: 'gec.jobs',
  usage: 'gec.usage',
  secret: 'gec.secret',
} as const
