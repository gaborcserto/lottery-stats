import type { Config } from '@react-router/dev/config'
import publicRoutes from './src/config/public-routes.json'

export default {
  appDirectory: 'src',
  ssr: false,
  prerender: publicRoutes.map(({ path }) => path),
} satisfies Config
