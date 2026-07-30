import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // manifest.webmanifest ফাইলটা আমরা public/ ফোল্ডারে নিজেরাই বানিয়েছি,
      // তাই প্লাগইনকে নতুন করে জেনারেট না করে সেটাই ব্যবহার করতে বলা হচ্ছে
      manifest: false,
      injectRegister: 'auto',
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'maskable-icon-512.png', 'apple-touch-icon.png'],
      workbox: {
        // অফলাইনেও শেল লোড হবে; ডেটা (services/orders) সবসময় নেটওয়ার্ক থেকেই আসবে
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/rest/v1') || url.hostname.includes('supabase.co'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
