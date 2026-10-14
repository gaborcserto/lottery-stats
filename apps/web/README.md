# Frontend

The frontend is a React 19 and TypeScript application built with React Router Framework Mode and Vite. It renders lottery results and interactive statistics in the browser.

## Routes and API access

The public routes are `/`, `/otoslotto`, `/hatoslotto`, and `/skandinav-lotto`. They use the Laravel read-only API under `/api/v1`.

For local development, start the Compose services and initialize the database using the root [Getting started](../../README.md#getting-started) instructions. The frontend is at <http://localhost:5173>. Compose configures Vite to proxy `/api` requests to the `api` service. When running Vite directly, `VITE_API_PROXY_TARGET` can point the proxy to a Laravel server; it defaults to `http://localhost:8000`.

## Development, tests, and builds

From `apps/web/`, install dependencies and start the frontend with:

```sh
npm ci
npm run dev
```

Useful checks and build commands are:

```sh
npm run test
npm run lint
npm run format:check
npm run typecheck
npm run build
npm run build:fixture
```

`npm run build` typechecks and prerenders the four public routes into `build/client/`. Prerendering requires `PRERENDER_API_BASE_URL`, a trusted HTTP(S) Laravel API URL ending in `/api/v1`. Compose sets it to `http://api:8000/api/v1`; a direct local build can use `http://localhost:8000/api/v1`. It is server-side build configuration and must not be exposed as a `VITE_*` value. `npm run build:fixture` builds against synthetic data for verification only; its output must not be deployed.

## SEO and static hosting

`PUBLIC_SITE_ORIGIN` is optional for standard local builds. When set, it must be the public HTTPS origin only, with no credentials, path, query, or fragment. It supplies canonical URLs and causes the build to generate `robots.txt` and `sitemap.xml`. Without it, canonical URLs and those SEO files are omitted.

For a release build, set `SEO_BUILD_MODE=release` and provide a valid `PUBLIC_SITE_ORIGIN`; the build fails if the origin is missing or invalid. For example, from `apps/web/` in PowerShell:

```powershell
$env:PRERENDER_API_BASE_URL = 'https://api.example.org/api/v1'
$env:PUBLIC_SITE_ORIGIN = 'https://www.example.org'
$env:SEO_BUILD_MODE = 'release'
npm run build
```

Replace the example origins with the trusted API and actual public site origins for the release. No hosting provider or public deployment is configured by this repository.

Serve the generated `build/client/` files as static assets, retaining each route's generated HTML, React Router `.data` files, and hashed assets. Configure the host to serve the generated documents for the four public routes and forward `/api/*` requests to Laravel. Unknown paths and missing assets must return HTTP 404 with a Hungarian noindex error page. Do not rewrite every request to the homepage with HTTP 200: the client-side catch-all cannot set the response status, and `__spa-fallback.html` is a noindex hydration shell rather than a 404 configuration.
