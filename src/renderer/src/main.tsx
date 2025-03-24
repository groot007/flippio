import React from 'react'

import ReactDOM from 'react-dom/client'
import App from './App'
import './assets/main.css'

declare global {
  interface Window {
    api: {
      // ADB operations
      getDevices: () => Promise<any>
      getIOSPackages: (id: string) => Promise<any>
      getAndroidPackages: (id: string) => Promise<any>
    }
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
