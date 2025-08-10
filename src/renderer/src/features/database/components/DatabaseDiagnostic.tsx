import { Box, Button, Flex, Icon, Stack, Text } from '@chakra-ui/react'
import React, { useState } from 'react'
import { FaCheckCircle, FaExclamationTriangle, FaInfoCircle, FaTools } from 'react-icons/fa'
import tauriApi from '../../../tauri-api'

interface DatabaseDiagnostic {
  file_exists: boolean
  file_size: number
  is_readable: boolean
  is_writable: boolean
  has_sqlite_header: boolean
  sqlite_version?: string
  wal_files_present: string[]
  corruption_detected: boolean
  integrity_check_passed: boolean
  recommendations: string[]
}

interface DatabaseDiagnosticProps {
  filePath: string
  onClose?: () => void
}

export function DatabaseDiagnosticComponent({ filePath, onClose }: DatabaseDiagnosticProps) {
  const [diagnostic, setDiagnostic] = useState<DatabaseDiagnostic | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runDiagnostic = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const result = await tauriApi.diagnoseCorruption(filePath)
      
      if (result.success && result.data) {
        setDiagnostic(result.data)
      }
      else {
        setError(result.error || 'Failed to run diagnostic')
      }
    }
    catch (err) {
      console.error('Diagnostic error:', err)
      setError((err as Error).message || 'Unexpected error occurred')
    }
    finally {
      setIsLoading(false)
    }
  }

  const getStatusIcon = (isGood: boolean) => {
    return isGood
      ? (
          <Icon as={FaCheckCircle} color="green.500" />
        )
      : (
          <Icon as={FaExclamationTriangle} color="red.500" />
        )
  }

  const getStatusColor = (diagnostic: DatabaseDiagnostic) => {
    if (diagnostic.corruption_detected) 
      return 'red.50'
    if (!diagnostic.file_exists || !diagnostic.has_sqlite_header || !diagnostic.is_writable) 
      return 'yellow.50'
    return 'green.50'
  }

  const getStatusBorderColor = (diagnostic: DatabaseDiagnostic) => {
    if (diagnostic.corruption_detected) 
      return 'red.200'
    if (!diagnostic.file_exists || !diagnostic.has_sqlite_header || !diagnostic.is_writable) 
      return 'yellow.200'
    return 'green.200'
  }

  return (
    <Box p={6} borderWidth={1} borderRadius="md" bg="bgPrimary" borderColor="borderPrimary">
      <Stack gap={4}>
        <Flex align="center" gap={2}>
          <Icon as={FaTools} color="textSecondary" />
          <Text fontSize="lg" fontWeight="bold" color="textPrimary">Database Diagnostic</Text>
        </Flex>
        
        <Text fontSize="sm" color="textSecondary">
          File: 
          {' '}
          {filePath}
        </Text>

        <Flex gap={2}>
          <Button
            onClick={runDiagnostic}
            loading={isLoading}
            loadingText="Running diagnostic..."
            colorScheme="blue"
            size="sm"
            bg="flipioPrimary"
            _hover={{ bg: 'flipioSecondary' }}
          >
            Run Diagnostic
          </Button>
          {onClose && (
            <Button onClick={onClose} size="sm" variant="outline">
              Close
            </Button>
          )}
        </Flex>

        {error && (
          <Box p={4} bg="red.50" borderColor="red.200" borderWidth={1} borderRadius="md">
            <Flex align="center" gap={2}>
              <Icon as={FaExclamationTriangle} color="red.500" />
              <Text fontWeight="semibold" color="red.800">Diagnostic Error</Text>
            </Flex>
            <Text color="red.700" mt={1}>{error}</Text>
          </Box>
        )}

        {diagnostic && (
          <Stack gap={3}>
            <Box 
              p={4} 
              bg={getStatusColor(diagnostic)} 
              borderColor={getStatusBorderColor(diagnostic)} 
              borderWidth={1} 
              borderRadius="md"
            >
              <Flex align="center" gap={2}>
                <Icon 
                  as={diagnostic.corruption_detected ? FaExclamationTriangle : FaInfoCircle} 
                  color={diagnostic.corruption_detected ? 'red.500' : 'blue.500'} 
                />
                <Text fontWeight="semibold" color="textPrimary">
                  {diagnostic.corruption_detected
                    ? 'Database Issues Detected' 
                    : !diagnostic.file_exists
                        ? 'File Not Found'
                        : !diagnostic.has_sqlite_header
                            ? 'Invalid SQLite File'
                            : 'Database Status'}
                </Text>
              </Flex>
              <Text color="textSecondary" mt={1}>
                {diagnostic.corruption_detected
                  ? 'This database has corruption issues that need attention.'
                  : !diagnostic.file_exists
                      ? 'The database file could not be found at the specified path.'
                      : !diagnostic.has_sqlite_header
                          ? 'This file does not appear to be a valid SQLite database.'
                          : 'Database appears to be healthy.'}
              </Text>
            </Box>

            <Box>
              <Text fontWeight="semibold" mb={2} color="textPrimary">File Information</Text>
              <Stack gap={1} fontSize="sm">
                <Flex align="center" gap={2}>
                  {getStatusIcon(diagnostic.file_exists)}
                  <Text color="textPrimary">
                    File exists:
                    {diagnostic.file_exists ? 'Yes' : 'No'}
                  </Text>
                </Flex>
                <Flex align="center" gap={2}>
                  {getStatusIcon(diagnostic.file_size > 0)}
                  <Text color="textPrimary">
                    File size:
                    {diagnostic.file_size.toLocaleString()}
                    {' '}
                    bytes
                  </Text>
                </Flex>
                <Flex align="center" gap={2}>
                  {getStatusIcon(diagnostic.is_readable)}
                  <Text color="textPrimary">
                    Readable:
                    {diagnostic.is_readable ? 'Yes' : 'No'}
                  </Text>
                </Flex>
                <Flex align="center" gap={2}>
                  {getStatusIcon(diagnostic.is_writable)}
                  <Text color="textPrimary">
                    Writable:
                    {diagnostic.is_writable ? 'Yes' : 'No'}
                  </Text>
                </Flex>
              </Stack>
            </Box>

            <Box>
              <Text fontWeight="semibold" mb={2} color="textPrimary">SQLite Information</Text>
              <Stack gap={1} fontSize="sm">
                <Flex align="center" gap={2}>
                  {getStatusIcon(diagnostic.has_sqlite_header)}
                  <Text color="textPrimary">
                    Valid SQLite header:
                    {diagnostic.has_sqlite_header ? 'Yes' : 'No'}
                  </Text>
                </Flex>
                {diagnostic.sqlite_version && (
                  <Flex align="center" gap={2}>
                    <Icon as={FaInfoCircle} color="blue.500" />
                    <Text color="textPrimary">
                      SQLite version:
                      {diagnostic.sqlite_version}
                    </Text>
                  </Flex>
                )}
                <Flex align="center" gap={2}>
                  {getStatusIcon(diagnostic.integrity_check_passed)}
                  <Text color="textPrimary">
                    Integrity check:
                    {diagnostic.integrity_check_passed ? 'Passed' : 'Failed'}
                  </Text>
                </Flex>
                <Flex align="center" gap={2}>
                  {getStatusIcon(!diagnostic.corruption_detected)}
                  <Text color="textPrimary">
                    Corruption detected:
                    {diagnostic.corruption_detected ? 'Yes' : 'No'}
                  </Text>
                </Flex>
              </Stack>
            </Box>

            {diagnostic.wal_files_present.length > 0 && (
              <Box>
                <Text fontWeight="semibold" mb={2} color="textPrimary">WAL Files</Text>
                <Stack gap={1} fontSize="sm">
                  {diagnostic.wal_files_present.map((file, index) => (
                    <Flex key={index} align="center" gap={2}>
                      <Icon as={FaExclamationTriangle} color="orange.500" />
                      <Text color="textPrimary">{file}</Text>
                    </Flex>
                  ))}
                </Stack>
              </Box>
            )}

            {diagnostic.recommendations.length > 0 && (
              <Box>
                <Text fontWeight="semibold" mb={2} color="textPrimary">Recommendations</Text>
                <Stack gap={1} fontSize="sm">
                  {diagnostic.recommendations.map((rec, index) => (
                    <Flex key={index} align="start" gap={2}>
                      <Icon as={FaInfoCircle} color="blue.500" style={{ marginTop: '2px', flexShrink: 0 }} />
                      <Text color="textSecondary">{rec}</Text>
                    </Flex>
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        )}
      </Stack>
    </Box>
  )
}

export default DatabaseDiagnosticComponent
