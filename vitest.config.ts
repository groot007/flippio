import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/renderer/src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    setupFiles: ['./src/renderer/src/test-utils/setup.ts'],
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@': resolve('src/renderer/src'),
    },
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['src/renderer/src/**/*.{js,ts,jsx,tsx}'],
      exclude: [
        'src/renderer/src/**/*.{test,spec}.{js,ts,jsx,tsx}',
        'src/renderer/src/**/__tests__/**',
        'src/renderer/src/test-utils/**',
        'src/renderer/src/main.tsx',
        'src/renderer/src/assets/**',
        'src/renderer/src/types/**',
        'src/renderer/src/**/*.d.ts',
      ],
      // Temporarily comment out thresholds to see current coverage levels
      // thresholds: {
      //   'global': {
      //     branches: 70,
      //     functions: 75,
      //     lines: 80,
      //     statements: 80,
      //   },
      //   // Critical path components require higher coverage
      //   'src/renderer/src/hooks/useApplications.ts': {
      //     branches: 85,
      //     functions: 90,
      //     lines: 90,
      //     statements: 90,
      //   },
      //   'src/renderer/src/hooks/useDatabaseFiles.ts': {
      //     branches: 85,
      //     functions: 90,
      //     lines: 90,
      //     statements: 90,
      //   },
      //   'src/renderer/src/components/layout/AppHeader.tsx': {
      //     branches: 80,
      //     functions: 85,
      //     lines: 85,
      //     statements: 85,
      //   },
      //   'src/renderer/src/components/layout/SubHeader.tsx': {
      //     branches: 80,
      //     functions: 85,
      //     lines: 85,
      //     statements: 85,
      //   },
      //   'src/renderer/src/store/useCurrentDeviceSelection.ts': {
      //     branches: 90,
      //     functions: 95,
      //     lines: 95,
      //     statements: 95,
      //   },
      //   'src/renderer/src/store/useCurrentDatabaseSelection.ts': {
      //     branches: 90,
      //     functions: 95,
      //     lines: 95,
      //     statements: 95,
      //   },
      // },
    },
  },
})
