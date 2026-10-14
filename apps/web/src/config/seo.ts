export {
  publicRoutePaths,
  resolvePublicSiteOrigin,
  robotsTxt,
  sitemapXml,
} from './seo-artifacts.mjs'
import { canonicalUrl as canonicalUrlArtifact } from './seo-artifacts.mjs'
import { publicRoutePaths } from './seo-artifacts.mjs'

export function pageStructuredData(
  title: string,
  description: string,
  pathname: string,
  origin: string | null = __PUBLIC_SITE_ORIGIN__,
) {
  const canonical = canonicalUrl(pathname, origin)
  const siteUrl = canonicalUrl('/', origin)
  const normalizedPath = pathname.split(/[?#]/u)[0].replace(/\/+$/, '') || '/'

  if (!publicRoutePaths.includes(normalizedPath)) return undefined

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    ...(canonical ? { '@id': `${canonical}#webpage`, url: canonical } : {}),
    name: title,
    description,
    inLanguage: 'hu',
    isPartOf: {
      '@type': 'WebSite',
      ...(siteUrl ? { '@id': `${siteUrl}#website`, url: siteUrl } : {}),
      name: 'Lottery Stats',
      inLanguage: 'hu',
    },
  }
}

export function canonicalUrl(
  pathname: string,
  origin: string | null = __PUBLIC_SITE_ORIGIN__,
) {
  return canonicalUrlArtifact(pathname, origin)
}

export function pageMeta(
  title: string,
  description: string,
  pathname: string,
  origin: string | null = __PUBLIC_SITE_ORIGIN__,
) {
  const canonical = canonicalUrl(pathname, origin)
  const socialImage = canonicalUrl(
    '/images/lottery-balls-background.webp',
    origin,
  )
  const structuredData = pageStructuredData(
    title,
    description,
    pathname,
    origin,
  )

  return [
    { title },
    { name: 'description', content: description },
    ...(canonical
      ? [{ tagName: 'link' as const, rel: 'canonical', href: canonical }]
      : []),
    { property: 'og:type', content: 'website' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    ...(canonical ? [{ property: 'og:url', content: canonical }] : []),
    { property: 'og:site_name', content: 'Lottery Stats' },
    { property: 'og:locale', content: 'hu_HU' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    ...(socialImage
      ? [
          { property: 'og:image', content: socialImage },
          { name: 'twitter:image', content: socialImage },
        ]
      : []),
    ...(structuredData ? [{ 'script:ld+json': structuredData }] : []),
  ]
}

export const homePageMetadata = {
  title: 'Lottóeredmények és nyerőszámok | Lottery Stats',
  description:
    'Ötöslottó, Hatoslottó és Skandináv lottó sorsolási eredményei, valamint történelmi statisztikái egy helyen.',
}

export function homePageMeta(pathname: string) {
  return pageMeta(
    homePageMetadata.title,
    homePageMetadata.description,
    pathname,
  )
}

declare const __PUBLIC_SITE_ORIGIN__: string | null
