import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { fixtureGames, fixtureResponses } from '../src/test/fixtures.ts'
import { verifyBuild } from './verify-build.mjs'

const server = createServer((request, response) => {
  const path = new URL(request.url, 'http://fixture.test').pathname
  const match = /^\/api\/v1\/games\/(five|six|scandinavian)(.*)$/.exec(path)
  let body
  if (path === '/api/v1/games') body = fixtureGames
  else if (match) {
    const fixtures = fixtureResponses(match[1])
    const endpoints = {
      '': fixtures.game,
      '/drawings/latest': fixtures.drawing,
      '/statistics/summary': fixtures.summary,
      '/statistics/frequencies':
        new URL(request.url, 'http://fixture.test').searchParams.get('sort') ===
        'most'
          ? fixtures.mostFrequencies
          : new URL(request.url, 'http://fixture.test').searchParams.get(
                'sort',
              ) === 'least'
            ? fixtures.leastFrequencies
            : fixtures.frequencies,
      '/statistics/parity': fixtures.parity,
      '/drawings': fixtures.history,
      '/drawings/7': fixtures.drawing,
    }
    body = endpoints[match[2]]
  }
  response.writeHead(body ? 200 : 404, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(body ?? { message: 'Fixture endpoint missing' }))
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
try {
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Fixture server did not bind a port')
  console.log(
    'TEST FIXTURE BUILD: generated output is synthetic and must never be deployed.',
  )
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['run', 'build'],
      {
        stdio: 'inherit',
        shell: process.platform === 'win32',
        env: {
          ...process.env,
          PRERENDER_API_BASE_URL: `http://127.0.0.1:${address.port}/api/v1`,
        },
      },
    )
    child.on('error', reject)
    child.on('exit', resolve)
  })
  if (exitCode !== 0) throw new Error(`Fixture build failed (${exitCode})`)
  await verifyBuild(true)
} finally {
  await new Promise((resolve) => server.close(resolve))
}
