import { index, route, type RouteConfig } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),
  route('otoslotto', 'routes/five.tsx'),
  route('hatoslotto', 'routes/six.tsx'),
  route('skandinav-lotto', 'routes/scandinavian.tsx'),
  route('*', 'routes/not-found.tsx'),
] satisfies RouteConfig
