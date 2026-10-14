import { z } from 'zod'

export const noulAnswerSchema = z.object({
  type: z.literal('noul'),
  noul: z.number(),
})

const scoreAnswerSchema = z.object({
  type: z.literal('score'),
  score: z.number(),
  confidence: z.number().optional(),
})

export const systemOneResponseSchema = z.object({
  model: z.string().optional(),
  answers: z.record(z.unknown()),
  usage: z
    .object({
      input_tokens: z.number().optional(),
      output_tokens: z.number().optional(),
    })
    .optional(),
})

export type Usage = {
  inputTokens?: number
  outputTokens?: number
}

export type MappedAnswers = {
  categories: Record<string, unknown>
  requiresAction: unknown
  critical: unknown
  urgency: unknown
  urgencyConfidence: unknown
  modelId: string
  usage?: Usage
}

export const mapSystemOneResponse = (
  payload: unknown,
  categoryIds: string[],
): { ok: true; mapped: MappedAnswers } | { ok: false; reason: string } => {
  const parsed = systemOneResponseSchema.safeParse(payload)
  if (!parsed.success)
    return {
      ok: false,
      reason: 'The provider response did not match the expected shape.',
    }
  const answers = parsed.data.answers
  const categories: Record<string, unknown> = {}
  for (const id of categoryIds) {
    const answer = noulAnswerSchema.safeParse(answers[`category_${id}`])
    if (!answer.success)
      return {
        ok: false,
        reason: 'A category answer was missing or malformed.',
      }
    categories[id] = answer.data.noul
  }
  const action = noulAnswerSchema.safeParse(answers.requires_action)
  const critical = noulAnswerSchema.safeParse(answers.critical)
  const urgency = scoreAnswerSchema.safeParse(answers.urgency)
  if (!action.success || !critical.success || !urgency.success) {
    return {
      ok: false,
      reason: 'Action, critical, or urgency was missing or malformed.',
    }
  }
  return {
    ok: true,
    mapped: {
      categories,
      requiresAction: action.data.noul,
      critical: critical.data.noul,
      urgency: urgency.data.score,
      urgencyConfidence: urgency.data.confidence ?? null,
      modelId: parsed.data.model ?? 'unknown',
      usage: parsed.data.usage
        ? {
            inputTokens: parsed.data.usage.input_tokens,
            outputTokens: parsed.data.usage.output_tokens,
          }
        : undefined,
    },
  }
}
