import type { Category, EmailFields, ValidAnswers } from '../domain/types'
import type { EvaluationState, WireQuestion } from '../domain/questions'

export type EvaluationRequest = {
  threadId: string
  email: EmailFields
  categories: Category[]
  priorityContext: string
  evaluatedAt: string
  timeZone: string
}

export type ProviderSuccess = {
  ok: true
  answers: ValidAnswers
  modelId: string
  attempts: number
  usage?: { inputTokens?: number; outputTokens?: number }
  state: EvaluationState
  questions: Record<string, WireQuestion>
}

export type ProviderFailure = {
  ok: false
  kind: 'auth' | 'timeout' | 'network' | 'http' | 'invalid'
  status?: number
  attempts: number
  message: string
}

export type ProviderResult = ProviderSuccess | ProviderFailure

export type ClassifierProvider = {
  evaluate: (request: EvaluationRequest) => Promise<ProviderResult>
  testConnection: () => Promise<ProviderResult>
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>
