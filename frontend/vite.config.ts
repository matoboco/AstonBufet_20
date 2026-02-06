import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';

// Get version info at build time
const getVersionInfo = () => {
  const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
  let gitCommit = '';
  try {
    gitCommit = execSync('git rev-parse --short HEAD', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    // Git not available in Docker build
  }
  const buildTime = new Date().toISOString();
  return {
    version: pkg.version,
    gitCommit,
    buildTime,
  };
};

const versionInfo = getVersionInfo();

// Plugin to write version.json to dist folder after build
const versionPlugin = () => ({
  name: 'version-plugin',
  closeBundle() {
    const distDir = 'dist';
    if (!existsSync(distDir)) {
      mkdirSync(distDir, { recursive: true });
    }
    writeFileSync(
      `${distDir}/version.json`,
      JSON.stringify(versionInfo, null, 2)
    );
    console.log('Generated version.json:', versionInfo);
  },
});

export default defineConfig({
  plugins: [
    react(),
    versionPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Aston Bufet 2.0',
        short_name: 'Bufet',
        description: 'Interná PWA aplikácia pre Aston bufet',
        theme_color: '#10b981',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Don't cache version.json - needed for update detection
        globIgnores: ['**/version.json'],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/products$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'products-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
            },
          },
        ],
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(versionInfo.version),
    __GIT_COMMIT__: JSON.stringify(versionInfo.gitCommit),
    __BUILD_TIME__: JSON.stringify(versionInfo.buildTime),
  },
  server: {
    port: 3000,
    host: true,
  },
  preview: {
    port: 3000,
    host: true,
  },
});
