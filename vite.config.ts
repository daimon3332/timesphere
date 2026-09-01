import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Pre-bundling maplibre-gl rewrites its worker entry and the worker 404s,
  // which silently leaves every GeoJSON source unparsed.
  optimizeDeps: { exclude: ['maplibre-gl'] },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { maplibre: ['maplibre-gl'] },
      },
    },
  },
})
