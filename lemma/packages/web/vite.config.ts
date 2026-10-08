import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In development the API runs separately (npm run dev starts both); in production the
// API server serves the built files itself, so there is a single origin either way.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: `http://127.0.0.1:${process.env.PORT ?? 8000}`, changeOrigin: false },
      '/healthz': { target: `http://127.0.0.1:${process.env.PORT ?? 8000}`, changeOrigin: false },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
});
