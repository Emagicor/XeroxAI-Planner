import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { serveTestSuitePlugin } from './vite.testSuitePlugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), serveTestSuitePlugin()],
  optimizeDeps: {
    include: ['zustand'],
  },
})
