import { createRoot, type Root } from 'react-dom/client'
import { ExtensionBar } from '../ui/panel/Panel'

const roots = new WeakMap<HTMLElement, Root>()

export const ensureBar = (): HTMLElement => {
  for (const node of document.querySelectorAll('[data-gec-root]')) {
    if (node.parentElement !== document.body) node.remove()
  }
  const found = document.body.querySelector(':scope > [data-gec-root]')
  const host =
    found instanceof HTMLElement ? found : document.createElement('div')
  if (!(found instanceof HTMLElement)) {
    host.setAttribute('data-gec-root', '')
    host.style.position = 'fixed'
    host.style.right = '20px'
    host.style.bottom = '20px'
    host.style.zIndex = '2147483646'
    document.body.append(host)
  }
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
  const mount = shadow.querySelector('.gec-mount')
  const app =
    mount instanceof HTMLElement ? mount : document.createElement('div')
  if (!(mount instanceof HTMLElement)) {
    app.className = 'gec-mount'
    shadow.append(app)
  }
  return app
}

export const renderBar = (
  app: HTMLElement,
  css: string,
  props: Parameters<typeof ExtensionBar>[0],
): void => {
  let style = app.parentElement?.querySelector('style')
  const shadow = app.getRootNode()
  if (shadow instanceof ShadowRoot && !shadow.querySelector('style')) {
    style = document.createElement('style')
    style.textContent = css
    shadow.insertBefore(style, app)
  }
  let root = roots.get(app)
  if (!root) {
    root = createRoot(app)
    roots.set(app, root)
  }
  root.render(<ExtensionBar {...props} />)
}
