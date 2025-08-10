import type { CustomQueryModalPresenterProps } from './types'

import { Textarea } from '@chakra-ui/react'

import { FLModal } from '@renderer/shared/components/ui'

import { memo } from 'react'

/**
 * CustomQueryModalPresenter - Pure UI component for SQL query modal
 * 
 * Renders a modal with a textarea for SQL query input and execution controls.
 * Contains no business logic - all state and actions are managed by the Container.
 */
const CustomQueryModalPresenterImpl: React.FC<CustomQueryModalPresenterProps> = ({
  isOpen,
  query,
  onQueryChange,
  onExecute,
  onClose,
  isDisabled,
}) => {
  return (
    <FLModal
      isOpen={isOpen}
      body={(
        <Textarea
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          placeholder="SELECT * FROM table_name WHERE condition"
          height="200px"
          fontFamily="monospace"
        />
      )}
      title="Run Query"
      acceptBtn="Run Query"
      onAccept={onExecute}
      rejectBtn="Cancel"
      onReject={onClose}
      disabled={isDisabled}
    />
  )
}

export const CustomQueryModalPresenter = memo(CustomQueryModalPresenterImpl)
