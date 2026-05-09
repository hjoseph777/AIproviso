import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base:    './',   // required for Electron — resolves assets relative to index.html
  plugins: [react()],
  server: {
    port: 3000,
    open: false,   // Electron opens its own window; browser auto-open disabled
  },
})
