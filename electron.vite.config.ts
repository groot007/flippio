import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), sentryVitePlugin({
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: 'mykola-stanislavchuk',
      project: 'flipio',
    })],
    build: {
      sourcemap: true, // Source map generation must be turned on
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin(), sentryVitePlugin({
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: 'mykola-stanislavchuk',
      project: 'flipio',
    })],
    build: {
      sourcemap: true, // Source map generation must be turned on
    },
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
      },
    },
    plugins: [react(), sentryVitePlugin({
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: 'mykola-stanislavchuk',
      project: 'electron',
    })],
    build: {
      sourcemap: true, // Source map generation must be turned on
        rollupOptions: {
          input: {
            index: resolve(__dirname, 'src/renderer/index.html'),
            loader: resolve(__dirname, 'src/renderer/loader.html')
          }
        }
    },
  },
})
