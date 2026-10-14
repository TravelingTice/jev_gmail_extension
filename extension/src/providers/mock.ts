import { validateAnswers } from '../domain/classify'
import { buildQuestions, buildState } from '../domain/questions'
import type {
  ClassifierProvider,
  EvaluationRequest,
  ProviderResult,
} from './provider'

const enabledIds = (request: EvaluationRequest): string[] =>
  request.categories
    .filter((category) => category.enabled)
    .map((category) => category.id)

const profile = (text: string, ids: string[]): Record<string, number> => {
  const categories = Object.fromEntries(ids.map((id) => [id, 0.05]))
  const set = (id: string, value: number) => {
    if (id in categories) categories[id] = value
  }
  if (
    text.includes('invoice') ||
    text.includes('transfer') ||
    text.includes('payment')
  )
    set('invoices', 0.93)
  if (
    text.includes('hotel') ||
    text.includes('booking') ||
    text.includes('flight') ||
    text.includes('trip')
  ) {
    set('travel', 0.91)
  }
  if (text.includes('digest') || text.includes('newsletter'))
    set('newsletters', 0.95)
  if (
    text.includes('login') ||
    text.includes('password') ||
    text.includes('device')
  )
    set('security', 0.96)
  if (
    text.includes('work') ||
    text.includes('client') ||
    text.includes('project')
  )
    set('work', 0.88)
  if (text.includes('family') || text.includes('birthday')) set('personal', 0.9)
  if (
    text.includes('discount') ||
    text.includes('sale') ||
    text.includes('% off')
  )
    set('promotions', 0.92)
  return categories
}

const answersFor = (request: EvaluationRequest) => {
  const ids = enabledIds(request)
  const text =
    `${request.email.subject ?? ''} ${request.email.snippet ?? ''}`.toLowerCase()
  const categories = profile(text, ids)
  if (text.includes('that thing')) {
    return validateAnswers(
      {
        categories: Object.fromEntries(ids.map((id) => [id, 0.12])),
        requiresAction: 0.45,
        critical: 0.1,
        urgency: 1,
        urgencyConfidence: 0.4,
      },
      ids,
    )
  }
  if (text.includes('invoice') && text.includes('trip')) {
    return validateAnswers(
      {
        categories: { ...categories, work: 0.86, invoices: 0.9, travel: 0.8 },
        requiresAction: 0.84,
        critical: 0.55,
        urgency: 2,
        urgencyConfidence: 0.7,
      },
      ids,
    )
  }
  const security = text.includes('login') || text.includes('device')
  const invoice = text.includes('invoice') || text.includes('transfer')
  return validateAnswers(
    {
      categories,
      requiresAction:
        invoice || security
          ? 0.9
          : text.includes('hotel') || text.includes('digest')
            ? 0.08
            : 0.12,
      critical: invoice || security ? 0.9 : 0.05,
      urgency: invoice || security ? 3 : 0,
      urgencyConfidence: 0.8,
    },
    ids,
  )
}

export const createMockProvider = (): ClassifierProvider & {
  evaluations: number
  connectionTests: number
} => {
  const failuresLeft = new Map<string, number>()
  const provider = {
    evaluations: 0,
    connectionTests: 0,
    evaluate: async (request: EvaluationRequest): Promise<ProviderResult> => {
      provider.evaluations += 1
      const text = `${request.email.subject ?? ''}`.toLowerCase()
      if (text.includes('[error]')) {
        return {
          ok: false,
          kind: 'http',
          status: 503,
          attempts: 1,
          message: 'The fixture provider failed this row.',
        }
      }
      if (text.includes('[retry]')) {
        const left = failuresLeft.get(request.threadId) ?? 1
        if (left > 0) {
          failuresLeft.set(request.threadId, left - 1)
          return {
            ok: false,
            kind: 'network',
            attempts: 1,
            message: 'The fixture provider failed once.',
          }
        }
      }
      const answers = answersFor(request)
      if (!answers.valid) {
        return {
          ok: false,
          kind: 'invalid',
          attempts: 1,
          message: answers.reason,
        }
      }
      return {
        ok: true,
        answers,
        modelId: 'fixture',
        attempts: 1,
        state: buildState(request.email, request.evaluatedAt, request.timeZone),
        questions: buildQuestions(request.categories, request.priorityContext),
      }
    },
    testConnection: async (): Promise<ProviderResult> => {
      provider.connectionTests += 1
      const request: EvaluationRequest = {
        threadId: 'connection-test',
        email: {
          threadId: 'connection-test',
          senderName: null,
          senderAddress: null,
          subject: 'Synthetic connection test',
          snippet: 'Not a real email.',
          dateLabel: null,
        },
        categories: [],
        priorityContext: '',
        evaluatedAt: new Date(0).toISOString(),
        timeZone: 'UTC',
      }
      const answers = validateAnswers(
        {
          categories: {},
          requiresAction: 0,
          critical: 0,
          urgency: 0,
          urgencyConfidence: 1,
        },
        [],
      )
      if (!answers.valid)
        return {
          ok: false,
          kind: 'invalid',
          attempts: 1,
          message: answers.reason,
        }
      return {
        ok: true,
        answers,
        modelId: 'fixture',
        attempts: 1,
        state: buildState(request.email, request.evaluatedAt, request.timeZone),
        questions: {},
      }
    },
  }
  return provider
}
