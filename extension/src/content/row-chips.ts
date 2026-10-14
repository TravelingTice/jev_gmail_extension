import { textOn } from '../domain/categories'

export type ChipModel = {
  threadId: string
  names: { id: string; name: string; color: string }[]
}

const element = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, string> = {},
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(props)) {
    if (key === 'className') node.className = value
    else node.setAttribute(key, value)
  }
  if (text != null) node.textContent = text
  return node
}

export const removeChips = (row: ParentNode): void => {
  for (const host of row.querySelectorAll('[data-gec-chip]')) host.remove()
}

export const syncChip = (
  mount: HTMLElement,
  model: ChipModel,
  css: string,
  theme: 'light' | 'dark',
): void => {
  const existing = mount.querySelector('[data-gec-chip]')
  if (model.names.length === 0) {
    existing?.remove()
    return
  }
  const host =
    existing instanceof HTMLElement
      ? existing
      : element('span', {
          'data-gec-chip': '',
          'data-thread-id': model.threadId,
        })
  if (!(existing instanceof HTMLElement)) {
    const stop = (event: Event) => event.stopPropagation()
    host.addEventListener('click', stop)
    host.addEventListener('mousedown', stop)
    host.addEventListener('pointerdown', stop)
    host.addEventListener('keydown', stop)
  }
  host.dataset.theme = theme
  host.style.display = 'inline-flex'
  host.style.flex = '0 0 auto'
  host.style.marginRight = '4px'
  if (mount.firstElementChild !== host) mount.prepend(host)
  const signature = JSON.stringify({ model, theme })
  if (host.dataset.signature === signature) return
  host.dataset.signature = signature
  host.dataset.threadId = model.threadId
  host.dataset.theme = theme
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
  while (shadow.firstChild) shadow.firstChild.remove()
  const style = element('style')
  style.textContent = css
  const root = element('span', { className: 'gec-chips' })
  for (const chip of model.names) {
    const node = element('span', { className: 'gec-chip' }, chip.name)
    node.style.background = chip.color
    node.style.color = textOn(chip.color)
    node.style.borderColor = 'transparent'
    root.append(node)
  }
  shadow.append(style, root)
}
