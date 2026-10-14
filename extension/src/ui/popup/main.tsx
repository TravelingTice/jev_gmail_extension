import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { EXTENSION_NAME } from '../../shared/limits'
import type { Settings } from '../../shared/schemas'
import '../styles/app.css'
import logoUrl from '../../../assets/brand/logo-ui.png?inline'
import { loadBrandFont } from '../../shared/brand-font'

loadBrandFont()

type PopupState = {
  ok: boolean
  settings?: Settings
  hasKey?: boolean
  keySuffix?: string | null
}

const call = <T,>(message: unknown): Promise<T> =>
  chrome.runtime.sendMessage(message) as Promise<T>

const Popup = () => {
  const [state, setState] = useState<PopupState | null>(null)
  useEffect(() => {
    void (async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      })
      setState(
        await call<PopupState>({ type: 'getPopupState', tabId: tab?.id ?? 0 }),
      )
    })()
  }, [])
  const settings = state?.settings
  const enabled = Boolean(settings?.enabled && !settings.paused)
  return (
    <main className="gec-popup">
      <header className="gec-brand">
        <img src={logoUrl} alt="" width={32} height={32} />
        <strong>{EXTENSION_NAME}</strong>
      </header>
      <p data-testid="popup-enabled">{enabled ? 'Enabled' : 'Off'}</p>
      <p data-testid="popup-key">
        {state?.hasKey
          ? `TypeSafe key ends in ${state.keySuffix}`
          : 'No TypeSafe key'}
      </p>
      <button
        type="button"
        data-testid="popup-settings"
        onClick={() => void chrome.runtime.openOptionsPage()}
      >
        Settings
      </button>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<Popup />)
