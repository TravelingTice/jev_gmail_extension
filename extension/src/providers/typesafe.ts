import {
  MAX_ATTEMPTS,
  REQUEST_TIMEOUT_MS,
  TYPESAFE_ENDPOINT,
} from '../shared/limits'
import { validateAnswers } from '../domain/classify'
import { buildQuestions, buildState } from '../domain/questions'
import {
  mapSystemOneResponse,
  noulAnswerSchema,
  systemOneResponseSchema,
} from './schemas'
import type {
  ClassifierProvider,
  EvaluationRequest,
  FetchLike,
  ProviderResult,
} from './provider'

export type RetryDeps = {
  apiKey: string
  fetchImpl?: FetchLike
  sleep?: (ms: number) => Promise<void>
  random?: () => number
  timeoutMs?: number
  onAttempt?: () => Promise<boolean>
}

const retryAfterMs = (
  header: string | null,
  now: number,
): number | undefined => {
  if (!header) return undefined
  const seconds = Number(header)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const date = Date.parse(header)
  if (Number.isNaN(date)) return undefined
  return Math.max(0, date - now)
}

const backoffMs = (
  attempt: number,
  random: () => number,
  retryAfter?: number,
): number => {
  const exponential = Math.min(8000, 500 * 2 ** (attempt - 1))
  const jitter = random() * 200
  return Math.max(retryAfter ?? 0, exponential + jitter)
}

const isRetryable = (status: number | undefined, kind: string): boolean => {
  if (kind === 'timeout' || kind === 'network') return true
  if (status == null) return false
  if (status === 408 || status === 429 || status === 529) return true
  return status >= 500 && status <= 599
}

const postOnce = async (
  deps: RetryDeps,
  body: unknown,
  timeoutMs: number,
): Promise<
  | { ok: true; payload: unknown }
  | {
      ok: false
      kind: 'auth' | 'timeout' | 'network' | 'http'
      status?: number
      message: string
      retryAfter?: number
    }
> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await (deps.fetchImpl ?? fetch)(TYPESAFE_ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${deps.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        kind: 'auth',
        status: response.status,
        message: 'The API key was rejected.',
      }
    }
    if (!response.ok) {
      return {
        ok: false,
        kind: 'http',
        status: response.status,
        message: `The provider returned HTTP ${response.status}.`,
        retryAfter: retryAfterMs(
          response.headers.get('retry-after'),
          Date.now(),
        ),
      }
    }
    return { ok: true, payload: await response.json() }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, kind: 'timeout', message: 'The request timed out.' }
    }
    return {
      ok: false,
      kind: 'network',
      message: 'The network request failed.',
    }
  } finally {
    clearTimeout(timer)
  }
}

const runWithRetries = async (
  deps: RetryDeps,
  body: unknown,
  map: (
    payload: unknown,
  ) => ProviderResult | { ok: false; kind: 'invalid'; message: string },
): Promise<ProviderResult> => {
  const sleep =
    deps.sleep ??
    ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)))
  const random = deps.random ?? Math.random
  const timeoutMs = deps.timeoutMs ?? REQUEST_TIMEOUT_MS
  let attempts = 0
  let last: ProviderResult = {
    ok: false,
    kind: 'network',
    attempts: 0,
    message: 'The request was not sent.',
  }
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    if (deps.onAttempt) {
      const allowed = await deps.onAttempt()
      if (!allowed) {
        return {
          ok: false,
          kind: 'http',
          status: 429,
          attempts,
          message: 'The daily request limit has been reached.',
        }
      }
    }
    attempts += 1
    const once = await postOnce(deps, body, timeoutMs)
    if (once.ok) {
      const mapped = map(once.payload)
      if (mapped.ok) return { ...mapped, attempts }
      last = { ok: false, kind: 'invalid', attempts, message: mapped.message }
      return last
    }
    last = {
      ok: false,
      kind: once.kind,
      status: once.status,
      attempts,
      message: once.message,
    }
    const retryable = isRetryable(once.status, once.kind)
    if (!retryable || attempt === MAX_ATTEMPTS) return last
    await sleep(backoffMs(attempt, random, once.retryAfter))
  }
  return last
}

const toResult = (
  request: EvaluationRequest,
  payload: unknown,
): ProviderResult | { ok: false; kind: 'invalid'; message: string } => {
  const categoryIds = request.categories
    .filter((category) => category.enabled)
    .map((category) => category.id)
  const mapped = mapSystemOneResponse(payload, categoryIds)
  if (!mapped.ok) return { ok: false, kind: 'invalid', message: mapped.reason }
  const answers = validateAnswers(mapped.mapped, categoryIds)
  const state = buildState(request.email, request.evaluatedAt, request.timeZone)
  const questions = buildQuestions(request.categories, request.priorityContext)
  if (!answers.valid) {
    return { ok: false, kind: 'invalid', message: answers.reason }
  }
  return {
    ok: true,
    answers,
    modelId: mapped.mapped.modelId,
    attempts: 0,
    usage: mapped.mapped.usage,
    state,
    questions,
  }
}

export const createTypeSafeProvider = (
  deps: RetryDeps,
): ClassifierProvider => ({
  evaluate: (request) => {
    const state = buildState(
      request.email,
      request.evaluatedAt,
      request.timeZone,
    )
    const questions = buildQuestions(
      request.categories,
      request.priorityContext,
    )
    return runWithRetries(
      deps,
      { model: 'jev-latest', state, questions },
      (payload) => toResult(request, payload),
    )
  },
  testConnection: () => {
    const request: EvaluationRequest = {
      threadId: 'connection-test',
      email: {
        threadId: 'connection-test',
        senderName: 'Classifier',
        senderAddress: 'demo@example.com',
        subject: 'Synthetic connection test',
        snippet: 'This is not a real email.',
        dateLabel: null,
      },
      categories: [],
      priorityContext: '',
      evaluatedAt: new Date(0).toISOString(),
      timeZone: 'UTC',
    }
    const questions = {
      reachable: {
        type: 'noul' as const,
        instructions: 'Is this a synthetic connection test?',
        criteria: {
          true: 'The subject says connection test.',
          false: 'It does not.',
        },
      },
    }
    return runWithRetries(
      { ...deps, onAttempt: undefined },
      {
        model: 'jev-latest',
        state: buildState(request.email, request.evaluatedAt, request.timeZone),
        questions,
      },
      (payload) => {
        const parsed = systemOneResponseSchema.safeParse(payload)
        const reachable = noulAnswerSchema.safeParse(
          parsed.success ? parsed.data.answers.reachable : null,
        )
        if (
          !parsed.success ||
          !reachable.success ||
          reachable.data.noul < 0 ||
          reachable.data.noul > 1
        ) {
          return {
            ok: false,
            kind: 'invalid' as const,
            message: 'The connection test response was unusable.',
          }
        }
        const answers = validateAnswers(
          {
            categories: {},
            requiresAction: 0,
            critical: 0,
            urgency: 0,
            urgencyConfidence: null,
          },
          [],
        )
        if (!answers.valid)
          return {
            ok: false,
            kind: 'invalid' as const,
            message: answers.reason,
          }
        return {
          ok: true as const,
          answers,
          modelId: parsed.data.model ?? 'unknown',
          attempts: 0,
          usage: parsed.data.usage
            ? {
                inputTokens: parsed.data.usage.input_tokens,
                outputTokens: parsed.data.usage.output_tokens,
              }
            : undefined,
          state: buildState(
            request.email,
            request.evaluatedAt,
            request.timeZone,
          ),
          questions,
        }
      },
    )
  },
})
