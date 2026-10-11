import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tool = process.argv[2]
const args = process.argv.slice(3)
const files = args.filter((argument) => !argument.startsWith('-'))
const flags = args.filter((argument) => argument.startsWith('-'))

function fail(message) {
  console.error(message)
  process.exit(1)
}

if (!['eslint', 'prettier', 'pint'].includes(tool) || files.length === 0) {
  fail('Expected a supported tool and at least one staged file.')
}

const app = tool === 'pint' ? 'api' : 'web'
const appDirectory = path.join(repositoryRoot, 'apps', app)
const relativeFiles = files.map((file) => {
  // Git Bash may pass /e/... paths to the Windows Node process.
  const windowsFile = file.replace(/^\/([a-z])\//i, (_, drive) => `${drive.toUpperCase()}:/`)
  const absoluteFile = path.resolve(windowsFile)
  const relativeFile = path.relative(appDirectory, absoluteFile)
  if (
    relativeFile === '..' ||
    relativeFile.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeFile)
  ) {
    fail(`${tool} cannot access a staged file outside apps/${app}: ${file}`)
  }

  return relativeFile.split(path.sep).join('/')
})

if (tool === 'eslint' || tool === 'prettier') {
  const executable =
    tool === 'eslint'
      ? 'node_modules/eslint/bin/eslint.js'
      : 'node_modules/prettier/bin/prettier.cjs'
  if (!existsSync(path.join(appDirectory, executable))) {
    fail(
      `${tool} dependencies are missing. Install frontend dependencies with "npm ci" from apps/web, then retry the commit.`,
    )
  }

  const result = spawnSync(
    process.execPath,
    [executable, ...flags, ...relativeFiles],
    { cwd: appDirectory, stdio: 'inherit' },
  )
  if (result.error) {
    fail(`Could not run ${tool} from apps/web: ${result.error.message}`)
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
  process.exit(0)
}

const pintPath = path.join(appDirectory, 'vendor', 'bin', 'pint')
const phpVersion = spawnSync('php', ['-r', 'echo PHP_VERSION;'], {
  cwd: appDirectory,
  encoding: 'utf8',
})
const localPhpIsCompatible =
  !phpVersion.error &&
  phpVersion.status === 0 &&
  /^\d+\.\d+/.test(phpVersion.stdout) &&
  Number(phpVersion.stdout.split('.')[0]) === 8 &&
  Number(phpVersion.stdout.split('.')[1]) >= 3

if (localPhpIsCompatible && existsSync(pintPath)) {
  const result = spawnSync('php', [pintPath, ...relativeFiles], {
    cwd: appDirectory,
    stdio: 'inherit',
  })
  if (result.error) {
    fail(`Could not run local PHP Pint: ${result.error.message}`)
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
  process.exit(0)
}

const result = spawnSync(
  'docker',
  ['compose', 'exec', '-T', 'api', 'vendor/bin/pint', ...relativeFiles],
  { cwd: repositoryRoot, stdio: 'inherit' },
)

if (result.error) {
  fail(
    `Could not run PHP Pint locally (PHP 8.3–8.x and apps/api/vendor/bin/pint are required) or through Docker Compose. Install the backend dependencies locally or start Docker Desktop and the api service. ${result.error.message}`,
  )
}

if (result.status !== 0) {
  console.error(
    'PHP Pint failed through Docker Compose. Check that Docker Desktop is running and the api service is available.',
  )
  process.exit(result.status ?? 1)
}
