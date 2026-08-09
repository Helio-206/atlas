import assert from 'node:assert/strict'

import { chromium } from 'playwright'

const baseUrl = process.env.ATLAS_TEST_BASE_URL ?? 'http://127.0.0.1:3000'
const password = process.env.ATLAS_DEMO_PASSWORD
if (!password) throw new Error('ATLAS_DEMO_PASSWORD is required for demo request E2E')

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const page = await context.newPage()
const leadName = `Commercial Lead ${Date.now()}`

async function login(email) {
  await page.goto(`${baseUrl}/login`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL((url) => url.pathname === '/dashboard')
}

try {
  await page.goto(baseUrl)
  await page.locator('a[href="#demo"]').first().click()
  await page.getByLabel('Nome', { exact: true }).fill(leadName)
  await page.getByLabel('Empresa', { exact: true }).fill('Empresa Piloto E2E')
  await page.getByLabel('Email', { exact: true }).fill(`commercial-${Date.now()}@example.com`)
  await page.getByLabel('Telefone', { exact: true }).fill('+244 923 000 099')
  await page.getByLabel('Cargo', { exact: true }).fill('Diretor de Operações')
  await page.getByLabel(/Mensagem/).fill('Qualificação comercial autocontida.')
  await page.getByRole('button', { name: 'Solicitar demonstração' }).click()
  await page.getByRole('status').waitFor()

  await login('admin@atlas.demo')
  await page.goto(`${baseUrl}/dashboard/admin/demo-requests`)
  await page.waitForURL((url) => url.pathname === '/dashboard/admin/demo-requests')

  const leadRow = page.locator('tr', { hasText: leadName })
  await leadRow.waitFor()
  const notes = leadRow.locator('textarea[name="internal_notes"]')
  await notes.fill('Contactar após a discovery de Procurement.')
  await leadRow.locator('select[name="status"]').selectOption('contacted')
  await leadRow.getByRole('button', { name: 'Guardar' }).click()
  await page.waitForURL((url) => url.pathname === '/dashboard/admin/demo-requests' && url.searchParams.get('notice') === 'updated' && url.searchParams.get('version') === '2')
  const updatedRow = page.locator('tr', { hasText: leadName })
  assert.match(await updatedRow.innerText(), /Contactado/)
  assert.equal(await updatedRow.locator('textarea[name="internal_notes"]').inputValue(), 'Contactar após a discovery de Procurement.')

  await updatedRow.locator('select[name="status"]').selectOption('won')
  await updatedRow.locator('input[name="pilot_active"]').check()
  await updatedRow.getByRole('button', { name: 'Guardar' }).click()
  await page.waitForURL((url) => url.pathname === '/dashboard/admin/demo-requests' && url.searchParams.get('notice') === 'updated' && url.searchParams.get('version') === '3')
  const wonRow = page.locator('tr', { hasText: leadName })
  assert.match(await wonRow.innerText(), /Ganho/)
  assert.equal(await wonRow.locator('input[name="pilot_active"]').isChecked(), true)
  assert.match(await page.getByRole('region', { name: 'Métricas comerciais' }).innerText(), /Pilotos ativos\s+[1-9]/)

  await page.getByRole('button', { name: 'Terminar sessão' }).click()
  await page.waitForURL((url) => url.pathname === '/login')
  await page.getByLabel('Email').fill('requester@atlas.demo')
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL((url) => url.pathname === '/dashboard')
  const response = await page.goto(`${baseUrl}/dashboard/admin/demo-requests`)
  assert.equal(response?.status(), 404)

  console.log('Demo request administration and authorization flow passed.')
} finally {
  await context.close()
  await browser.close()
}
