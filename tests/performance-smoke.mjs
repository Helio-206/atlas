import assert from 'node:assert/strict'

import { chromium } from 'playwright'

const baseUrl = process.env.ATLAS_TEST_BASE_URL ?? 'http://127.0.0.1:3000'
const password = process.env.ATLAS_DEMO_PASSWORD
if (!password) throw new Error('ATLAS_DEMO_PASSWORD is required')

const paths = [
  '/dashboard',
  '/dashboard/procurement',
  '/dashboard/procurement/d3000000-0000-4000-8000-000000000008',
  '/dashboard/procurement/d3000000-0000-4000-8000-000000000008/quotations',
  '/dashboard/purchase-orders/d5000000-0000-4000-8000-000000000008',
]

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
try {
  await page.goto(`${baseUrl}/login`)
  await page.getByLabel('Email').fill('procurement@atlas.demo')
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL((url) => url.pathname === '/dashboard')

  for (const path of paths) {
    const started = Date.now()
    const response = await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded', timeout: 5000 })
    const elapsed = Date.now() - started
    assert.ok(response?.ok(), `${path} returned ${response?.status()}`)
    assert.ok(elapsed < 5000, `${path} exceeded smoke threshold: ${elapsed}ms`)
    console.log(`[performance-smoke] ${path} ${elapsed}ms`)
  }
} finally {
  await browser.close()
}
