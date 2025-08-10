/**
 * PackageSetModal Component
 * 
 * This component provides a modal for setting package bundle IDs with recent history.
 * The business logic is handled in PackageSetModalContainer, while the UI rendering is in PackageSetModalPresenter.
 */

import { PackageSetModalContainer } from '@renderer/features/layout/components'

export function PackageSetModal(props: { isOpen: boolean, isLoading: boolean, onClose: () => void, onPackageSet: () => void }) {
  return <PackageSetModalContainer {...props} />
}
