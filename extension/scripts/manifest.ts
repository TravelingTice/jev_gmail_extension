import { EXTENSION_DESCRIPTION, EXTENSION_NAME } from '../src/shared/limits'

const icons = {
  '16': 'icons/icon16.png',
  '32': 'icons/icon32.png',
  '48': 'icons/icon48.png',
  '128': 'icons/icon128.png',
}

export const buildManifest = (mode: 'production' | 'test') => {
  const matches = ['https://mail.google.com/*']
  const hosts = [
    'https://mail.google.com/*',
    'https://api.typesafe.ai/*',
    'https://gmailclass.ticekralt.com/*',
  ]
  if (mode === 'test') {
    matches.push('http://127.0.0.1:4173/*')
    hosts.push('http://127.0.0.1:4173/*')
  }
  return {
    manifest_version: 3 as const,
    name: EXTENSION_NAME,
    version: '0.1.0',
    description: EXTENSION_DESCRIPTION,
    action: {
      default_title: EXTENSION_NAME,
      default_popup: 'popup.html',
      default_icon: icons,
    },
    options_page: 'options.html',
    background: {
      service_worker: 'background.js',
      type: 'module' as const,
    },
    icons,
    content_scripts: [
      {
        matches,
        js: ['content.js'],
        run_at: 'document_idle' as const,
        all_frames: false,
      },
    ],
    permissions: ['storage', 'alarms'],
    host_permissions: hosts,
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
  }
}
