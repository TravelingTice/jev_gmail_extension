import {
  DATE_SELECTOR,
  LIST_SELECTOR,
  MAIN_SELECTOR,
  ROW_SELECTOR,
  SENDER_SELECTOR,
  SNIPPET_PREFIX_SELECTOR,
  SNIPPET_SELECTOR,
  SUBJECT_MOUNT_SELECTOR,
  SUBJECT_SELECTOR,
  TAB_SELECTOR,
  UNREAD_CLASS,
  isHidden,
} from './gmail-selectors'

export type GmailView =
  'primary' | 'inboxTabs' | 'labels' | 'search' | 'thread' | 'unsupported'

const THREAD_ID = /^[A-Za-z0-9]{16,}$/

const hashParts = (hash: string): string[] => {
  const clean = hash.replace(/^#/, '').split('?')[0] ?? ''
  return clean
    .split('/')
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part)
      } catch {
        return part
      }
    })
}

export const classifyHash = (hash: string): GmailView => {
  const parts = hashParts(hash)
  const head = parts[0]
  if (!head || head === 'inbox') {
    if (parts[1] && THREAD_ID.test(parts[1])) return 'thread'
    return 'primary'
  }
  if (head === 'category') {
    if (parts[2] && THREAD_ID.test(parts[2])) return 'thread'
    return 'inboxTabs'
  }
  if (head === 'search' || head === 'advanced-search') {
    const last = parts[parts.length - 1]
    if (parts.length >= 3 && last && THREAD_ID.test(last)) return 'thread'
    return 'search'
  }
  if (head === 'label') {
    if (parts[2] && THREAD_ID.test(parts[2])) return 'thread'
    return 'labels'
  }
  return 'unsupported'
}

export const isVerifiedThreadUrl = (url: string, threadId: string): boolean => {
  if (!/^[A-Za-z0-9]{8,}$/.test(threadId)) return false
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'mail.google.com')
      return false
    if (!parsed.pathname.startsWith('/mail/')) return false
    return decodeURIComponent(parsed.hash).includes(`/${threadId}`)
  } catch {
    return false
  }
}

export const threadUrlFor = (
  pageUrl: string,
  legacyThreadId: string | null,
  anchorHref: string | null,
): string | null => {
  if (anchorHref && legacyThreadId) {
    try {
      const absolute = new URL(anchorHref, pageUrl).href
      if (isVerifiedThreadUrl(absolute, legacyThreadId)) return absolute
    } catch {
      /* ignore malformed anchors */
    }
  }
  if (!legacyThreadId || !/^[A-Za-z0-9]{8,}$/.test(legacyThreadId)) return null
  try {
    const current = new URL(pageUrl)
    const parts = hashParts(current.hash).filter(
      (part) => !THREAD_ID.test(part),
    )
    if (parts.length === 0) parts.push('inbox')
    const index = current.pathname.match(/\/mail\/u\/(\d+)/)?.[1] ?? '0'
    const url = `https://mail.google.com/mail/u/${index}/#${parts.join('/')}/${legacyThreadId}`
    return isVerifiedThreadUrl(url, legacyThreadId) ? url : null
  } catch {
    return null
  }
}

export const readAccountEmail = (doc: Document): string | null => {
  const fixture = doc
    .querySelector('[data-gec-account-email]')
    ?.getAttribute('data-gec-account-email')
  if (fixture?.includes('@')) return fixture.trim().toLowerCase()
  for (const node of doc.querySelectorAll(
    'a[aria-label], button[aria-label]',
  )) {
    const label = node.getAttribute('aria-label') ?? ''
    if (!/google account/i.test(label)) continue
    const match = label.match(/\(([^()\s]+@[^()\s]+)\)/)
    if (match?.[1]) return match[1].toLowerCase()
  }
  return null
}

