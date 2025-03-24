import {
  Box,
  Button,
  Heading,
  Icon,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react'
import { useColorMode } from '@renderer/ui/color-mode'
import { FaDatabase, FaEdit, FaFileExport, FaFilter, FaSearch } from 'react-icons/fa'
import { useAppStore } from '../store/appStore'

export function Welcome() {
  const { colorMode } = useColorMode()
  const isDark = colorMode === 'dark'
  const { openExternalDbFile } = useAppStore()

  // List of features
  const features = [
    {
      icon: FaDatabase,
      title: 'Database Explorer',
      description: 'Browse and search through database tables from Android and iOS devices',
    },
    {
      icon: FaSearch,
      title: 'Advanced Search',
      description: 'Search for specific data across tables with powerful filtering options',
    },
    {
      icon: FaEdit,
      title: 'Edit Records',
      description: 'Modify database records directly in the application',
    },
    {
      icon: FaFileExport,
      title: 'Export Data',
      description: 'Export query results to various formats like CSV, JSON, or SQL',
    },
    {
      icon: FaFilter,
      title: 'Data Filtering',
      description: 'Filter table data with custom expressions',
    },
  ]

  return (
    <Box px={8} py={12} maxWidth="1200px" mx="auto">
      <Stack direction="column" gap={8} textAlign="center" mb={12}>
        <Heading size="2xl" fontWeight="bold">
          Welcome to Flippio
        </Heading>
        <Text fontSize="xl" maxW="800px" mx="auto">
          Browse, search, and edit mobile device database files with ease.
          Select a device and app from the header, or open a database file directly.
        </Text>
        <Button
          size="lg"
          colorScheme="blue"
          onClick={openExternalDbFile}
          mt={4}
          alignSelf="center"
        >
          <Icon as={FaDatabase} mr={2} />
          Open DB File
        </Button>
      </Stack>

      <Box mt={16}>
        <Heading size="lg" mb={8} textAlign="center">
          Key Features
        </Heading>
        <SimpleGrid columns={{ base: 1, md: 3 }} gap={8}>
          {features.map((feature, index) => (
            <Box
              key={index}
              p={6}
              borderRadius="lg"
              borderWidth="1px"
              borderColor={isDark ? 'gray.700' : 'gray.200'}
              bg={isDark ? 'gray.800' : 'white'}
              boxShadow="md"
              transition="all 0.3s"
              _hover={{ transform: 'translateY(-5px)', boxShadow: 'lg' }}
            >
              <Icon as={feature.icon} w={10} h={10} color="blue.500" mb={4} />
              <Heading size="md" mb={3}>
                {feature.title}
              </Heading>
              <Text color={isDark ? 'gray.400' : 'gray.600'}>
                {feature.description}
              </Text>
            </Box>
          ))}
        </SimpleGrid>
      </Box>
    </Box>
  )
}
