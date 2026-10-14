import { z } from 'zod'
import { MAX_CATEGORIES } from './limits'
import { categoryIdOk } from '../domain/categories'

export const categorySchema = z.object({
  id: z.string().refine(categoryIdOk),
  name: z.string().min(1).max(40),
  description: z.string().min(1).max(500),
  enabled: z.boolean(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
})

export const settingsSchema = z.object({
  version: z.literal(1),
  analyticsEnabled: z.boolean().default(false),
  disclosureAcknowledged: z.boolean(),
  enabled: z.boolean(),
  paused: z.boolean(),
  connectionVerified: z.boolean(),
  providerMode: z.enum(['typesafe', 'fixture']),
  categoryThreshold: z.number().gt(0).lt(1),
  criticalThreshold: z.number().gt(0).lt(1),
  reviewLower: z.number().min(0).lt(1),
  includeRead: z.boolean(),
  dailyLimit: z.number().int().min(1).max(5000),
  priorityContext: z.string().max(280),
  views: z.object({
    primary: z.boolean(),
    inboxTabs: z.boolean(),
    labels: z.boolean(),
    search: z.boolean(),
  }),
  categories: z.array(categorySchema).max(MAX_CATEGORIES),
  exclusions: z.object({
    senders: z.array(z.string().max(320)).max(100),
    domains: z.array(z.string().max(253)).max(100),
  }),
  authBlocked: z.boolean(),
  overrides: z
    .array(
      z.object({
        accountScope: z.string().min(1).max(80),
        threadId: z.string().min(1).max(200),
        includeCategoryIds: z.array(z.string()).max(MAX_CATEGORIES),
        excludeCategoryIds: z.array(z.string()).max(MAX_CATEGORIES),
        critical: z.enum(['force', 'clear']).nullable(),
      }),
    )
    .max(500),
})

export type Settings = z.infer<typeof settingsSchema>

export const rowSchema = z.object({
  threadId: z.string().min(1).max(200),
  accountScope: z.string().min(1).max(80),
  senderName: z.string().max(300).nullable(),
  senderAddress: z.string().max(320).nullable(),
  subject: z.string().max(1000).nullable(),
  snippet: z.string().max(8000).nullable(),
  dateLabel: z.string().max(200).nullable(),
  listIndex: z.number().int().nonnegative().max(10000),
  unread: z.boolean(),
  threadUrl: z.string().max(2000).nullable(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
})

export type ClassifyRow = z.infer<typeof rowSchema>

const scopeOk = (value: string): boolean =>
  /^[a-f0-9]{64}$/.test(value) || /^ephemeral:[a-z0-9-]{8,40}$/.test(value)

export const extensionMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('getSettings') }),
  z.object({
    type: z.literal('getPopupState'),
    tabId: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('saveSettings'),
    patch: z.record(z.unknown()),
  }),
  z.object({ type: z.literal('saveKey'), apiKey: z.string().min(8).max(400) }),
  z.object({ type: z.literal('removeKey') }),
  z.object({ type: z.literal('testConnection') }),
  z.object({ type: z.literal('clearCache') }),
  z.object({ type: z.literal('resetOverrides') }),
  z.object({
    type: z.literal('classifyBatch'),
    viewId: z.string().min(1).max(200),
    rows: z.array(rowSchema).max(20),
  }),
  z.object({
    type: z.literal('setOverride'),
    accountScope: z.string().refine(scopeOk),
    threadId: z.string().min(1).max(200),
    categoryId: z.string().max(50).optional(),
    categoryMode: z.enum(['include', 'exclude', 'clear']).optional(),
    critical: z.enum(['force', 'clear']).nullable().optional(),
    reset: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('retryFailed'),
    accountScope: z.string().refine(scopeOk),
    threadIds: z.array(z.string().min(1).max(200)).max(50),
  }),
  z.object({
    type: z.literal('reportStatus'),
    status: z.object({
      view: z.string().max(40),
      eligible: z.number().int().nonnegative(),
      classified: z.number().int().nonnegative(),
      queued: z.number().int().nonnegative(),
      accountReady: z.boolean(),
    }),
  }),
  z.object({ type: z.literal('getDebugStats') }),
  z.object({ type: z.literal('openOptions') }),
  z.object({ type: z.literal('setPaused'), paused: z.boolean() }),
])

export type ExtensionMessage = z.infer<typeof extensionMessageSchema>
