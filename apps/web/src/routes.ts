import { index, route, type RouteConfig } from '@react-router/dev/routes'
import publicRoutes from './config/public-routes.json'

export default [
  ...publicRoutes.map(({ path, file }) =>
    path === '/'
      ? index(`routes/${file}.tsx`)
      : route(path.slice(1), `routes/${file}.tsx`),
  ),
  route('*', 'routes/not-found.tsx'),
] satisfies RouteConfig
