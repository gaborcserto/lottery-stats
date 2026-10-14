import { describe, expect, it } from 'vitest'
import {
  canonicalUrl,
  pageMeta,
  publicRoutePaths,
  resolvePublicSiteOrigin,
  robotsTxt,
  sitemapXml,
} from './seo'

describe('public site SEO configuration', () => {
  it('normalizes a configured HTTPS origin', () => {
    expect(resolvePublicSiteOrigin('https://lottery.example.test/')).toBe(
      'https://lottery.example.test',
    )
  })

  it('generates crawlable robots directives with the absolute sitemap location', () => {
    expect(robotsTxt('https://lottery.example.test')).toBe(
      'User-agent: *\nAllow: /\nSitemap: https://lottery.example.test/sitemap.xml\n',
    )
  })

  it('generates exactly the public canonical routes as XML URLs', () => {
    const xml = sitemapXml('https://lottery.example.test')
    const document = new DOMParser().parseFromString(xml, 'application/xml')
    const locations = Array.from(document.querySelectorAll('loc')).map(
      (location) => location.textContent,
    )

    expect(document.querySelector('parsererror')).toBeNull()
    expect(locations).toEqual([
      'https://lottery.example.test/',
      'https://lottery.example.test/otoslotto',
      'https://lottery.example.test/hatoslotto',
      'https://lottery.example.test/skandinav-lotto',
    ])
    expect(publicRoutePaths).toHaveLength(4)
    expect(locations.join('\n')).not.toMatch(/[?]|localhost|\/api\//u)
  })

  it('canonicalizes trailing slashes and URL state and excludes dynamic routes', () => {
    expect(
      canonicalUrl(
        '/otoslotto/?year=2025&utm_source=a&b#results',
        'https://lottery.example.test',
      ),
    ).toBe('https://lottery.example.test/otoslotto')
    expect(sitemapXml('https://lottery.example.test')).not.toMatch(
      /year=|page=|set=|about|api/u,
    )
  })

  it.each([
    'http://lottery.example.test',
    'https://lottery.example.test/path',
    'https://user:password@lottery.example.test',
    'not-a-url',
  ])('rejects invalid public origins: %s', (origin) => {
    expect(resolvePublicSiteOrigin(origin)).toBeUndefined()
  })

  it('normalizes route slashes and removes query and fragment state', () => {
    expect(
      canonicalUrl(
        '/otoslotto/?utm_source=campaign&year=2025#statistics',
        'https://lottery.example.test',
      ),
    ).toBe('https://lottery.example.test/otoslotto')
  })

  it('keeps the homepage root and omits canonicals without a public origin', () => {
    expect(canonicalUrl('/', 'https://lottery.example.test')).toBe(
      'https://lottery.example.test/',
    )
    expect(canonicalUrl('/otoslotto', null)).toBeUndefined()
  })

  it('derives social fields from route SEO text and omits absolute URLs without an origin', () => {
    const metadata = pageMeta(
      'Ötöslottó – eredmények | Lottery Stats',
      'Korábbi Ötöslottó-sorsolások nyerőszámai.',
      '/otoslotto',
      null,
    )
    const values = Object.fromEntries(
      metadata
        .filter((item) => 'property' in item || 'name' in item)
        .map((item) => [
          'property' in item ? item.property : item.name,
          item.content,
        ]),
    )

    expect(values).toMatchObject({
      'og:type': 'website',
      'og:title': 'Ötöslottó – eredmények | Lottery Stats',
      'og:description': 'Korábbi Ötöslottó-sorsolások nyerőszámai.',
      'og:site_name': 'Lottery Stats',
      'og:locale': 'hu_HU',
      'twitter:card': 'summary_large_image',
      'twitter:title': 'Ötöslottó – eredmények | Lottery Stats',
      'twitter:description': 'Korábbi Ötöslottó-sorsolások nyerőszámai.',
    })
    expect(values['og:url']).toBeUndefined()
    expect(values['og:image']).toBeUndefined()
    expect(values['twitter:image']).toBeUndefined()
  })

  it('aligns canonical and Open Graph URLs and uses the existing absolute logo asset', () => {
    const canonical = canonicalUrl(
      '/hatoslotto/?year=2025&utm_source=social',
      'https://lottery.example.test',
    )
    const metadata = pageMeta(
      'Hatoslottó – eredmények | Lottery Stats',
      'Hatoslottó történelmi statisztikák.',
      '/hatoslotto/?year=2025&utm_source=social',
      'https://lottery.example.test',
    )
    const values = Object.fromEntries(
      metadata
        .filter((item) => 'property' in item || 'name' in item)
        .map((item) => [
          'property' in item ? item.property : item.name,
          item.content,
        ]),
    )

    expect(
      metadata.find((item) => 'rel' in item && item.rel === 'canonical'),
    ).toMatchObject({
      href: canonical,
    })
    expect(values['og:url']).toBe(canonical)
    expect(values['og:image']).toBe(
      'https://lottery.example.test/images/lottery-balls-background.webp',
    )
    expect(values['twitter:image']).toBe(values['og:image'])
  })
})
