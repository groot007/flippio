import * as Sentry from '@sentry/react'
import { getCurrentWindow } from '@tauri-apps/api/window'
// import { attachConsole } from '@tauri-apps/plugin-log'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './assets/main.css'
// Initialize Tauri API (sets up window.api) - must be imported for side effects
import './tauri-api'

// attachConsole()

if (import.meta.env.PROD && !import.meta.env.VITEST && typeof window !== 'undefined' && typeof document !== 'undefined') {
  Sentry.init({
    dsn: 'https://561d196b910f78c86856522f199f9ef6@o4509048883970048.ingest.de.sentry.io/4509048886132816',
    environment: import.meta.env.MODE || 'development',
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  })
}

const version = __APP_VERSION__
getCurrentWindow().setTitle(`Flippio - database explorer for iOS and Android v${version}`)

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
