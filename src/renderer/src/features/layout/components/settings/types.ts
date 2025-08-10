export interface SettingsProps {}

export interface SettingsPresenterProps {
  version: string
  isChecking: boolean
  onCheckForUpdates: () => Promise<void>
}
