import assert from 'node:assert/strict'

import { chromium } from 'playwright'

const baseUrl = process.env.ATLAS_TEST_BASE_URL ?? 'http://127.0.0.1:3000'
const password = process.env.ATLAS_DEMO_PASSWORD
if (!password) throw new Error('ATLAS_DEMO_PASSWORD is required')

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1024 } })
const page = await context.newPage()
const consoleErrors = []
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})

try {
  await page.goto(`${baseUrl}/login`)
  await page.getByLabel('Email').fill('procurement@atlas.demo')
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL((url) => url.pathname === '/dashboard')

  await page.goto(`${baseUrl}/dashboard/procurement`)
  await page.waitForLoadState('networkidle')
  assert.ok(await page.locator('.atlas-document-sheet').count() >= 2, 'purchase requests lost paper surfaces')
  assert.equal(await page.locator('.atlas-document-table').count(), 1, 'purchase request register is not a paper table')

  await page.goto(`${baseUrl}/dashboard/purchase-orders/d5000000-0000-4000-8000-000000000008`)
  await page.waitForLoadState('networkidle')
  assert.ok(await page.locator('.atlas-document-sheet').count() >= 4, 'purchase order lost paper surfaces')
  assert.ok(await page.locator('.atlas-money-paper').count() >= 4, 'purchase order totals lost paper treatment')

  const receiptButton = page.getByRole('link', { name: 'Registar receção', exact: true }).first()
  await receiptButton.hover()
  await page.waitForTimeout(90)
  const hoverTransform = await receiptButton.evaluate((element) => getComputedStyle(element).transform)
  assert.notEqual(hoverTransform, 'none', 'GSAP hover feedback did not run')
  assert.notEqual(hoverTransform, 'matrix(1, 0, 0, 1, 0, 0)', 'GSAP hover feedback stayed at identity')

  await page.mouse.move(0, 0)
  await page.waitForTimeout(240)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`${baseUrl}/dashboard/procurement`)
  await page.waitForLoadState('networkidle')
  const reducedMotionTransform = await page.locator('[data-atlas-motion="header"]').evaluate((element) => element.style.transform)
  assert.equal(reducedMotionTransform, '', 'reduced-motion preference still received GSAP transforms')

  assert.deepEqual(consoleErrors, [], `browser console errors: ${consoleErrors.join('\n')}`)
  console.log('Global GSAP motion, reduced-motion guard, and Procurement paper surfaces passed.')
} finally {
  await browser.close()
}
