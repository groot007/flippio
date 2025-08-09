import type { ChangeEvent } from '@renderer/types/changeHistory'
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
import { useClearAllChangeHistoryMutation } from '@renderer/hooks/useChangeHistoryMutations'
import { useCurrentDatabaseSelection, useCurrentDeviceSelection } from '@renderer/store'
import { useColorMode } from '@renderer/ui/color-mode'
import { formatOperationType, getOperationBadgeColor, getOperationTextColor, getOperationTypeString } from '@renderer/utils/operationTypeUtils'
import { useQueryClient } from '@tanstack/react-query'
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
  const queryClient = useQueryClient()
  
  const { selectedDevice, selectedApplication } = useCurrentDeviceSelection()
  const { selectedDatabaseFile } = useCurrentDatabaseSelection()
  
  const {
    data: changes = [],
    isLoading,
    error,
    refetch,
  } = useChangeHistory(50, 0)
  
  const clearHistoryMutation = useClearAllChangeHistoryMutation()

  const handleClearHistory = async () => {
    try {
      console.log('🧹 [UI] User confirmed - starting clear mutation...')
        
      const deviceId = selectedDevice?.id
      const packageName = selectedApplication?.bundleId || selectedDatabaseFile?.packageName
      const databasePath = selectedDatabaseFile?.path
        
      if (deviceId && packageName && databasePath) {
        queryClient.setQueryData(['changeHistory', deviceId, packageName, databasePath, 50, 0], [])
      }
        
      await clearHistoryMutation.mutateAsync()
        
      if (deviceId && packageName && databasePath) {
        queryClient.removeQueries({
          queryKey: ['changeHistory'],
        })
          
        queryClient.setQueryData(['changeHistory', deviceId, packageName, databasePath, 50, 0], [])
      }
        
      await refetch()        
    }
    catch (error) {
      console.error('🧹 [UI] Failed to clear history:', error)
    }
  }

  const handleRefresh = async () => {
    console.log('🔄 [UI] Refresh button clicked')
    try {
      console.log('🔄 [UI] Calling refetch...')
      const result = await refetch()
      console.log('🔄 [UI] Refetch result:', result)
    }
    catch (error) {
      console.error('🔄 [UI] Failed to refresh history:', error)
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
                  onClick={handleRefresh}
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
                  loading={clearHistoryMutation.isPending}
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
                  p={2}
                  bg={isDark ? 'gray.800' : 'gray.100'}
                  borderRadius="md"
                  opacity={0.7}
                >
                  <Stack gap={1}>
                    <Text fontSize="xs" color={isDark ? 'gray.500' : 'gray.600'}>
                      <Text as="span" fontWeight="bold" color={isDark ? 'gray.400' : 'gray.500'}>Device:</Text> 
                      {' '}
                      {selectedDevice?.name || 'Custom File'}
                    </Text>
                    <Text fontSize="xs" color={isDark ? 'gray.500' : 'gray.600'}>
                      <Text as="span" fontWeight="bold" color={isDark ? 'gray.400' : 'gray.500'}>App:</Text> 
                      {' '}
                      {selectedApplication?.name || selectedDatabaseFile?.packageName || 'Direct File Access'}
                    </Text>
                    <Text fontSize="xs" color={isDark ? 'gray.500' : 'gray.600'}>
                      <Text as="span" fontWeight="bold" color={isDark ? 'gray.400' : 'gray.500'}>Database:</Text> 
                      {' '}
                      {selectedDatabaseFile?.filename || 'Unknown'}
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
                      Error loading changes: 
                      {' '}
                      {error.message}
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
                    {[...changes].reverse().map((change) => {
                      const operationTypeStr = getOperationTypeString(change.operationType)
                      return (
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
                          transition="all 0.2s ease"
                        >
                          {/* Change Header */}
                          <Flex justify="space-between" align="center" w="full" mb={2}>
                            <Flex align="center" gap={2}>
                              <Badge
                                backgroundColor={getOperationBadgeColor(operationTypeStr, isDark)}
                                color={getOperationTextColor(operationTypeStr, isDark)}
                                variant="solid"
                                fontSize="xs"
                              >
                                {formatOperationType(change.operationType)}
                              </Badge>
                            </Flex>
                            <Text fontSize="xs" color={isDark ? 'gray.400' : 'gray.500'}>
                              {formatDistanceToNow(new Date(change.timestamp), { addSuffix: true })}
                            </Text>
                          </Flex>

                          <Text fontSize="sm" color={isDark ? 'gray.300' : 'gray.700'} mb={1}>
                            Table: 
                            {' '}
                            {change.tableName}
                          </Text>

                          {change.metadata.affectedRows > 0 && (
                            <Text fontSize="xs" color={isDark ? 'gray.400' : 'gray.500'} mb={2}>
                              {change.metadata.affectedRows}
                              {' '}
                              row
                              {change.metadata.affectedRows === 1 ? '' : 's'}
                              {' '}
                              affected
                            </Text>
                          )}

                          {/* Expanded Details */}
                          {selectedChange?.id === change.id && (
                            <Box w="full" pt={2} borderTop="1px" borderColor={isDark ? 'gray.600' : 'gray.200'}>
                              <Text fontSize="sm" fontWeight="bold" mb={2} color={isDark ? 'gray.200' : 'gray.800'}>Field Changes:</Text>
                              {change.changes.length === 0
                                ? (
                                    <Text fontSize="sm" color={isDark ? 'gray.400' : 'gray.500'} mb={2}>No field changes recorded</Text>
                                  )
                                : (
                                    <Stack gap={2} mb={2}>
                                      {change.changes.map((fieldChange, idx) => (
                                        <Box key={idx} fontSize="xs">
                                          <Text fontWeight="bold" mb={1} color={isDark ? 'gray.300' : 'gray.700'}>
                                            {fieldChange.fieldName}
                                            :
                                          </Text>
                                          <Flex direction="column" gap={1}>
                                            <Text color="red.500">
                                              - 
                                              {' '}
                                              {fieldChange.oldValue !== null ? String(fieldChange.oldValue) : 'null'}
                                            </Text>
                                            <Text color="green.500">
                                              + 
                                              {' '}
                                              {fieldChange.newValue !== null ? String(fieldChange.newValue) : 'null'}
                                            </Text>
                                          </Flex>
                                        </Box>
                                      ))}
                                    </Stack>
                                  )}
                              
                              {/* {change.metadata.sqlStatement && (
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
                              )} */}
                            </Box>
                          )}
                        </Box>
                      )
                    })}
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
