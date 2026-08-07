import assert from 'node:assert/strict'

import { chromium } from 'playwright'

const baseUrl = process.env.ATLAS_TEST_BASE_URL ?? 'http://127.0.0.1:3000'
const password = 'Atlas-Projects-2026!'
const email = `atlas-projects-${Date.now()}@example.com`

async function waitForPath(page, pathname) {
  await page.waitForURL((url) => url.pathname === pathname)
  assert.equal(new URL(page.url()).pathname, pathname)
}

async function waitForProjectDetail(page) {
  await page.waitForURL((url) => /^\/dashboard\/projects\/[0-9a-f-]{36}$/.test(url.pathname))
  const pathname = new URL(page.url()).pathname
  assert.match(pathname, /^\/dashboard\/projects\/[0-9a-f-]{36}$/)
  return pathname
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
  assert.match(await page.locator('main').innerText(), /Ainda não existem projetos/)

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

  await page.getByLabel('Data final').fill('2026-12-20')
  await page.getByLabel('Cliente').fill('Cliente Browser')
  await page.getByLabel('Localização').fill('Luanda')
  await page.getByRole('button', { name: 'Criar projeto' }).click()
  const detailPath = await waitForProjectDetail(page)

  assert.match(await page.locator('main').innerText(), /Draft/)
  assert.match(await page.locator('main').innerText(), /WEB-001 · versão 1/)

  await page.getByRole('button', { name: 'Ativar projeto' }).click()
  await page.waitForURL((url) =>
    url.pathname === detailPath && url.searchParams.get('notice') === 'activated',
  )
  assert.match(await page.locator('main').innerText(), /Ativo/)
  assert.match(await page.locator('main').innerText(), /WEB-001 · versão 2/)

  await page.getByLabel('Nome').fill('Obra Browser Revista')
  await page.getByRole('button', { name: 'Guardar alterações' }).click()
  await page.waitForURL((url) =>
    url.pathname === detailPath && url.searchParams.get('notice') === 'updated',
  )
  assert.match(await page.locator('main').innerText(), /Obra Browser Revista/)
  assert.match(await page.locator('main').innerText(), /WEB-001 · versão 3/)

  await page.getByRole('button', { name: 'Suspender projeto' }).click()
  await page.waitForURL((url) =>
    url.pathname === detailPath && url.searchParams.get('notice') === 'suspended',
  )
  assert.match(await page.locator('main').innerText(), /Suspenso/)
  assert.match(await page.locator('main').innerText(), /WEB-001 · versão 4/)

  await page.getByRole('button', { name: 'Encerrar projeto' }).click()
  await page.waitForURL((url) =>
    url.pathname === detailPath && url.searchParams.get('notice') === 'closed',
  )
  assert.match(await page.locator('main').innerText(), /Fechado/)
  assert.match(await page.locator('main').innerText(), /WEB-001 · versão 5/)
  assert.equal(await page.getByRole('button', { name: 'Guardar alterações' }).count(), 0)

  await page.goto(`${baseUrl}/dashboard/projects`)
  await waitForPath(page, '/dashboard/projects')
  assert.match(await page.locator('main').innerText(), /Obra Browser Revista/)
  assert.match(await page.locator('main').innerText(), /Fechado/)

  console.log('Projects browser integration flow passed.')
} finally {
  await browser.close()
}
