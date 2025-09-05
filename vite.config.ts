import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    // ✅ Add Node.js polyfills for Cloudinary compatibility
    nodePolyfills({
      include: ['buffer', 'process', 'url'],
      globals: { 
        Buffer: true, 
        global: true, 
        process: true 
      },
      protocolImports: true,
    }),
  ],
  server: {
    host: true, // 👈 Enables access via network IP
    port: 5173, // 👈 Ensures consistent port
    proxy: {
      '/api': 'https://nakodamobile.in',
    },
  },
  // ✅ Define global variables for browser compatibility
  define: {
    global: 'globalThis',
  },
});
