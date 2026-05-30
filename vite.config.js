import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base:    './',   // required for Electron — resolves assets relative to index.html
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/modules/workflow-designer/')) {
            return 'workflow-designer';
          }

          if (!id.includes('node_modules')) return undefined;

          if (id.includes('@xyflow/react') || id.includes('@tisoap/react-flow-smart-edge')) {
            return 'xyflow';
          }

          if (id.includes('xstate') || id.includes('@xstate/react')) {
            return 'xstate';
          }

          if (id.includes('elkjs')) {
            return 'elkjs';
          }

          return undefined;
        },
      },
    },
  },
  server: {
    port: 3000,
    open: false,   // Electron opens its own window; browser auto-open disabled
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
