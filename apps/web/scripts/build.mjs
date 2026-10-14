import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  resolvePublicSiteOrigin,
  robotsTxt,
  sitemapXml,
} from '../src/config/seo-artifacts.mjs'

const mode = process.env.SEO_BUILD_MODE ?? 'standard'
const configuredOrigin = process.env.PUBLIC_SITE_ORIGIN
const origin = resolvePublicSiteOrigin(configuredOrigin)

if (configuredOrigin && !origin) {
  throw new Error(
    'PUBLIC_SITE_ORIGIN must be a public HTTPS origin without credentials, path, query or fragment.',
  )
}

if (mode === 'release' && !origin) {
  throw new Error('SEO_BUILD_MODE=release requires a valid PUBLIC_SITE_ORIGIN.')
}

const result = await new Promise((resolveResult, reject) => {
  const child = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['react-router', 'build'],
    { stdio: 'inherit', shell: process.platform === 'win32' },
  )
  child.on('error', reject)
  child.on('exit', resolveResult)
})

if (result !== 0) process.exit(result ?? 1)

const outputDirectory = resolve('build/client')
const robotsPath = resolve(outputDirectory, 'robots.txt')
const sitemapPath = resolve(outputDirectory, 'sitemap.xml')

await rm(robotsPath, { force: true })
await rm(sitemapPath, { force: true })

if (mode !== 'fixture' && origin) {
  await mkdir(outputDirectory, { recursive: true })
  await writeFile(robotsPath, robotsTxt(origin), 'utf8')
  await writeFile(sitemapPath, sitemapXml(origin), 'utf8')
}
