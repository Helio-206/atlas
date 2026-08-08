import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('Provide at least one SQL contract file.')
  process.exit(2)
}

const containerResult = spawnSync(
  'docker',
  ['ps', '--filter', 'label=com.supabase.cli.project=atlas', '--filter', 'name=supabase_db_', '--format', '{{.Names}}'],
  { encoding: 'utf8' },
)

if (containerResult.status !== 0) {
  process.stderr.write(containerResult.stderr)
  process.exit(containerResult.status ?? 1)
}

const container = containerResult.stdout.trim().split('\n').filter(Boolean)[0]
if (!container) {
  console.error('Atlas Supabase database container was not found. Run `pnpm exec supabase start` first.')
  process.exit(1)
}

for (const file of files) {
  console.log(`\n[sql-contract] ${file}`)
  const result = spawnSync(
    'docker',
    ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
    { input: readFileSync(file, 'utf8'), encoding: 'utf8' },
  )

  process.stdout.write(result.stdout ?? '')
  process.stderr.write(result.stderr ?? '')
  if (result.status !== 0) process.exit(result.status ?? 1)
}
