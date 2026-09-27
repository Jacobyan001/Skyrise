import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    port: 5199,
    host: '0.0.0.0',
    proxy: {
      // 开发环境将 /api 代理到本地 AI 代理服务，避免跨域
      '/api': {
        target: 'http://localhost:3101',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
  plugins: [
    react(),
    VitePWA({
      // 自动更新：发现新版本后静默更新，下次刷新生效
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'fonts/VT323-Regular.ttf'],
      manifest: {
        name: 'SkyRise 像素习惯养成',
        short_name: 'SkyRise',
        description: '完成每日任务赚资源 Token，AI 文生图搭建你的像素摩天大楼',
        lang: 'zh-CN',
        theme_color: '#16173a',
        background_color: '#16173a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 预缓存静态资源
        globPatterns: ['**/*.{js,css,html,svg,png,ttf,woff2,ico}'],
        // /api 请求一律走网络（AI 生图必须实时，绝不缓存）
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /\/api\//,
            handler: 'NetworkOnly',
            method: 'POST',
          },
        ],
      },
    }),
  ],
});
