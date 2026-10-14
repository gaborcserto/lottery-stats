import { describe, expect, it } from 'vitest'
import { canonicalUrl, resolvePublicSiteOrigin } from './seo'

describe('public site SEO configuration', () => {
  it('normalizes a configured HTTPS origin', () => {
    expect(resolvePublicSiteOrigin('https://lottery.example.test/')).toBe(
      'https://lottery.example.test',
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
})
