import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { serveTestSuitePlugin } from './vite.testSuitePlugin.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const appEnv =
  process.env.VITE_APP_ENV ??
  (process.env.NODE_ENV === 'production' ? 'production' : 'development')

const testSuiteEnabled =
  process.env.VITE_FEATURE_TEST_SUITE !== 'false' && appEnv !== 'production'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ...(testSuiteEnabled ? [serveTestSuitePlugin()] : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['zustand'],
  },
})
