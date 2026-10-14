import { EXTENSION_NAME } from '../../shared/limits'
import logoUrl from '../../../assets/brand/logo-ui.png?inline'

type Props = {
  theme: 'light' | 'dark'
  enabled: boolean
  loading: boolean
  onSettings: () => void
}

export const ExtensionBar = ({
  theme,
  enabled,
  loading,
  onSettings,
}: Props) => {
  const status = enabled
    ? `${EXTENSION_NAME} is enabled`
    : `${EXTENSION_NAME} is off`
  return (
    <div
      className="gec-app gec-launcher"
      data-theme={theme}
      data-testid="extension-bar"
    >
      <button
        type="button"
        className="gec-logo-button"
        data-testid="open-settings"
        aria-label={`${status}. Click to go to settings`}
        onClick={onSettings}
      >
        <img className="gec-mark" src={logoUrl} alt="" />
        {loading ? (
          <span className="gec-tooltip gec-tooltip-loading" role="status">
            <span className="gec-spinner" aria-hidden="true" />
            Loading labels
          </span>
        ) : (
          <span className="gec-tooltip" role="tooltip">
            Click to go to settings
          </span>
        )}
      </button>
    </div>
  )
}
