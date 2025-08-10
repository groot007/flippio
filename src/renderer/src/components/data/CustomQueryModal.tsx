/**
 * CustomQueryModal Component
 * 
 * This component now uses the Container/Presenter pattern for better separation of concerns.
 * The business logic is handled in CustomQueryModalContainer, while the UI rendering is in CustomQueryModalPresenter.
 */

import { CustomQueryModalContainer } from '@renderer/features/database/components'

export function CustomQueryModal(props: { isOpen: boolean, onClose: () => void }) {
  return <CustomQueryModalContainer {...props} />
}
