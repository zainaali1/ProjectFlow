import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // During development, forward /api calls to the Node API so the browser sees one origin.
    proxy: { '/api': 'http://localhost:3001' },
  },
  build: { outDir: 'dist', sourcemap: true },
});
