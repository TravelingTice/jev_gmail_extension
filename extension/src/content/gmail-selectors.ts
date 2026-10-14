export const ROW_SELECTOR = 'tr.zA'
export const UNREAD_CLASS = 'zE'
export const LIST_SELECTOR = '.Cp'
export const MAIN_SELECTOR = 'div[role="main"]'
export const SENDER_SELECTOR = 'span.zF'
export const SUBJECT_SELECTOR = 'span.bqe, [data-thread-id]'
export const SNIPPET_SELECTOR = 'span.y2'
export const SNIPPET_PREFIX_SELECTOR = 'span.Zt'
export const DATE_SELECTOR = 'td.xW'
export const SUBJECT_MOUNT_SELECTOR = 'div.y6'
export const TAB_SELECTOR = '[role="tab"][aria-selected="true"]'

export const isHidden = (element: Element): boolean => {
  let current: Element | null = element
  while (current) {
    if (current instanceof HTMLElement) {
      if (current.hidden) return true
      const style = current.ownerDocument.defaultView?.getComputedStyle(current)
      if (style?.display === 'none' || style?.visibility === 'hidden')
        return true
    }
    current = current.parentElement
  }
  return false
}