export const findList = (doc: Document): HTMLElement | null => {
  for (const main of doc.querySelectorAll(MAIN_SELECTOR)) {
    if (!(main instanceof HTMLElement) || isHidden(main)) continue
    const lists = [...main.querySelectorAll(LIST_SELECTOR)].filter(
      (list): list is HTMLElement =>
        list instanceof HTMLElement &&
        !isHidden(list) &&
        Boolean(list.querySelector(ROW_SELECTOR)),
    )
    if (lists[0]) return lists[0]
    if (main.querySelector(ROW_SELECTOR)) return main
  }
  return null
}

export const selectedTabLabel = (doc: Document): string | null => {
  const tab = doc.querySelector(TAB_SELECTOR)
  const label = tab?.textContent?.trim().toLowerCase()
  return label || null
}

export type ExtractedRow = {
  threadId: string
  legacyThreadId: string | null
  senderName: string | null
  senderAddress: string | null
  subject: string | null
  snippet: string | null
  dateLabel: string | null
  unread: boolean
  listIndex: number
  threadUrl: string | null
  row: HTMLTableRowElement
}

const textOf = (node: Element | null): string | null => {
  const text = node?.textContent?.replace(/\s+/g, ' ').trim()
  return text || null
}

export const extractRows = (
  list: ParentNode,
  pageUrl: string,
): ExtractedRow[] => {
  const extracted: ExtractedRow[] = []
  let listIndex = 0
  for (const node of list.querySelectorAll(ROW_SELECTOR)) {
    if (!(node instanceof HTMLTableRowElement)) continue
    const subjectNode = node.querySelector(SUBJECT_SELECTOR)
    const threadId =
      subjectNode?.getAttribute('data-thread-id') ||
      node.getAttribute('data-legacy-thread-id') ||
      ''
    if (!threadId) continue
    const legacyThreadId =
      subjectNode?.getAttribute('data-legacy-thread-id') ||
      node.getAttribute('data-legacy-thread-id')
    const sender = node.querySelector(SENDER_SELECTOR)
    const snippetHost = node.querySelector(SNIPPET_SELECTOR)
    let snippet: string | null = null
    if (snippetHost) {
      const copy = snippetHost.cloneNode(true)
      if (copy instanceof Element) {
        for (const prefix of copy.querySelectorAll(SNIPPET_PREFIX_SELECTOR))
          prefix.remove()
        snippet = textOf(copy)
      }
    }
    const dateNode =
      node.querySelector(`${DATE_SELECTOR} span[title]`) ??
      node.querySelector(DATE_SELECTOR)
    const anchor = [...node.querySelectorAll('a[href]')]
      .map((link) => link.getAttribute('href'))
      .find((href) => href && legacyThreadId && href.includes(legacyThreadId))
    extracted.push({
      threadId,
      legacyThreadId,
      senderName: sender?.getAttribute('name') || textOf(sender),
      senderAddress: sender?.getAttribute('email') ?? null,
      subject: textOf(subjectNode),
      snippet,
      dateLabel: dateNode?.getAttribute('title') || textOf(dateNode),
      unread: node.classList.contains(UNREAD_CLASS),
      listIndex,
      threadUrl: threadUrlFor(pageUrl, legacyThreadId, anchor ?? null),
      row: node,
    })
    listIndex += 1
  }
  return extracted
}

export const chipMount = (row: HTMLTableRowElement): HTMLElement | null => {
  const line = row.querySelector('div.xT')
  if (line instanceof HTMLElement) return line
  const subject = row.querySelector(SUBJECT_MOUNT_SELECTOR)
  if (subject instanceof HTMLElement) return subject
  return null
}

export const viewIsEnabled = (
  view: GmailView,
  tabLabel: string | null,
  views: {
    primary: boolean
    inboxTabs: boolean
    labels: boolean
    search: boolean
  },
): boolean => {
  if (view === 'thread' || view === 'unsupported') return false
  if (view === 'primary' && tabLabel && tabLabel !== 'primary')
    return views.inboxTabs
  if (view === 'primary') return views.primary
  if (view === 'inboxTabs') return views.inboxTabs
  if (view === 'labels') return views.labels
  return views.search
}
