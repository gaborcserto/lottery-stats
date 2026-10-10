import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tool = process.argv[2]
const args = process.argv.slice(3)
const files = args.filter((argument) => !argument.startsWith('-'))
const flags = args.filter((argument) => argument.startsWith('-'))

if (!['eslint', 'prettier', 'pint'].includes(tool) || files.length === 0) {
  throw new Error('Expected a supported tool and at least one staged file.')
}

const app = tool === 'pint' ? 'api' : 'web'
const appDirectory = path.join(repositoryRoot, 'apps', app)
const relativeFiles = files.map((file) => {
  const absoluteFile = path.resolve(file)
  const relativeFile = path.relative(appDirectory, absoluteFile)
  if (
    relativeFile === '..' ||
    relativeFile.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeFile)
  ) {
    throw new Error(`${tool} cannot access a staged file outside apps/${app}: ${file}`)
  }

  return relativeFile.split(path.sep).join('/')
})

const command =
  tool === 'pint'
    ? ['vendor/bin/pint', ...relativeFiles]
    : [
        'node',
        tool === 'eslint'
          ? 'node_modules/eslint/bin/eslint.js'
          : 'node_modules/prettier/bin/prettier.cjs',
        ...flags,
        ...relativeFiles,
      ]

const result = spawnSync(
  'docker',
  ['compose', 'exec', '-T', app, ...command],
  { cwd: repositoryRoot, stdio: 'inherit' },
)

if (result.error) {
  throw new Error(`Could not run ${tool} through Docker Compose: ${result.error.message}`)
}

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}
