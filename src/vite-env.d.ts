/// <reference types="vite/client" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
 proxy: {
  '/api': {
    target: 'https://nakodamobile.in',
    changeOrigin: true,
    secure: false,
    rewrite: (path) => path.replace(/^\/api/, '/api'), // optional but explicit
  },
},
});