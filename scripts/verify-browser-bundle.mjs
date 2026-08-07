import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const browserBundleDirectory = resolve(process.cwd(), '.next', 'static')

if (!existsSync(browserBundleDirectory)) {
  throw new Error('Browser bundle directory .next/static was not generated')
}

const forbiddenValues = [
  'SUPABASE_SERVICE_ROLE_KEY',
  process.env.SUPABASE_SERVICE_ROLE_KEY,
].filter((value) => typeof value === 'string' && value.length > 0)

function listFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)

    return statSync(path).isDirectory() ? listFiles(path) : [path]
  })
}

for (const file of listFiles(browserBundleDirectory)) {
  const content = readFileSync(file, 'utf8')

  if (forbiddenValues.some((value) => content.includes(value))) {
    throw new Error(
      `Server-only Supabase credentials were detected in browser bundle: ${file}`,
    )
  }
}

console.log('Browser bundle contains no Supabase service-role credential markers.')
