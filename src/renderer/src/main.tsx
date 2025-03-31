import * as Sentry from '@sentry/electron/renderer'

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './assets/main.css'

if (window.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: 'https://561d196b910f78c86856522f199f9ef6@o4509048883970048.ingest.de.sentry.io/4509048886132816',
    environment: 'production',
  })
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
