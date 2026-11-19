import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Two pages: Royal Tara Cove itself, and Afternote (a separate, plain three.js
// game opened from the menu) at /afternote/.
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        afternote: resolve(import.meta.dirname, 'afternote/index.html'),
      },
    },
  },
})
