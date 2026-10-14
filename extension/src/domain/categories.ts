import type { Category } from './types'

export const CATEGORY_COLORS = [
  '#3d7ea6',
  '#d4694e',
  '#1f7a75',
  '#c4922a',
  '#7a5ea7',
  '#4f8f4a',
  '#c45b78',
]

const COLOR = /^#[0-9a-fA-F]{6}$/

export const categoryColor = (index: number): string =>
  CATEGORY_COLORS[index % CATEGORY_COLORS.length] ?? CATEGORY_COLORS[0]

export const textOn = (color: string): string => {
  const value = color.replace('#', '')
  if (!COLOR.test(`#${value}`) || value.length !== 6) return '#172033'
  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
  return luminance > 0.62 ? '#172033' : '#ffffff'
}

export const STARTER_CATEGORIES: Category[] = [
  {
    id: 'work',
    name: 'Work',
    description:
      'Professional collaboration, clients, business projects, and work administration.',
    enabled: true,
    color: '#3d7ea6',
  },
  {
    id: 'invoices',
    name: 'Invoices & payments',
    description:
      'Bills, invoices, amounts due, payment requests, refunds, and payment confirmations.',
    enabled: true,
    color: '#d4694e',
  },
  {
    id: 'travel',
    name: 'Travel',
    description:
      'Bookings, tickets, accommodation, itinerary changes, and travel arrangements.',
    enabled: true,
    color: '#1f7a75',
  },
  {
    id: 'security',
    name: 'Accounts & security',
    description:
      'Login alerts, account recovery, password resets, and account access notices.',
    enabled: true,
    color: '#c4922a',
  },
  {
    id: 'personal',
    name: 'Personal',
    description:
      'Direct personal correspondence, family, friends, and personal appointments.',
    enabled: true,
    color: '#7a5ea7',
  },
  {
    id: 'newsletters',
    name: 'Newsletters',
    description:
      'Subscribed editorial updates, digests, and recurring informational publications.',
    enabled: true,
    color: '#4f8f4a',
  },
  {
    id: 'promotions',
    name: 'Promotions',
    description:
      'Advertising, discounts, product sales, and unsolicited commercial outreach.',
    enabled: true,
    color: '#c45b78',
  },
]

const NAME_LIMIT = 40
const DESCRIPTION_LIMIT = 500

export const categoryIdOk = (id: string): boolean =>
  /^[a-z][a-z0-9_]{0,40}$/.test(id)

export const newCategoryId = (now: number, random: () => number): string => {
  const suffix = Math.floor(random() * 1e9).toString(36)
  return `cat_${now.toString(36)}_${suffix}`
}

export const normalizeCategoryName = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, ' ')

const levenshtein = (left: string, right: string): number => {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => [index])
  for (let column = 0; column <= right.length; column += 1)
    rows[0][column] = column
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + cost,
      )
    }
  }
  return rows[left.length][right.length]
}

export const validateCategoryDraft = (
  draft: { name: string; description: string },
  existing: Category[],
  ignoreId?: string,
):
  | { ok: true; name: string; description: string; warning: string | null }
  | { ok: false; error: string } => {
  const name = draft.name.trim().replace(/\s+/g, ' ')
  const description = draft.description.trim()
  if (!name || name.length > NAME_LIMIT) {
    return {
      ok: false,
      error: `Category names need 1–${NAME_LIMIT} characters.`,
    }
  }
  if (!description || description.length > DESCRIPTION_LIMIT) {
    return {
      ok: false,
      error: `Descriptions need 1–${DESCRIPTION_LIMIT} characters.`,
    }
  }
  const key = normalizeCategoryName(name)
  const others = existing.filter((category) => category.id !== ignoreId)
  if (others.some((category) => normalizeCategoryName(category.name) === key)) {
    return { ok: false, error: 'A category with this name already exists.' }
  }
  const near = others.find((category) => {
    const other = normalizeCategoryName(category.name)
    return (
      other.includes(key) || key.includes(other) || levenshtein(key, other) <= 2
    )
  })
  return {
    ok: true,
    name,
    description,
    warning: near ? `“${name}” is similar to “${near.name}”.` : null,
  }
}
