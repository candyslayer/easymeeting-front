import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:7008',
        changeOrigin: true
      },
      '/file': {
        target: 'http://localhost:7008',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:7002',
        ws: true,
        changeOrigin: true
      }
    }
  }
})

