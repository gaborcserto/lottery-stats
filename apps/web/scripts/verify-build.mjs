import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import {
  publicRoutePaths,
  resolvePublicSiteOrigin,
} from '../src/config/seo-artifacts.mjs'

export async function verifyBuild(fixture = false) {
  const configuredOrigin = process.env.PUBLIC_SITE_ORIGIN
  const origin = resolvePublicSiteOrigin(configuredOrigin)
  assert.ok(!configuredOrigin || origin, 'PUBLIC_SITE_ORIGIN must be valid')
  for (const [path, title, description, heading = title] of [
    [
      '',
      'Lottóeredmények és nyerőszámok | Lottery Stats',
      'Ötöslottó, Hatoslottó és Skandináv lottó sorsolási eredményei, valamint történelmi statisztikái egy helyen.',
      'A számok mögött.',
    ],
    [
      'otoslotto/',
      'Ötöslottó – eredmények és statisztikák | Lottery Stats',
      'Korábbi Ötöslottó-sorsolások nyerőszámai és gyakorisági statisztikái, áttekinthetően.',
      'Ötöslottó',
    ],
    [
      'hatoslotto/',
      'Hatoslottó – eredmények és statisztikák | Lottery Stats',
      'Hatoslottó-eredmények és történelmi statisztikák, a korábbi pótszámok külön bemutatásával.',
      'Hatoslottó',
    ],
    [
      'skandinav-lotto/',
      'Skandináv lottó – eredmények és statisztikák | Lottery Stats',
      'Skandináv lottó-eredmények a gépi és kézi számsorokkal, valamint történelmi statisztikákkal.',
      'Skandináv lottó',
    ],
  ]) {
    const html = await readFile(`build/client/${path}index.html`, 'utf8')
    // Scripts are never executed: assertions inspect the actual initial HTML.
    const { document } = new JSDOM(html).window
    assert.equal(document.documentElement.lang, 'hu')
    assert.equal(document.documentElement.dataset.theme, 'light')
    assert.equal(
      document.querySelector('head script[src="/theme-bootstrap.js"]') !== null,
      true,
    )
    assert.equal(
      document.querySelector(
        'header [role="group"] button[aria-pressed="true"]',
      )?.textContent,
      'Világos',
    )
    assert.equal(
      document.querySelectorAll('header [role="group"] button').length,
      2,
    )
    assert.equal(document.title, title)
    assert.equal(document.querySelectorAll('meta[name="robots"]').length, 0)
    assert.equal(
      document.querySelector('meta[name="description"]')?.content,
      description,
    )
    assert.equal(document.querySelectorAll('title').length, 1)
    assert.equal(
      document.querySelectorAll('meta[name="description"]').length,
      1,
    )
    const expectedCanonical = origin
      ? `${origin}${path ? `/${path.replace(/\/+$/, '')}` : '/'}`
      : null
    assert.equal(
      document.querySelector('link[rel="canonical"]')?.getAttribute('href') ??
        null,
      expectedCanonical,
    )
    assert.equal(
      document.querySelectorAll('link[rel="canonical"]').length,
      expectedCanonical ? 1 : 0,
    )
    const structuredDataScripts = document.querySelectorAll(
      'script[type="application/ld+json"]',
    )
    assert.equal(structuredDataScripts.length, 1)
    assert.ok(document.head.contains(structuredDataScripts[0]))
    assert.deepEqual(JSON.parse(structuredDataScripts[0].textContent), {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      ...(expectedCanonical
        ? { '@id': `${expectedCanonical}#webpage`, url: expectedCanonical }
        : {}),
      name: title,
      description,
      inLanguage: 'hu',
      isPartOf: {
        '@type': 'WebSite',
        ...(origin ? { '@id': `${origin}/#website`, url: `${origin}/` } : {}),
        name: 'Lottery Stats',
        inLanguage: 'hu',
      },
    })
    const expectedSocialMetadata = {
      'og:type': 'website',
      'og:title': title,
      'og:description': description,
      'og:site_name': 'Lottery Stats',
      'og:locale': 'hu_HU',
      'twitter:card': 'summary_large_image',
      'twitter:title': title,
      'twitter:description': description,
    }
    for (const [name, content] of Object.entries(expectedSocialMetadata)) {
      const attribute = name.startsWith('og:') ? 'property' : 'name'
      const matches = document.querySelectorAll(`meta[${attribute}="${name}"]`)
      assert.equal(matches.length, 1, `Expected one ${name} value at /${path}`)
      assert.equal(matches[0]?.getAttribute('content'), content)
    }
    for (const [name, content] of [
      ['og:url', expectedCanonical],
      [
        'og:image',
        expectedCanonical
          ? `${origin}/images/lottery-balls-background.webp`
          : null,
      ],
      [
        'twitter:image',
        expectedCanonical
          ? `${origin}/images/lottery-balls-background.webp`
          : null,
      ],
    ]) {
      const attribute = name.startsWith('og:') ? 'property' : 'name'
      const matches = document.querySelectorAll(`meta[${attribute}="${name}"]`)
      assert.equal(matches.length, content ? 1 : 0)
      assert.equal(matches[0]?.getAttribute('content') ?? null, content)
    }
    assert.ok(!document.head.innerHTML.includes('localhost'))
    assert.ok(document.querySelector('main h1')?.textContent.includes(heading))
    assert.equal(document.querySelectorAll('main h1').length, 1)
    assert.ok(
      !document
        .querySelector('main')
        ?.textContent.includes('Az oldal betöltése'),
    )
    assert.ok(
      !document.querySelector('main')?.textContent.includes('Adatok betöltése'),
    )
    assert.equal(
      document.querySelector('main')?.getAttribute('aria-busy'),
      'false',
    )
    if (path) assert.ok(document.querySelector('main time'))
    else {
      assert.equal(document.querySelectorAll('main article').length, 3)
      assert.equal(document.querySelectorAll('main article time').length, 3)
    }
    assert.equal(
      document.querySelector('link[rel="icon"]')?.getAttribute('href'),
      '/favicon.ico',
    )
    assert.equal(
      document.querySelector('header img')?.getAttribute('src'),
      '/images/logo.png',
    )
    assert.ok(document.querySelector('header nav'))
    const navigation = document.querySelector('header nav')
    if (path) {
      assert.equal(
        navigation.querySelector('[aria-current="page"]')?.getAttribute('href'),
        `/${path.slice(0, -1)}`,
      )
      const index = ['otoslotto/', 'hatoslotto/', 'skandinav-lotto/'].indexOf(
        path,
      )
      assert.equal(
        navigation.querySelector('[aria-hidden="true"]')?.style.transform,
        `translateX(${index * 100}%)`,
      )
    } else {
      assert.equal(navigation.querySelector('[aria-current="page"]'), null)
      assert.equal(navigation.querySelector('[aria-hidden="true"]'), null)
    }
    assert.ok(document.querySelector('footer'))
    assert.equal(
      document.querySelector('footer img')?.getAttribute('src'),
      '/images/logo.png',
    )
    assert.equal(document.querySelector('footer a')?.getAttribute('href'), '/')
    if (path)
      assert.ok(
        document.querySelector('table caption')?.textContent.includes(heading),
      )
    if (fixture && path) {
      const expectedLogo =
        path === 'otoslotto/'
          ? '/images/logos/otoslotto.png'
          : path === 'hatoslotto/'
            ? '/images/logos/hatoslotto.png'
            : '/images/logos/skandinav-lotto.png'
      assert.equal(
        document.querySelector('main header img')?.getAttribute('src'),
        expectedLogo,
      )
      const results = [
        ...(document
          .querySelector('#history-heading')
          ?.closest('section')
          ?.querySelectorAll('ol li p') ?? []),
      ]
        .map((item) => item.textContent)
        .join(' ')
      assert.ok(
        results.includes(
          path === 'skandinav-lotto/'
            ? '1, 5, 12, 23, 30, 34, 35'
            : path === 'hatoslotto/'
              ? '1, 12, 23, 34, 44, 45'
              : '1, 12, 23, 34, 45',
        ),
      )
      assert.ok(
        document.querySelector('table caption')?.textContent.includes(heading),
      )
      assert.ok(document.querySelector('#parity-heading'))
      assert.ok(
        document
          .querySelector('#trends-heading')
          ?.closest('section')
          ?.querySelector('table'),
      )
      assert.ok(
        document
          .querySelector('#pairs-heading')
          ?.closest('section')
          ?.querySelector('table'),
      )
      assert.ok(document.querySelector('form input[name="year"]'))
      assert.equal(document.querySelectorAll('main svg[tabindex]').length, 0)
      assert.ok(document.querySelector('#history-heading'))
      assert.ok(document.querySelector('#prizes-heading'))
      if (path === 'skandinav-lotto/') {
        assert.ok(results.includes('2, 6, 13, 24, 29, 33, 35'))
        assert.ok(results.includes('Gépi számsor'))
        assert.ok(results.includes('Kézi számsor'))
      }
    }
    if (fixture && !path) {
      const cards = [...document.querySelectorAll('main article')]
      assert.deepEqual(
        cards.map((card) => card.querySelector('h3')?.textContent),
        ['Ötöslottó', 'Hatoslottó', 'Skandináv lottó'],
      )
      assert.ok(
        /9\s007\s199\s254\s740\s993,25/u.test(cards[0]?.textContent ?? ''),
      )
      assert.equal(document.querySelectorAll('main img[alt$="logó"]').length, 3)
      assert.deepEqual(
        cards.map((card) =>
          card.querySelector('img[alt$="logó"]')?.getAttribute('src'),
        ),
        [
          '/images/logos/otoslotto.png',
          '/images/logos/hatoslotto.png',
          '/images/logos/skandinav-lotto.png',
        ],
      )
      for (const logo of document.querySelectorAll('main img[alt$="logó"]')) {
        await readFile(`build/client${logo.getAttribute('src')}`)
      }
      assert.equal(
        document.querySelectorAll('main svg[aria-hidden="true"]').length,
        6,
      )
      assert.ok(cards[2]?.textContent.includes('Kézi számsor'))
      assert.ok(cards[2]?.textContent.includes('Gépi számsor'))
    }
    assert.ok(!html.includes(process.env.PRERENDER_API_BASE_URL ?? '\u0000'))
    console.log(`Verified initial Hungarian HTML without JavaScript: /${path}`)
  }
  await readFile('build/client/images/logo.png')
  await readFile('build/client/images/lottery-balls-background.webp')
  await readFile('build/client/favicon.ico')
  await readFile('build/client/theme-bootstrap.js', 'utf8')
  const fallback = await readFile('build/client/__spa-fallback.html', 'utf8')
  const fallbackDocument = new JSDOM(fallback).window.document
  assert.deepEqual(
    [...fallbackDocument.querySelectorAll('meta[name="robots"]')].map(
      (element) => element.content,
    ),
    ['noindex'],
  )
  assert.equal(
    fallbackDocument.querySelectorAll('link[rel="canonical"]').length,
    0,
  )
  assert.equal(
    fallbackDocument.querySelectorAll(
      'meta[property^="og:"], meta[name^="twitter:"]',
    ).length,
    0,
  )
  assert.equal(
    fallbackDocument.querySelectorAll('script[type="application/ld+json"]')
      .length,
    0,
  )
  assert.ok(!fallback.includes('Legutóbbi elérhető sorsolás'))
  const robotsPath = 'build/client/robots.txt'
  const sitemapPath = 'build/client/sitemap.xml'
  if (fixture || !origin) {
    await assert.rejects(readFile(robotsPath))
    await assert.rejects(readFile(sitemapPath))
  } else {
    const robots = await readFile(robotsPath, 'utf8')
    const sitemap = await readFile(sitemapPath, 'utf8')
    assert.match(
      robots,
      /^User-agent: \*\nAllow: \/\nSitemap: (.+)\/sitemap\.xml\n$/u,
    )
    assert.doesNotMatch(robots, /^Disallow:/mu)
    assert.equal(
      robots.match(/^Sitemap: (.+)$/mu)?.[1],
      `${origin}/sitemap.xml`,
    )
    const dom = new JSDOM('')
    const xml = new dom.window.DOMParser().parseFromString(
      sitemap,
      'application/xml',
    )
    assert.equal(xml.querySelector('parsererror'), null)
    const locations = [...xml.querySelectorAll('urlset > url > loc')].map(
      (location) => location.textContent,
    )
    assert.equal(locations.length, 4)
    assert.equal(new Set(locations).size, 4)
    assert.deepEqual(
      locations,
      publicRoutePaths.map((pathname) => `${origin}${pathname}`),
    )
    for (const location of locations) {
      assert.ok(location?.startsWith('https://'))
      assert.ok(!/[?]|localhost|127\.0\.0\.1|\/api\//u.test(location ?? ''))
    }
    assert.ok(!sitemap.includes('<lastmod>'))
    console.log('Verified robots.txt and four canonical sitemap URLs')
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await verifyBuild()
