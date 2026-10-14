import { StrictMode } from 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { createRoutesStub, Link, Meta, Outlet } from 'react-router'
import { describe, expect, it } from 'vitest'
import { gameCodes, gameMeta, gamePages } from './games'
import {
  homePageMeta,
  homePageMetadata,
  pageMeta,
  pageStructuredData,
} from './seo'
import * as home from '../routes/home'
import * as five from '../routes/five'
import * as six from '../routes/six'
import * as scandinavian from '../routes/scandinavian'
import * as notFound from '../routes/not-found'

const origin = 'https://lottery.example.test'
const pages = [
  { path: '/', ...homePageMetadata },
  ...gameCodes.map((game) => ({
    path: gamePages[game].path,
    title: `${gamePages[game].name} – eredmények és statisztikák | Lottery Stats`,
    description: gamePages[game].description,
  })),
]

function HeadTestLayout() {
  return (
    <>
      <Meta />
      {pages.map(({ path }) => (
        <Link key={path} to={`${path}?year=2025&page=2&utm_source=test`}>
          {path}
        </Link>
      ))}
      <Link to="/missing">Missing</Link>
      <Outlet />
    </>
  )
}

function structuredDataScripts(container: HTMLElement | Document) {
  return container.querySelectorAll('script[type="application/ld+json"]')
}

describe('public page structured data', () => {
  it.each(pages)(
    'describes $path with only justified fields',
    ({ path, title, description }) => {
      const canonical = `${origin}${path}`
      expect(
        pageStructuredData(
          title,
          description,
          `${path}?year=2025&page=2&set=combined&utm_source=test#results`,
          origin,
        ),
      ).toEqual({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: title,
        description,
        inLanguage: 'hu',
        isPartOf: {
          '@type': 'WebSite',
          '@id': `${origin}/#website`,
          url: `${origin}/`,
          name: 'Lottery Stats',
          inLanguage: 'hu',
        },
      })
      expect(
        pageMeta(title, description, path, origin).filter(
          (item) => 'script:ld+json' in item,
        ),
      ).toHaveLength(1)
    },
  )

  it.each(pages)(
    'omits URL identities without an origin at $path',
    ({ path, title, description }) => {
      expect(pageStructuredData(title, description, path, null)).toEqual({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: title,
        description,
        inLanguage: 'hu',
        isPartOf: {
          '@type': 'WebSite',
          name: 'Lottery Stats',
          inLanguage: 'hu',
        },
      })
    },
  )

  it('normalizes trailing slashes and excludes unknown routes', () => {
    expect(
      pageStructuredData(
        'Title',
        'Description',
        '/otoslotto/?number=12#results',
        origin,
      )?.url,
    ).toBe(`${origin}/otoslotto`)
    for (const path of [
      '/missing',
      '/api/v1',
      '//other.test',
      '/missing?year=2025',
    ]) {
      expect(
        pageStructuredData('Title', 'Description', path, origin),
      ).toBeUndefined()
    }
    expect(notFound.meta().some((item) => 'script:ld+json' in item)).toBe(false)
  })

  it.each([
    ['/', home.meta],
    ['/otoslotto', five.meta],
    ['/hatoslotto', six.meta],
    ['/skandinav-lotto', scandinavian.meta],
  ] as const)(
    'omits structured data on route errors at %s',
    (pathname, meta) => {
      const args = {
        location: { pathname, search: '', hash: '', state: null, key: 'test' },
        params: {},
        matches: [],
        loaderData: undefined,
        error: new Error('Loader failed'),
      }
      expect(meta(args).some((item) => 'script:ld+json' in item)).toBe(false)
    },
  )

  it('safely serializes HTML-sensitive text through React Router Meta', () => {
    const text = '</script><script>alert("test")</script><!-- & >\u2028\u2029'
    const Stub = createRoutesStub([
      {
        path: '/',
        Component: Meta,
        meta: () => pageMeta(text, text, '/', origin),
      },
    ])
    const html = renderToString(<Stub />)
    const parsed = new DOMParser().parseFromString(html, 'text/html')
    const scripts = structuredDataScripts(parsed)
    expect(scripts).toHaveLength(1)
    expect(parsed.querySelectorAll('script')).toHaveLength(1)
    expect(scripts[0].textContent).not.toContain('</script>')
    expect(JSON.parse(scripts[0].textContent ?? '')).toMatchObject({
      name: text,
      description: text,
    })
  })

  it('hydrates one script and replaces it across navigation and unknown pages', async () => {
    const Stub = createRoutesStub([
      {
        path: '/',
        Component: HeadTestLayout,
        children: [
          { index: true, Component: Outlet, meta: () => homePageMeta('/') },
          ...gameCodes.map((game) => ({
            path: gamePages[game].path,
            Component: Outlet,
            meta: () => gameMeta(game, gamePages[game].path),
          })),
          { path: '*', Component: Outlet, meta: notFound.meta },
        ],
      },
    ])
    const element = (
      <StrictMode>
        <Stub />
      </StrictMode>
    )
    const container = document.createElement('div')
    container.innerHTML = renderToString(element)
    document.body.append(container)
    const errors: unknown[] = []
    let root: ReturnType<typeof hydrateRoot> | undefined
    try {
      await act(async () => {
        root = hydrateRoot(container, element, {
          onRecoverableError: (error) => errors.push(error),
        })
      })
      for (const { path, title, description } of pages) {
        fireEvent.click(screen.getByRole('link', { name: path }))
        await waitFor(() => {
          const scripts = structuredDataScripts(container)
          expect(scripts).toHaveLength(1)
          expect(JSON.parse(scripts[0].textContent ?? '')).toMatchObject({
            name: title,
            description,
          })
        })
      }
      fireEvent.click(screen.getByRole('link', { name: 'Missing' }))
      await waitFor(() =>
        expect(structuredDataScripts(container)).toHaveLength(0),
      )
      fireEvent.click(screen.getByRole('link', { name: '/' }))
      await waitFor(() =>
        expect(structuredDataScripts(container)).toHaveLength(1),
      )
      expect(errors).toEqual([])
    } finally {
      await act(async () => root?.unmount())
      container.remove()
    }
  })
})
