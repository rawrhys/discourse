import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // Optimize memory usage
    target: 'es2015',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    // Split chunks to reduce memory usage
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['react-icons', 'framer-motion'],
          utils: ['axios', 'marked']
        }
      }
    },
    // Reduce memory usage during build
    chunkSizeWarningLimit: 1000,
    sourcemap: false
  },
  // Optimize development server
  server: {
    hmr: {
      overlay: false
    },
    proxy: {
      '/api': {
        target: 'http://localhost:4003',
        changeOrigin: true,
        secure: false
      }
    }
  },
  // Optimize esbuild settings
  esbuild: {
    target: 'es2015',
    legalComments: 'none'
  },
  // Reduce memory usage
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom']
  }
})
