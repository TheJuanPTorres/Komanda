import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// En desarrollo, el front corre en el puerto de Vite y reenvía las llamadas
// a la API y a Socket.IO hacia el servidor Fastify (puerto 3000). Así todo
// es "mismo origen" y la cookie de sesión funciona sin fricción.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt': cuando hay versión nueva, la app AVISA y el usuario decide
      // cuándo actualizar. Evita recargas sorpresa a mitad de un pedido.
      registerType: 'prompt',
      includeAssets: ['icons/favicon-32.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'POS — Comida rápida',
        short_name: 'POS',
        description: 'Punto de venta local para comida rápida.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f5f3f0',
        theme_color: '#e8481c',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Precachea el shell del front. NUNCA cachea la API ni el socket:
        // esos siempre van a la red (datos en vivo).
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/socket\.io/]
      }
    })
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      // Imágenes de producto (las sirve el servidor). En producción es mismo
      // origen; en dev el proxy las trae desde el puerto del servidor.
      '/imagenes': { target: 'http://localhost:3000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3000', ws: true, changeOrigin: true }
    }
  }
});
