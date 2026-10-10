export default {
  'apps/web/**/*.{js,mjs,cjs,ts,tsx}': [
    'node scripts/run-staged-tool.mjs eslint --fix',
    'node scripts/run-staged-tool.mjs prettier --write',
  ],
  'apps/web/**/*.{json,css,scss,html,md}':
    'node scripts/run-staged-tool.mjs prettier --write',
  '**/*.php': 'node scripts/run-staged-tool.mjs pint',
}
