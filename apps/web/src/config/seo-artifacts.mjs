import publicRoutes from './public-routes.json' with { type: 'json' }

export const publicRoutePaths = publicRoutes.map(({ path }) => path)

export function resolvePublicSiteOrigin(value) {
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
  pathname,
  origin = globalThis.__PUBLIC_SITE_ORIGIN__,
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

export function robotsTxt(origin) {
  return `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`
}

export function sitemapXml(origin) {
  const urls = publicRoutePaths
    .map((pathname) => {
      const url = canonicalUrl(pathname, origin)
      if (!url) throw new Error(`Invalid public route: ${pathname}`)

      return `  <url><loc>${escapeXml(url)}</loc></url>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

function escapeXml(value) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&apos;',
    }

    return entities[character]
  })
}
