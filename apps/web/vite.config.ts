import react from '@vitejs/plugin-react'
import { reactRouter } from '@react-router/dev/vite'
import { configDefaults, defineConfig } from 'vitest/config'
import { resolvePublicSiteOrigin } from './src/config/seo.ts'

const configuredSiteOrigin = process.env.PUBLIC_SITE_ORIGIN
const publicSiteOrigin = resolvePublicSiteOrigin(configuredSiteOrigin)

if (configuredSiteOrigin && !publicSiteOrigin) {
  throw new Error(
    'PUBLIC_SITE_ORIGIN must be a public HTTPS origin without credentials, path, query or fragment.',
  )
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __PUBLIC_SITE_ORIGIN__: JSON.stringify(publicSiteOrigin ?? null),
  },
  plugins: process.env.VITEST ? [react()] : [reactRouter()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: { usePolling: true },
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000',
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: [...configDefaults.exclude, '**/coverage/**', '**/build/**'],
  },
})
