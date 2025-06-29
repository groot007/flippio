import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import packageJson from '../../package.json'

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins: [react()],
    root: '.',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: resolve(__dirname, 'index.html'),
      },
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@renderer': resolve(__dirname, './src'),
      },
    },
    define: {
      // Ensure compatibility with Tauri
      __TAURI__: JSON.stringify(true),
      // Inject app version from package.json
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },
    server: {
      port: 5173,
      strictPort: true,
    },
    envDir: resolve(__dirname, '../../'), // Point to root directory for .env files
  }
})
