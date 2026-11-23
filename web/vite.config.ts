import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // the game server: uvicorn server:app --port 8000
      '/ws': { target: 'http://localhost:8000', ws: true },
      '/api': { target: 'http://localhost:8000' },
    },
  },
})
