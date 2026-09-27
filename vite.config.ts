import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/  — port 1420 is what src-tauri/tauri.conf.json expects
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  // ~120 Phosphor icons × 6 weights each; fine for a desktop app loading from disk
  build: { chunkSizeWarningLimit: 1000 },
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
  },
})
