import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'

export async function verifyBuild(fixture = false) {
  for (const [path, title, heading = title] of [
    ['', 'Lottóeredmények és statisztikák', 'A számok mögött.'],
    ['otoslotto/', 'Ötöslottó'],
    ['hatoslotto/', 'Hatoslottó'],
    ['skandinav-lotto/', 'Skandináv lottó'],
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
    assert.ok(document.title.includes(title))
    assert.ok(
      document.querySelector('meta[name="description"]')?.content.length > 30,
    )
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
        document.querySelector('table caption')?.textContent.includes(title),
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
        document.querySelector('table caption')?.textContent.includes(title),
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
  await readFile('build/client/favicon.ico')
  await readFile('build/client/theme-bootstrap.js', 'utf8')
  const fallback = await readFile('build/client/__spa-fallback.html', 'utf8')
  assert.ok(!fallback.includes('Legutóbbi elérhető sorsolás'))
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await verifyBuild()
