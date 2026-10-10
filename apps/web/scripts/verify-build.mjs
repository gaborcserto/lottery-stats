import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'

export async function verifyBuild(fixture = false) {
  for (const [path, title, heading = title] of [
    ['', 'Lottóeredmények és statisztikák', 'Lottóeredmények, tisztán.'],
    ['otoslotto/', 'Ötöslottó'],
    ['hatoslotto/', 'Hatoslottó'],
    ['skandinav-lotto/', 'Skandináv lottó'],
  ]) {
    const html = await readFile(`build/client/${path}index.html`, 'utf8')
    // Scripts are never executed: assertions inspect the actual initial HTML.
    const { document } = new JSDOM(html).window
    assert.equal(document.documentElement.lang, 'hu')
    assert.ok(document.title.includes(title))
    assert.ok(
      document.querySelector('meta[name="description"]')?.content.length > 30,
    )
    assert.ok(document.querySelector('main h1')?.textContent.includes(heading))
    assert.equal(document.querySelectorAll('main h1').length, 1)
    if (path) assert.ok(document.querySelector('main time'))
    else {
      assert.equal(document.querySelectorAll('main article').length, 3)
      assert.equal(document.querySelectorAll('main article time').length, 3)
    }
    assert.ok(document.querySelector('header nav'))
    assert.ok(document.querySelector('footer'))
    if (path)
      assert.ok(
        document.querySelector('table caption')?.textContent.includes(title),
      )
    if (fixture && path)
      assert.ok(
        document
          .querySelector('main dl')
          ?.textContent.includes(
            path === 'skandinav-lotto/'
              ? '1, 5, 12, 23, 30, 34, 35'
              : '1, 12, 23, 34',
          ),
      )
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
  const fallback = await readFile('build/client/__spa-fallback.html', 'utf8')
  assert.ok(!fallback.includes('Legutóbbi elérhető sorsolás'))
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await verifyBuild()
