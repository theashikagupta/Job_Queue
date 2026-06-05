import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  cacheDir: '.vite',
  plugins: [react()],
  server: {
    host: 'localhost',
    port: 5174,
  },
  build: {
    emptyOutDir: false,
  },
});
