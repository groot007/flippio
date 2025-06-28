import { Box, Flex, Icon, Text } from '@chakra-ui/react'
import { keyframes } from '@emotion/react'
import { useCurrentDatabaseSelection } from '@renderer/store'
import { useColorMode } from '@renderer/ui/color-mode'
// import { webUtils } from 'electron'
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { LuDatabase, LuFileType, LuUpload } from 'react-icons/lu'
import { toaster } from '../../ui/toaster'

// Create a context for drag and drop functionality
interface DragAndDropContextType {
  handleFile: (file: File) => void
  isProcessingFile: boolean
}

const DragAndDropContext = createContext<DragAndDropContextType | null>(null)

export function useDragAndDrop() {
  const context = useContext(DragAndDropContext)
  if (!context) {
    throw new Error('useDragAndDrop must be used within a DragAndDropProvider')
  }
  return context
}

// Define animations with enhanced smoothness
const pulseAnimation = keyframes`
  0% { opacity: 0.7; transform: scale(1); }
  50% { opacity: 0.9; transform: scale(1.03); }
  100% { opacity: 0.7; transform: scale(1); }
`

const floatingAnimation = keyframes`
  0% { transform: translateY(0px) rotate(0deg); }
  25% { transform: translateY(-8px) rotate(-2deg); }
  50% { transform: translateY(-12px) rotate(0deg); }
  75% { transform: translateY(-8px) rotate(2deg); }
  100% { transform: translateY(0px) rotate(0deg); }
`

const fadeInAnimation = keyframes`
  0% { opacity: 0; backdrop-filter: blur(0); transform: scale(0.98); }
  100% { opacity: 1; backdrop-filter: blur(8px); transform: scale(1); }
`

const borderFlashAnimation = keyframes`
  0% { border-color: var(--chakra-colors-flipioPrimary); }
  50% { border-color: var(--chakra-colors-flipioSecondary); }
  100% { border-color: var(--chakra-colors-flipioPrimary); }
`

const SUPPORTED_FILE_EXTENSIONS = ['.sqlite', '.db', '.sql', '.sqlite3', '.sqlitedb']

interface DragAndDropProviderProps {
  children: React.ReactNode
}

export const DragAndDropProvider: React.FC<DragAndDropProviderProps> = ({ children }) => {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessingFile, setIsProcessingFile] = useState(false)
  const dragCounterRef = useRef(0)
  const { colorMode } = useColorMode()
  const isDark = colorMode === 'dark'
  const setSelectedDatabaseFile = useCurrentDatabaseSelection(state => state.setSelectedDatabaseFile)

  const handleFile = useCallback(async (file: File) => {
    if (!file)
      return

    const filterExt = SUPPORTED_FILE_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext))

    if (!filterExt) {
      toaster.create({
        title: 'Unsupported file type',
        description: 'Please drop SQLite database files only (.db, .sqlite, .sql)',
        type: 'warning',
        duration: 3000,
      })
      return
    }

    setIsProcessingFile(true)

    const filePath = window.api.webUtils.getPathForFile(file)

    setSelectedDatabaseFile({
      path: filePath,
      filename: file.name,
      deviceType: 'desktop',
      packageName: '',
      remotePath: filePath,
    })
    toaster.create({
      title: 'Database opened',
      description: `Successfully opened ${file.name}`,
      type: 'success',
      duration: 3000,
    })

    setIsProcessingFile(false)
  }, [])

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    dragCounterRef.current += 1
    if (dragCounterRef.current === 1) {
      setIsDragging(true)
    }
  }, [])

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    dragCounterRef.current -= 1
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    dragCounterRef.current = 0
    setIsDragging(false)

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0])
    }
  }, [handleFile])

  useEffect(() => {
    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('drop', handleDrop)

    return () => {
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('drop', handleDrop)
    }
  }, [handleDragEnter, handleDragOver, handleDragLeave, handleDrop])

  return (
    <DragAndDropContext.Provider value={{ handleFile, isProcessingFile }}>
      {children}
      {isDragging && (
        <Flex
          position="fixed"
          top={0}
          left={0}
          right={0}
          bottom={0}
          zIndex={9999}
          justifyContent="center"
          alignItems="center"
          bg={isDark ? 'rgba(18, 18, 18, 0.85)' : 'rgba(255, 255, 255, 0.85)'}
          backdropFilter="blur(8px)"
          animation={`${fadeInAnimation} 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)`}
          transition="all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)"
        >
          <Box
            p={8}
            borderRadius="xl"
            bg={isDark ? 'rgba(18, 18, 18, 0.9)' : 'rgba(255, 255, 255, 0.9)'}
            borderWidth="3px"
            borderStyle="dashed"
            borderColor="flipioPrimary"
            textAlign="center"
            boxShadow="0 8px 32px rgba(0, 0, 0, 0.15)"
            maxWidth="400px"
            animation={`${pulseAnimation} 3s infinite ease-in-out, ${borderFlashAnimation} 4s infinite ease-in-out`}
            transform="translateY(0)"
            transition="transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)"
            _hover={{
              transform: 'translateY(-5px)',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.2)',
            }}
          >
            <Icon
              as={LuDatabase}
              boxSize={20}
              mb={6}
              color="flipioPrimary"
              animation={`${floatingAnimation} 4s infinite ease-in-out`}
              filter="drop-shadow(0 5px 15px rgba(17, 147, 160, 0.5))"
              transition="all 0.3s ease"
              _hover={{
                color: 'flipioSecondary',
                transform: 'scale(1.1)',
              }}
            />
            <Text
              fontSize="2xl"
              fontWeight="bold"
              mb={3}
              bgGradient="linear(to-r, flipioPrimary, flipioSecondary)"
              bgClip="text"
              letterSpacing="tight"
            >
              Drop Database Files Here
            </Text>
            <Text
              color={isDark ? 'gray.300' : 'gray.600'}
              fontSize="md"
              fontWeight="medium"
            >
              Release to open SQLite database files
            </Text>
            <Flex
              align="center"
              justify="center"
              mt={5}
              p={3}
              bg={isDark ? 'whiteAlpha.100' : 'blackAlpha.50'}
              borderRadius="md"
              borderWidth="1px"
              borderColor={isDark ? 'whiteAlpha.200' : 'blackAlpha.100'}
            >
              <Icon
                as={LuUpload}
                mr={3}
                color="flipioSecondary"
                boxSize={5}
                animation={`${pulseAnimation} 2.5s infinite ease-in-out`}
              />
              <Text color="flipioSecondary" fontWeight="medium">
                Ready to import
              </Text>
            </Flex>
            <Flex
              mt={6}
              fontSize="sm"
              justify="center"
              flexWrap="wrap"
              gap={2}
            >
              {SUPPORTED_FILE_EXTENSIONS.map((ext, i) => (
                <Flex
                  key={i}
                  align="center"
                  bg={isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)'}
                  px={3}
                  py={1}
                  borderRadius="full"
                  boxShadow="sm"
                >
                  <Icon as={LuFileType} mr={1} fontSize="xs" />
                  <Text fontWeight="medium">{ext}</Text>
                </Flex>
              ))}
            </Flex>
          </Box>
        </Flex>
      )}
    </DragAndDropContext.Provider>
  )
}
