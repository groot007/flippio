import {
  Input,
  Stack,
  VStack,
} from '@chakra-ui/react'
import { useCurrentDatabaseSelection, useCurrentDeviceSelection, useTableData } from '@renderer/store'
import { toaster } from '@renderer/ui/toaster'
import { useCallback, useEffect, useState } from 'react'
import FLModal from '../common/FLModal'

interface AddNewRowModalProps {
  isOpen: boolean
  onClose: () => void
  onRowCreated: () => void
}

export const AddNewRowModal: React.FC<AddNewRowModalProps> = ({ isOpen, onClose, onRowCreated }) => {
  const { tableData } = useTableData()
  const [newRowData, setNewRowData] = useState<Record<string, any>>({})
  const [isCreatingRow, setIsCreatingRow] = useState(false)
  const { selectedDevice } = useCurrentDeviceSelection()

  const { selectedDatabaseFile, selectedDatabaseTable } = useCurrentDatabaseSelection()

  const initializeNewRowData = useCallback(() => {
    if (!tableData?.columns)
      return

    const initialData: Record<string, any> = {}
    tableData.columns.forEach((col) => {
      switch (col.type.toLowerCase()) {
        case 'integer':
        case 'int':
        case 'numeric':
          initialData[col.name] = null
          break
        case 'text':
        case 'varchar':
        case 'char':
          initialData[col.name] = ''
          break
        case 'boolean':
          initialData[col.name] = false
          break
        case 'real':
        case 'float':
        case 'double':
          initialData[col.name] = null
          break
        case 'blob':
          initialData[col.name] = null
          break
        case 'date':
        case 'datetime':
        case 'timestamp':
          initialData[col.name] = ''
          break
        default:
          initialData[col.name] = ''
      }
    })

    setNewRowData(initialData)
  }, [tableData?.columns])

  useEffect(() => {
    initializeNewRowData()
  }, [])

  const handleNewRowInputChange = useCallback((columnName: string, value: any) => {
    setNewRowData(prev => ({
      ...prev,
      [columnName]: value,
    }))
  }, [])

  const handleCreateRow = useCallback(async () => {
    if (!selectedDatabaseTable?.name || isCreatingRow)
      return

    try {
      setIsCreatingRow(true)

      const result = await window.api.insertTableRow(selectedDatabaseTable.name, newRowData)

      if (!result.success) {
        throw new Error(result.error || 'Failed to create new row')
      }

      // Push changes back to device if needed
      if (
        selectedDatabaseFile
        && selectedDevice
        && selectedDatabaseFile.packageName
        && (selectedDatabaseFile?.deviceType === 'android'
          || selectedDatabaseFile?.deviceType === 'iphone'
          || selectedDatabaseFile?.deviceType === 'iphone-device')
      ) {
        await window.api.pushDatabaseFile(
          selectedDevice.id,
          selectedDatabaseFile.path,
          selectedDatabaseFile.packageName,
          selectedDatabaseFile.remotePath || selectedDatabaseFile.path,
          selectedDatabaseFile.deviceType,
        )
      }

      toaster.create({
        title: 'Row created',
        description: 'New row has been successfully created',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })

      onRowCreated()
      onClose()
      setNewRowData({})
    }
    catch (error) {
      console.error('Error creating row:', error)
      toaster.create({
        title: 'Creation failed',
        description: error instanceof Error ? error.message : 'Failed to create new row',
        status: 'error',
        duration: 3000,
        closable: true,
      })
    }
    finally {
      setIsCreatingRow(false)
    }
  }, [selectedDatabaseTable, newRowData, onRowCreated, onClose])

  return (
    <FLModal
      isOpen={isOpen}
      body={(
        <VStack gap={4} align="stretch">
          {tableData?.columns?.map(column => (
            <Stack key={column.name}>
              {column.name}
              {' '}
              <span style={{ fontSize: '0.8em', color: 'gray' }}>
                (
                {column.type}
                )
              </span>
              <Input
                value={newRowData[column.name] || ''}
                onChange={e => handleNewRowInputChange(column.name, e.target.value)}
                placeholder={`Enter value for ${column.name}`}
                type={
                  column.type.toLowerCase().includes('int')
                    ? 'number'
                    : column.type.toLowerCase().includes('real')
                      || column.type.toLowerCase().includes('float')
                      || column.type.toLowerCase().includes('double')
                      ? 'number'
                      : column.type.toLowerCase().includes('date')
                        ? 'datetime-local'
                        : 'text'
                }
              />
            </Stack>
          ))}
        </VStack>
      )}
      title="Add New Row"
      acceptBtn="Create"
      onAccept={() => {
        handleCreateRow()
      }}
      rejectBtn="Cancel"
      onReject={() => {
        onClose()
      }}
    />
  )
}
