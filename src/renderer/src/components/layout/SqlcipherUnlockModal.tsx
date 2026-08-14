import { Alert, Field, Input, Text, VStack } from '@chakra-ui/react'
import { useSqlcipherUnlock } from '@renderer/store'
import { ensureDatabaseUnlocked, rememberDatabaseKey } from '@renderer/utils/sqlcipher'
import { useEffect, useState } from 'react'
import FLModal from '../common/FLModal'

export function SqlcipherUnlockModal() {
  const clearRequest = useSqlcipherUnlock(state => state.clearRequest)
  const error = useSqlcipherUnlock(state => state.error)
  const isSubmitting = useSqlcipherUnlock(state => state.isSubmitting)
  const request = useSqlcipherUnlock(state => state.request)
  const setError = useSqlcipherUnlock(state => state.setError)
  const setSubmitting = useSqlcipherUnlock(state => state.setSubmitting)
  const [key, setKey] = useState('')

  useEffect(() => {
    setKey('')
  }, [request?.databaseFile.path])

  const handleReject = () => {
    clearRequest()
  }

  const handleAccept = async () => {
    if (!request) {
      return
    }

    if (!key.trim()) {
      setError('Enter the SQLCipher key.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      rememberDatabaseKey(request.databaseFile, key)
      await ensureDatabaseUnlocked(request.databaseFile)
      await request.onUnlocked(request.databaseFile, key)
      clearRequest()
    }
    catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Failed to unlock database')
    }
    finally {
      setSubmitting(false)
    }
  }

  return (
    <FLModal
      isOpen={!!request}
      title="Unlock Database"
      acceptBtn={isSubmitting ? 'Unlocking...' : 'Unlock'}
      rejectBtn="Cancel"
      onAccept={() => void handleAccept()}
      onReject={handleReject}
      disabled={isSubmitting}
      body={(
        <VStack align="stretch" gap={4}>
          <Text fontSize="sm" color="textSecondary">
            {request
              ? `${request.databaseFile.filename} may be SQLCipher-encrypted or invalid. Enter its SQLCipher key to continue.`
              : 'Enter the SQLCipher key.'}
          </Text>
          <Field.Root>
            <Field.Label>Decode key</Field.Label>
            <Input
              value={key}
              onChange={event => setKey(event.target.value)}
              placeholder="SQLCipher key"
              type="password"
              autoFocus
            />
          </Field.Root>
          {error && (
            <Alert.Root status="error" variant="subtle">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>{error}</Alert.Description>
              </Alert.Content>
            </Alert.Root>
          )}
        </VStack>
      )}
    />
  )
}

export default SqlcipherUnlockModal
