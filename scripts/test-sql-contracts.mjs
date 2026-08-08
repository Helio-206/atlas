import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const container = execFileSync(
  'docker',
  [
    'ps',
    '--filter',
    'label=com.supabase.cli.project=atlas',
    '--filter',
    'name=supabase_db_',
    '--format',
    '{{.Names}}',
  ],
  { encoding: 'utf8' },
).trim().split('\n')[0]

if (!container) {
  throw new Error('Atlas Supabase database container is not running')
}

const testFiles = [
  'supabase/tests/atlas_foundation.sql',
  'supabase/tests/rls_isolation.sql',
  'supabase/tests/auth_profile.sql',
  'supabase/tests/company_onboarding.sql',
  'supabase/tests/projects_module.sql',
]

for (const file of testFiles) {
  console.log(`Running ${file}`)
  execFileSync(
    'docker',
    ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
    { input: readFileSync(file), stdio: ['pipe', 'inherit', 'inherit'] },
  )
}
