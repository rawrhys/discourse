import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dotenv from 'dotenv'
import path from 'path'
import compression from 'vite-plugin-compression';

dotenv.config();

// https://vitejs.dev/config/
export default defineConfig({
  // Use absolute base path so assets are referenced from the site root. This avoids
  // broken paths like /images/assets/... when the SPA is served from a nested
  // route (e.g., /course/123).
  base: '/',
  plugins: [
    react(),
    compression({
      level: 9, 
      threshold: 10240, 
      deleteOriginFile: false
    })
  ],
  // Copy public files including .htaccess
  publicDir: 'public',
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
    strictPort: true,
    fs: {
      deny: ['server.js', 'index.ts', '.env']
    },
    proxy: {
      '/api': {
        target: 'https://thediscourse.ai',
        changeOrigin: true,
        secure: true,
      },
      '/cached-images': {
        target: 'https://thediscourse.ai',
        changeOrigin: true,
        secure: true,
      },
      // Ensure saved images served by the backend are accessible in dev
      '/images': {
        target: 'https://thediscourse.ai',
        changeOrigin: true,
        secure: true,
      }
    }
  },
  build: {
    target: 'esnext',
    // Enable minification for production
    minify: 'terser',
    cssMinify: true,
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true, // Enable sourcemaps for production
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    // Copy .htaccess and other deployment files
    copyPublicDir: true
  },
  resolve: {
    alias: {
      'node-fetch': 'isomorphic-fetch',
      'https': 'https-browserify',
    },
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
    exclude: ['node-fetch']
  }
})
