import assert from 'node:assert/strict'

import { chromium } from 'playwright'

const baseUrl = process.env.ATLAS_TEST_BASE_URL ?? 'http://127.0.0.1:3000'
const password = 'Atlas-Projects-2026!'
const email = `atlas-projects-${Date.now()}@example.com`

async function waitForPath(page, pathname) {
  await page.waitForURL((url) => url.pathname === pathname)
  assert.equal(new URL(page.url()).pathname, pathname)
}

async function assertMainContains(page, pattern) {
  await page.waitForFunction(
    ({ source, flags }) => {
      const main = document.querySelector('main')
      return main ? new RegExp(source, flags).test(main.innerText) : false
    },
    { source: pattern.source, flags: pattern.flags },
  )

  assert.match(await page.locator('main').innerText(), pattern)
}

async function waitForProjectDetail(page) {
  await page.waitForURL((url) => {
    const isProjectDetail = /^\/dashboard\/projects\/[0-9a-f-]{36}$/.test(
      url.pathname,
    )
    const isCreationFailure =
      url.pathname === '/dashboard/projects/new' &&
      url.searchParams.get('error') === 'creation_failed'

    return isProjectDetail || isCreationFailure
  })

  const url = new URL(page.url())

  if (url.searchParams.get('error') === 'creation_failed') {
    throw new Error('Project creation failed through the application interface')
  }

  assert.match(url.pathname, /^\/dashboard\/projects\/[0-9a-f-]{36}$/)
  return url.pathname
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const page = await context.newPage()

try {
  await page.goto(`${baseUrl}/dashboard/projects`)
  await waitForPath(page, '/login')

  await page.goto(`${baseUrl}/signup`)
  await page.getByLabel('Nome completo').fill('Atlas Projects Browser')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirmar password').fill(password)
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await waitForPath(page, '/onboarding/company')

  await page.getByLabel('Nome da empresa').fill('Atlas Projects Construction')
  await page.getByRole('button', { name: 'Criar empresa e continuar' }).click()
  await waitForPath(page, '/dashboard')

  await page.goto(`${baseUrl}/dashboard/projects`)
  await waitForPath(page, '/dashboard/projects')
  await assertMainContains(page, /Ainda não existem projetos/)

  await page.getByRole('link', { name: 'Novo projeto' }).click()
  await waitForPath(page, '/dashboard/projects/new')

  await page.getByLabel('Código').fill('WEB-001')
  await page.getByLabel('Nome').fill('Obra Browser')
  await page.getByLabel('Data inicial').fill('2026-09-10')
  await page.getByLabel('Data final').fill('2026-09-01')
  await page.getByRole('button', { name: 'Criar projeto' }).click()
  await page.waitForURL((url) =>
    url.pathname === '/dashboard/projects/new' &&
    url.searchParams.get('error') === 'invalid_form',
  )
  assert.match(
    await page.locator('main [role="alert"]').innerText(),
    /Verifique os dados do projeto/,
  )

  // Server Action validation redirects back to a fresh Server Component, so
  // refill the complete form before the valid submission.
  await page.getByLabel('Código').fill('WEB-001')
  await page.getByLabel('Nome').fill('Obra Browser')
  await page.getByLabel('Cliente').fill('Cliente Browser')
  await page.getByLabel('Localização').fill('Luanda')
  await page.getByLabel('Data inicial').fill('2026-09-10')
  await page.getByLabel('Data final').fill('2026-12-20')
  await page.getByRole('button', { name: 'Criar projeto' }).click()
  const detailPath = await waitForProjectDetail(page)

  await assertMainContains(page, /Draft/)
  await assertMainContains(page, /WEB-001 · versão 1/)

  await page.getByRole('button', { name: 'Ativar projeto' }).click()
  await page.waitForURL((url) =>
    url.pathname === detailPath && url.searchParams.get('notice') === 'activated',
  )
  await assertMainContains(page, /Ativo/)
  await assertMainContains(page, /WEB-001 · versão 2/)

  await page.getByLabel('Nome').fill('Obra Browser Revista')
  await page.getByRole('button', { name: 'Guardar alterações' }).click()
  await page.waitForURL((url) =>
    url.pathname === detailPath && url.searchParams.get('notice') === 'updated',
  )
  await assertMainContains(page, /Obra Browser Revista/)
  await assertMainContains(page, /WEB-001 · versão 3/)

  await page.getByRole('button', { name: 'Suspender projeto' }).click()
  await page.waitForURL((url) =>
    url.pathname === detailPath && url.searchParams.get('notice') === 'suspended',
  )
  await assertMainContains(page, /Suspenso/)
  await assertMainContains(page, /WEB-001 · versão 4/)

  await page.getByRole('button', { name: 'Encerrar projeto' }).click()
  await page.waitForURL((url) =>
    url.pathname === detailPath && url.searchParams.get('notice') === 'closed',
  )
  await assertMainContains(page, /Fechado/)
  await assertMainContains(page, /WEB-001 · versão 5/)
  assert.equal(await page.getByRole('button', { name: 'Guardar alterações' }).count(), 0)

  await page.goto(`${baseUrl}/dashboard/projects`)
  await waitForPath(page, '/dashboard/projects')
  await assertMainContains(page, /Obra Browser Revista/)
  await assertMainContains(page, /Fechado/)

  console.log('Projects browser integration flow passed.')
} finally {
  await browser.close()
}
