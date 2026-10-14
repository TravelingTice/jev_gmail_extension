export type Exclusions = {
  senders: string[]
  domains: string[]
}

const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/
const DOMAIN = /^[a-z0-9.-]+\.[a-z]{2,}$/

export const normalizeSender = (value: string): string =>
  value.trim().toLowerCase()

export const parseExclusion = (
  value: string,
):
  | { kind: 'sender'; value: string }
  | { kind: 'domain'; value: string }
  | { error: string } => {
  const normalized = normalizeSender(value)
  if (normalized.startsWith('@')) {
    const domain = normalized.slice(1)
    if (!DOMAIN.test(domain))
      return { error: 'Enter a domain like example.com.' }
    return { kind: 'domain', value: domain }
  }
  if (EMAIL.test(normalized)) return { kind: 'sender', value: normalized }
  if (DOMAIN.test(normalized) && !normalized.includes('@'))
    return { kind: 'domain', value: normalized }
  return {
    error: 'Enter an email address or a domain. Patterns are not supported.',
  }
}

export const isExcluded = (
  address: string | null,
  exclusions: Exclusions,
): boolean => {
  if (!address) return false
  const email = normalizeSender(address)
  const domain = email.includes('@') ? email.slice(email.indexOf('@') + 1) : ''
  return (
    exclusions.senders.includes(email) ||
    (domain !== '' && exclusions.domains.includes(domain))
  )
}
