export interface DeviceOption {
  label: string
  value: string
  description: string
  id: string
  name: string
  deviceType: string
  iosVersion?: string
}

export interface ApplicationOption {
  label: string
  value: string
  description: string
  bundleId: string
  name: string
  isRecentlyUsed: boolean
}

export interface AppHeaderContainerProps {
  // No external props needed for the container
}

export interface AppHeaderPresenterProps {
  devicesSelectOptions: DeviceOption[]
  applicationSelectOptions: ApplicationOption[]
  selectedDevice: any
  selectedApplication: any
  isLoading: boolean
  isRefreshing: boolean
  isVirtualDeviceModalOpen: boolean
  isPackageSetModalOpen: boolean
  onDeviceChange: (value: any) => void
  onPackageChange: (value: any) => void
  onRefreshDevices: () => void
  onOpenVirtualDeviceModal: () => void
  onCloseVirtualDeviceModal: () => void
  onClosePackageSetModal: () => void
}
