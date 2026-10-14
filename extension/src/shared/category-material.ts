import { MODEL_ID, QUESTION_VERSION } from './limits'

export const categoryMaterial = (settings: {
  priorityContext: string
  categories: {
    id: string
    name: string
    description: string
    enabled: boolean
  }[]
}) => ({
  questionVersion: QUESTION_VERSION,
  model: MODEL_ID,
  priorityContext: settings.priorityContext.trim(),
  categories: settings.categories
    .filter((category) => category.enabled)
    .map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
    })),
})
