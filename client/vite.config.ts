import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import svgr from 'vite-plugin-svgr';
import path from 'path';

export default defineConfig({
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify('https://svarapro.com/api/v1'),
  },
  plugins: [
    react(),
    svgr(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Telegram Mini App',
        short_name: 'MiniApp',
        theme_color: '#17212b',
        background_color: '#17212b',
        display: 'standalone',
        icons: [
          {
            src: '/logo.png',
            sizes: '192x192',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: 'localhost',
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  optimizeDeps: {
    exclude: ['@telegram-apps/sdk-react'],
  },
});
