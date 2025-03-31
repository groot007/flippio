import type { ElectronAPI } from '@electron-toolkit/preload'

interface IElectronAPI {
  // Device methods
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: IElectronAPI
  }
}
