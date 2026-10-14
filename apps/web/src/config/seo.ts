export function resolvePublicSiteOrigin(value: string | undefined) {
  if (!value) return undefined

  try {
    const url = new URL(value)
    if (
      url.protocol !== 'https:' ||
      !url.hostname ||
      url.username ||
      url.password ||
      !['', '/'].includes(url.pathname) ||
      url.search ||
      url.hash
    ) {
      return undefined
    }

    return url.origin
  } catch {
    return undefined
  }
}

export function canonicalUrl(
  pathname: string,
  origin: string | null = __PUBLIC_SITE_ORIGIN__,
) {
  if (!origin || !pathname.startsWith('/') || pathname.startsWith('//')) {
    return undefined
  }

  const url = new URL(pathname, origin)
  if (url.origin !== origin) return undefined

  url.pathname = url.pathname === '/' ? '/' : url.pathname.replace(/\/+$/, '')
  url.search = ''
  url.hash = ''

  return url.toString()
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
