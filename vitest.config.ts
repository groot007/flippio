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
      '@': resolve(__dirname, 'src'),
    },
  },
})
