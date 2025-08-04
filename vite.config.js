import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import compression from 'vite-plugin-compression'
import dotenv from 'dotenv'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 10240, // Only compress files larger than 10kb
      deleteOriginFile: false
    })
  ],
  server: {
    port: 5173,
    open: true,
    hmr: {
      overlay: false,
      protocol: 'ws',
      host: 'localhost',
      port: 4004,
      clientPort: 4004,
      timeout: 10000,
      reconnect: true,
      retry: 5
    },
    strictPort: true, // Force Vite to use port 4003
    fs: {
      deny: ['server.js', 'index.ts', '.env']
    },
    proxy: {
      '/api': {
        target: 'http://localhost:4002',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ai: ['./src/services/AIService.js']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
    exclude: ['@mistralai/mistralai']
  },
  envPrefix: 'VITE_'
})
