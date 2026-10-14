import type { Rankable } from './types'

const groupOf = (row: Rankable): number => {
  if (row.status === 'failed') return 3
  if (row.status === 'excluded') return 4
  if (row.critical) return 0
  if (row.actionRequired) return 1
  return 2
}

const urgencyOf = (row: Rankable): number =>
  row.urgency == null ? -1 : row.urgency

const criticalOf = (row: Rankable): number => row.criticalProbability ?? -1

export const rankRows = <T extends Rankable>(rows: readonly T[]): T[] =>
  [...rows].sort((left, right) => {
    const group = groupOf(left) - groupOf(right)
    if (group !== 0) return group
    if (groupOf(left) < 2) {
      const urgency = urgencyOf(right) - urgencyOf(left)
      if (urgency !== 0) return urgency
      const critical = criticalOf(right) - criticalOf(left)
      if (critical !== 0) return critical
    }
    if (left.listIndex !== right.listIndex)
      return left.listIndex - right.listIndex
    return left.threadId < right.threadId
      ? -1
      : left.threadId > right.threadId
        ? 1
        : 0
  })
