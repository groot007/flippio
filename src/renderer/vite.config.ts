import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // Tauri expects a 'dist' folder with index.html
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },

  // Development server configuration
  server: {
    port: 5173,
    strictPort: true,
  },

  // Environment variables
  envPrefix: ['VITE_', 'TAURI_'],

  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src'),
      '@': resolve(__dirname, 'src'),
    },
  },

  // Tauri uses a custom protocol in production
  base: './',

  clearScreen: false,
})
