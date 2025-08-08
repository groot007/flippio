import type { ChangeEvent } from '@renderer/hooks/useChangeHistory'
import {
  Badge,
  Box,
  Button,
  Drawer,
  Flex,
  IconButton,
  Portal,
  Stack,
  Text,
} from '@chakra-ui/react'
import { useChangeHistory } from '@renderer/hooks/useChangeHistory'
import { useClearChangeHistoryMutation } from '@renderer/hooks/useChangeHistoryMutations'
import { useCurrentDatabaseSelection, useCurrentDeviceSelection } from '@renderer/store'
import { useColorMode } from '@renderer/ui/color-mode'
import { formatDistanceToNow } from 'date-fns'
import { useState } from 'react'
import { LuClock, LuDatabase, LuRefreshCw, LuTrash2, LuX } from 'react-icons/lu'

interface ChangeHistoryPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function ChangeHistoryPanel({ isOpen, onClose }: ChangeHistoryPanelProps) {
  const { colorMode } = useColorMode()
  const isDark = colorMode === 'dark'
  const [selectedChange, setSelectedChange] = useState<ChangeEvent | null>(null)
  
  const { selectedDevice, selectedApplication } = useCurrentDeviceSelection()
  const { selectedDatabaseFile } = useCurrentDatabaseSelection()
  
  const {
    data: changes = [],
    isLoading,
    error,
    refetch
  } = useChangeHistory(50, 0)
  
  // Debug logging for changes
  console.log('🔍 [ChangeHistoryPanel] Changes data:', changes)
  console.log('🔍 [ChangeHistoryPanel] Changes length:', changes.length)
  if (changes.length > 0) {
    changes.forEach((change, index) => {
      console.log(`🔍 [ChangeHistoryPanel] Change ${index}:`, {
        operationType: change.operationType,
        tableName: change.tableName,
        timestamp: change.timestamp,
        id: change.id
      })
    })
  }
  
  const clearHistoryMutation = useClearChangeHistoryMutation()

  const handleClearHistory = () => {
    // eslint-disable-next-line no-alert
    if (window.confirm('Are you sure you want to clear all change history for this database?')) {
      clearHistoryMutation.mutate()
    }
  }

  const formatOperationType = (operationType: ChangeEvent['operationType']) => {
    // Handle Rust enum serialization
    if (typeof operationType === 'string') {
      return operationType
    }
    
    // Handle complex operation types from Rust enum variants
    if (typeof operationType === 'object' && operationType !== null) {
      // Handle BulkInsert, BulkUpdate, BulkDelete: { "BulkUpdate": { "count": 5 } }
      if ('BulkInsert' in operationType) {
        return `Bulk Insert (${(operationType as any).BulkInsert.count} rows)`
      }
      if ('BulkUpdate' in operationType) {
        return `Bulk Update (${(operationType as any).BulkUpdate.count} rows)`
      }
      if ('BulkDelete' in operationType) {
        return `Bulk Delete (${(operationType as any).BulkDelete.count} rows)`
      }
      if ('Revert' in operationType) {
        return 'Revert'
      }
      
      // Handle legacy format with type property
      if ('type' in operationType) {
        const op = operationType as any
        if (op.count) {
          return `${op.type} (${op.count} rows)`
        }
        return op.type
      }
    }
    
    // Fallback
    return String(operationType)
  }

  const getOperationTypeString = (operationType: ChangeEvent['operationType']): string => {
    if (typeof operationType === 'string') {
      return operationType
    }
    
    if (typeof operationType === 'object' && operationType !== null) {
      // Handle Rust enum variants
      if ('BulkInsert' in operationType) return 'insert'
      if ('BulkUpdate' in operationType) return 'update'
      if ('BulkDelete' in operationType) return 'delete'
      if ('Revert' in operationType) return 'revert'
      
      // Handle legacy format
      if ('type' in operationType) {
        return (operationType as any).type
      }
    }
    
    return 'unknown'
  }

