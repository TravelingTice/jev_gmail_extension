const extensionNode = (node: Node | null): boolean =>
  node instanceof Element &&
  Boolean(node.closest('[data-gec-root], [data-gec-chip]'))

export const isOurMutation = (mutation: MutationRecord): boolean => {
  if (extensionNode(mutation.target)) return true
  const nodes = [...mutation.addedNodes, ...mutation.removedNodes]
  return nodes.length > 0 && nodes.every((node) => extensionNode(node))
}

export const watchList = (
  list: HTMLElement,
  onChange: () => void,
): (() => void) => {
  let timer = 0
  const observer = new MutationObserver((mutations) => {
    if (mutations.every(isOurMutation)) return
    window.clearTimeout(timer)
    timer = window.setTimeout(onChange, 200)
  })
  observer.observe(list, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class'],
  })
  return () => {
    window.clearTimeout(timer)
    observer.disconnect()
  }
}
