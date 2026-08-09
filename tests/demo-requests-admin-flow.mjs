import assert from 'node:assert/strict'

import { chromium } from 'playwright'

const baseUrl = process.env.ATLAS_TEST_BASE_URL ?? 'http://127.0.0.1:3000'
const password = process.env.ATLAS_DEMO_PASSWORD
if (!password) throw new Error('ATLAS_DEMO_PASSWORD is required for demo request E2E')

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const page = await context.newPage()

async function login(email) {
  await page.goto(`${baseUrl}/login`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL((url) => url.pathname === '/dashboard')
}

try {
  await login('admin@atlas.demo')
  await page.goto(`${baseUrl}/dashboard/admin/demo-requests`)
  await page.waitForURL((url) => url.pathname === '/dashboard/admin/demo-requests')

  const leadRow = page.locator('tr', { hasText: 'Helena Manuel' }).first()
  await leadRow.waitFor()
  const notes = leadRow.locator('textarea[name="internal_notes"]')
  await notes.fill('Contactar após a discovery de Procurement.')
  await leadRow.locator('select[name="status"]').selectOption('contacted')
  await leadRow.getByRole('button', { name: 'Guardar' }).click()
  await page.waitForURL((url) => url.pathname === '/dashboard/admin/demo-requests' && url.searchParams.get('notice') === 'updated')
  assert.match(await page.locator('main').innerText(), /Contactado/)

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
