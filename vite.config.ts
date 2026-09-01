import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Pre-bundling maplibre-gl rewrites its worker entry and the worker 404s,
  // which silently leaves every GeoJSON source unparsed.
  optimizeDeps: { exclude: ['maplibre-gl'] },
  // maplibre's worker URL is fixed explicitly via setWorkerUrl in WorldMap, so
  // chunking is a plain size concern here: the single bundle is ~1.3 MB.
  build: { chunkSizeWarningLimit: 1500 },
})
