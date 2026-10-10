import type { ReactNode } from 'react'
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useNavigation,
} from 'react-router'
import { AppLayout } from './components/AppLayout'
import { ErrorPage } from './components/ErrorPage'
import './index.scss'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="hu">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function Root() {
  const navigation = useNavigation()
  return (
    <AppLayout pending={navigation.state !== 'idle'}>
      <Outlet />
    </AppLayout>
  )
}

export function HydrateFallback() {
  return (
    <AppLayout pending>
      <p role="status">Adatok betöltése…</p>
    </AppLayout>
  )
}

export function ErrorBoundary() {
  return (
    <AppLayout>
      <title>Az oldal nem tölthető be | Lottery Stats</title>
      <meta name="robots" content="noindex" />
      <ErrorPage />
    </AppLayout>
  )
}