  const getOperationColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'insert':
        return 'green'
      case 'update':
        return 'blue'
      case 'delete':
        return 'red'
      case 'clear':
        return 'orange'
      default:
        return 'gray'
    }
  }

  return (
    <Drawer.Root open={isOpen} onOpenChange={() => onClose()} placement="end">
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content maxWidth="500px" width="100%">
            <Drawer.Header pr={16}>
              <Drawer.Title>
                <Flex align="center" gap={2}>
                  <LuClock />
                  <Text>Change History</Text>
                </Flex>
              </Drawer.Title>
              <Flex gap={2}>
                <IconButton
                  aria-label="Refresh history"
                  size="sm"
                  variant="ghost"
                  onClick={() => refetch()}
                  disabled={isLoading}
                >
                  <LuRefreshCw />
                </IconButton>
                <IconButton
                  aria-label="Clear history"
                  size="sm"
                  variant="ghost"
                  colorScheme="red"
                  onClick={handleClearHistory}
                  disabled={clearHistoryMutation.isPending}
                >
                  <LuTrash2 />
                </IconButton>
                <Drawer.CloseTrigger asChild>
                  <IconButton
                    aria-label="Close panel"
                    size="xl"
                    bg="transparent"
                    color="gray.400"
                  >
                    <LuX size={64} />
                  </IconButton>
                </Drawer.CloseTrigger>
              </Flex>
            </Drawer.Header>
            
            <Drawer.Body>
              <Stack gap={4}>
                {/* Context Info */}
                <Box
                  p={3}
                  bg={isDark ? 'gray.700' : 'gray.50'}
                  borderRadius="md"
                >
                  <Text fontSize="sm" color="gray.500" mb={2}>Current Context</Text>
                  <Stack gap={1}>
                    <Text fontSize="sm">
                      <Text as="span" fontWeight="bold">Device:</Text> {selectedDevice?.name || 'Unknown'}
                    </Text>
                    <Text fontSize="sm">
                      <Text as="span" fontWeight="bold">App:</Text> {selectedApplication?.name || selectedDatabaseFile?.packageName || 'Unknown'}
                    </Text>
                    <Text fontSize="sm">
                      <Text as="span" fontWeight="bold">Database:</Text> {selectedDatabaseFile?.filename || 'Unknown'}
                    </Text>
                  </Stack>
                </Box>

                {/* Loading State */}
                {isLoading && (
                  <Text textAlign="center" color="gray.500">
                    Loading change history...
                  </Text>
                )}

                {/* Error State */}
                {error && (
                  <Box
                    p={3}
                    bg="red.50"
                    borderRadius="md"
                    borderLeftWidth="4px"
                    borderLeftColor="red.500"
                  >
                    <Text fontSize="sm" color="red.500">
                      Error loading changes: {error.message}
                    </Text>
                  </Box>
                )}

                {/* Empty State */}
                {!isLoading && !error && changes.length === 0 && (
                  <Box p={6} textAlign="center" bg={isDark ? 'gray.700' : 'gray.50'} borderRadius="md">
                    <Box mb={3}>
                      <LuDatabase size={48} style={{ margin: '0 auto', opacity: 0.5 }} />
                    </Box>
                    <Text color="gray.500" mb={2}>No changes recorded yet</Text>
                    <Text fontSize="sm" color="gray.400">
                      Database modifications will appear here
                    </Text>
                  </Box>
                )}

                {/* Change List */}
                {changes.length > 0 && (
                  <Stack gap={2}>
                    {changes.map((change) => (
                      <Box
                        key={change.id}
                        p={3}
                        cursor="pointer"
                        onClick={() => setSelectedChange(selectedChange?.id === change.id ? null : change)}
                        bg={selectedChange?.id === change.id ? (isDark ? 'gray.700' : 'gray.50') : undefined}
                        _hover={{ bg: isDark ? 'gray.700' : 'gray.50' }}
                        borderRadius="md"
                        borderWidth="1px"
                        borderColor={isDark ? 'gray.600' : 'gray.200'}
                      >
                        {/* Change Header */}
                        <Flex justify="space-between" align="center" w="full" mb={2}>
                          <Flex align="center" gap={2}>
                            <Badge
                              colorScheme={getOperationColor(getOperationTypeString(change.operationType))}
                              variant="solid"
                              fontSize="xs"
                            >
                              {formatOperationType(change.operationType)}
                            </Badge>
                          </Flex>
                          <Text fontSize="xs" color="gray.500">
                            {formatDistanceToNow(new Date(change.timestamp), { addSuffix: true })}
                          </Text>
                        </Flex>

                        <Text fontSize="sm" color="gray.600" mb={1}>
                          Table: {change.tableName}
                        </Text>

                        {change.metadata.affectedRows > 0 && (
                          <Text fontSize="xs" color="gray.500" mb={2}>
                            {change.metadata.affectedRows} row{change.metadata.affectedRows === 1 ? '' : 's'} affected
                          </Text>
                        )}

                        {/* Expanded Details */}
                        {selectedChange?.id === change.id && (
                          <Box w="full" pt={2} borderTop="1px" borderColor={isDark ? 'gray.600' : 'gray.200'}>
                            <Text fontSize="sm" fontWeight="bold" mb={2}>Field Changes:</Text>
                            {change.changes.length === 0 ? (
                              <Text fontSize="sm" color="gray.500" mb={2}>No field changes recorded</Text>
                            ) : (
                              <Stack gap={2} mb={2}>
                                {change.changes.map((fieldChange, idx) => (
                                  <Box key={idx} fontSize="xs">
                                    <Text fontWeight="bold" mb={1}>{fieldChange.fieldName}:</Text>
                                    <Flex direction="column" gap={1}>
                                      <Text color="red.500">
                                        - {fieldChange.oldValue !== null ? String(fieldChange.oldValue) : 'null'}
                                      </Text>
                                      <Text color="green.500">
                                        + {fieldChange.newValue !== null ? String(fieldChange.newValue) : 'null'}
                                      </Text>
                                    </Flex>
                                  </Box>
                                ))}
                              </Stack>
                            )}
                            
                            {change.metadata.sqlStatement && (
                              <Box>
                                <Text fontSize="sm" fontWeight="bold" mb={1}>SQL:</Text>
                                <Text
                                  fontSize="xs"
                                  fontFamily="mono"
                                  bg={isDark ? 'gray.900' : 'gray.100'}
                                  p={2}
                                  borderRadius="md"
                                  overflowX="auto"
                                  whiteSpace="pre-wrap"
                                >
                                  {change.metadata.sqlStatement}
                                </Text>
                              </Box>
                            )}
                          </Box>
                        )}
                      </Box>
                    ))}
                  </Stack>
                )}

                {/* Load More Button */}
                {changes.length >= 50 && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    width="full"
                    onClick={() => {
                      // TODO: Implement pagination
                    }}
                  >
                    Load More Changes
                  </Button>
                )}
              </Stack>
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  )
}
