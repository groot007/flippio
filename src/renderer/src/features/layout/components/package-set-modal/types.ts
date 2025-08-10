export interface PackageSetModalProps {
  isOpen: boolean
  isLoading: boolean
  onClose: () => void
  onPackageSet: () => void
}

export interface PackageSetModalPresenterProps {
  isOpen: boolean
  isLoading: boolean
  bundleIDInput: string
  recentBundleIds: string[]
  onBundleIdChange: (value: string) => void
  onSelectRecentBundleId: (bundleId: string) => void
  onAccept: () => void
  onReject: () => void
}
