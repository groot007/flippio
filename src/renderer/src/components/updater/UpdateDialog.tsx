import type { FC } from 'react'
import { toaster } from '@renderer/ui/toaster'
import { useEffect } from 'react'

interface UpdateDialogProps {
  isOpen: boolean
  onClose: () => void
  updateInfo: {
    version?: string
    releaseNotes?: string
    releaseDate?: string
  }
  onUpdate: () => void
  isDownloading: boolean
}

export const UpdateDialog: FC<UpdateDialogProps> = ({
  isOpen,
  updateInfo,
  onUpdate,
}) => {
  useEffect(() => {
    if (isOpen && updateInfo.version) {
      // Show a toast notification for updates
      toaster.create({
        title: 'Update Available',
        description: `Version ${updateInfo.version} is now available. Would you like to update now?`,
        type: 'info',
        duration: 10000, // 10 seconds
      })
    }
  }, [isOpen, updateInfo.version, onUpdate])

  // This component doesn't render anything visually
  // The notification is handled through the toast system
  return null
}
