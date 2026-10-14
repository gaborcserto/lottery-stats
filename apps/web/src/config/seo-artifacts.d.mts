export const publicRoutePaths: string[]
export function resolvePublicSiteOrigin(
  value: string | undefined,
): string | undefined
export function canonicalUrl(
  pathname: string,
  origin?: string | null,
): string | undefined
export function robotsTxt(origin: string): string
export function sitemapXml(origin: string): string
