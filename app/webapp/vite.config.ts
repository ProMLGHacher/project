import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const allowedHosts = process.env.VITE_ALLOWED_HOSTS?.split(',')
  .map((host) => host.trim())
  .filter(Boolean)
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET?.trim() || 'http://localhost:8023'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ['react', 'react-dom', 'react-router'],
    alias: {
      '@app': fileURLToPath(new URL('./src/app', import.meta.url)),
      '@capabilities': fileURLToPath(new URL('./src/capabilities', import.meta.url)),
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
      '@features': fileURLToPath(new URL('./src/features', import.meta.url))
    }
  },
  server: {
    allowedHosts: allowedHosts?.length ? allowedHosts : undefined,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      },
      '/ws': {
        target: apiProxyTarget,
        changeOrigin: true,
        ws: true
      }
    }
  }
})
