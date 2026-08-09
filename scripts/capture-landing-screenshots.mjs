import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import { chromium } from 'playwright'

const baseUrl = process.env.ATLAS_TEST_BASE_URL ?? 'http://127.0.0.1:3000'
const password = process.env.ATLAS_DEMO_PASSWORD
if (!password) throw new Error('ATLAS_DEMO_PASSWORD is required to capture authenticated product screenshots.')

const output = path.resolve('public/landing')
await mkdir(output, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 1 })
const page = await context.newPage()

try {
  await page.goto(`${baseUrl}/login`)
  await page.getByLabel('Email').fill('procurement@atlas.demo')
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL((url) => url.pathname === '/dashboard')

  const captures = [
    ['purchase-request-detail.png', '/dashboard/procurement/d3000000-0000-4000-8000-000000000008'],
    ['supplier-comparison.png', '/dashboard/procurement/d3000000-0000-4000-8000-000000000008/quotations'],
    ['purchase-order-detail.png', '/dashboard/purchase-orders/d5000000-0000-4000-8000-000000000008'],
  ]

  for (const [filename, pathname] of captures) {
    await page.goto(`${baseUrl}${pathname}`)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: path.join(output, filename), fullPage: false })
    console.log(`Captured ${filename}`)
  }
} finally {
  await browser.close()
}
