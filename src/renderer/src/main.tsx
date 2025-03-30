import * as Sentry from '@sentry/electron/renderer'

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './assets/main.css'

if (window.env.NODE_ENV === 'production') {
  Sentry.init({
    integrations: [
    ],
  })
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
