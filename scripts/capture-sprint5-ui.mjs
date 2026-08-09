import { mkdirSync, readFileSync } from 'node:fs'

import { chromium } from 'playwright'

const baseUrl = process.env.ATLAS_TEST_BASE_URL ?? 'http://127.0.0.1:3000'
const fixture = JSON.parse(readFileSync('/tmp/atlas-procurement-e2e.json', 'utf8'))
const outputDirectory = '/tmp/atlas-ui-qa'

mkdirSync(outputDirectory, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1024 } })
const page = await context.newPage()
const errors = []

page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`)
})
page.on('pageerror', (error) => errors.push(`page: ${error.message}`))

async function capture(name, path, viewport) {
  await page.setViewportSize(viewport)
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  await page.screenshot({ path: `${outputDirectory}/${name}.png`, fullPage: false })
  return { name, path: new URL(page.url()).pathname, overflow, viewport }
}

try {
  await page.goto(`${baseUrl}/login`)
  await page.getByLabel('Email').fill(fixture.accounts.procurementOfficer.email)
  await page.getByLabel('Password').fill(fixture.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL((url) => url.pathname === '/dashboard')

  const requestPath = `/dashboard/procurement/${fixture.sourcingPurchaseRequestId}`
  const captures = []
  captures.push(await capture('dashboard-1440', '/dashboard', { width: 1440, height: 1024 }))
  captures.push(await capture('requests-1440', '/dashboard/procurement', { width: 1440, height: 1024 }))
  captures.push(await capture('request-1440', requestPath, { width: 1440, height: 1024 }))
  captures.push(await capture('comparison-1440', `${requestPath}/quotations`, { width: 1440, height: 1024 }))

  await page.goto(`${baseUrl}${requestPath}`, { waitUntil: 'networkidle' })
  const orderLinks = page.locator('a[href^="/dashboard/purchase-orders/"]')
  let orderHref = await orderLinks.count() ? await orderLinks.first().getAttribute('href') : null
  if (!orderHref && await page.getByRole('button', { name: 'Emitir ordem de compra' }).count()) {
    await page.getByRole('button', { name: 'Emitir ordem de compra' }).click()
    await page.waitForURL((url) => url.pathname.startsWith('/dashboard/purchase-orders/'))
    orderHref = new URL(page.url()).pathname
  }
  if (orderHref) {
    captures.push(await capture('order-1440', orderHref, { width: 1440, height: 1024 }))
    const receiptHref = await page.getByRole('link', { name: 'Registar receção' }).first().getAttribute('href')
    if (receiptHref) {
      captures.push(await capture('receipt-1440', receiptHref, { width: 1440, height: 1024 }))
      const firstReceiptInput = page.locator('input[aria-label^="Receber "]:not([disabled])').first()
      const maximum = Number(await firstReceiptInput.getAttribute('max'))
      await firstReceiptInput.fill(String(maximum + 1))
      await page.screenshot({ path: `${outputDirectory}/receipt-error-1440.png`, fullPage: false })
    }
  }

  for (const width of [1024, 768, 390]) {
    captures.push(await capture(`dashboard-${width}`, '/dashboard', { width, height: width === 390 ? 844 : 1024 }))
    captures.push(await capture(`request-${width}`, requestPath, { width, height: width === 390 ? 844 : 1024 }))
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Abrir navegação' }).click()
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${outputDirectory}/mobile-navigation-390.png`, fullPage: false })

  console.log(JSON.stringify({ captures, errors }, null, 2))
} finally {
  await browser.close()
}
