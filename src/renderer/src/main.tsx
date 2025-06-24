import * as Sentry from '@sentry/electron/renderer'
import { attachConsole } from '@tauri-apps/plugin-log'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './assets/main.css'
// Initialize Tauri API (sets up window.api) - must be imported for side effects
import './tauri-api'

attachConsole()

Sentry.init({
  dsn: 'https://561d196b910f78c86856522f199f9ef6@o4509048883970048.ingest.de.sentry.io/4509048886132816',
})

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
