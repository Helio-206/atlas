import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { chromium } from 'playwright'

const baseUrl = process.env.ATLAS_TEST_BASE_URL ?? 'http://127.0.0.1:3000'
const fixture = JSON.parse(readFileSync('/tmp/atlas-procurement-e2e.json', 'utf8'))
const requestPath = `/dashboard/procurement/${fixture.sourcingPurchaseRequestId}`

async function waitForPath(page, pathname) {
  await page.waitForURL((url) => url.pathname === pathname)
  assert.equal(new URL(page.url()).pathname, pathname)
}

async function login(page) {
  await page.goto(`${baseUrl}/login`)
  await page.getByLabel('Email').fill(fixture.accounts.procurementOfficer.email)
  await page.getByLabel('Password').fill(fixture.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await waitForPath(page, '/dashboard')
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const page = await context.newPage()

try {
  await login(page)
  await page.goto(`${baseUrl}${requestPath}`)

  const requestBeforeOrder = await page.locator('main').innerText()
  assert.match(requestBeforeOrder, /Fornecedor selecionado/i)
  assert.match(requestBeforeOrder, /Supplier A E2E/)

  await page.getByRole('button', { name: 'Issue Purchase Order' }).click()
  await page.waitForURL((url) => /^\/dashboard\/purchase-orders\/[0-9a-f-]{36}$/.test(url.pathname) && url.searchParams.get('notice') === 'purchase_order_issued')
  const purchaseOrderPath = new URL(page.url()).pathname
  assert.match(purchaseOrderPath, /^\/dashboard\/purchase-orders\/[0-9a-f-]{36}$/)

  const issuedText = await page.locator('main').innerText()
  assert.match(issuedText, /PO-[0-9]{4}-[0-9]{6}/)
  assert.match(issuedText, /Supplier A E2E/)
  assert.match(issuedText, /Procurement E2E Project/)
  assert.match(issuedText, /QA-E2E/)
  assert.match(issuedText, /issued/i)
  assert.match(issuedText, /Cimento Portland/)
  assert.match(issuedText, /Areia lavada/)

  await page.getByLabel('Receive Cimento Portland').fill('1')
  await page.getByLabel('Receive Areia lavada').fill('2')
  await page.getByLabel('Notes').fill('Receção parcial E2E')
  await page.getByRole('button', { name: 'Confirm Receipt' }).click()
  await page.waitForURL((url) => url.pathname === purchaseOrderPath && url.searchParams.get('notice') === 'goods_receipt_recorded')

  const partialText = await page.locator('main').innerText()
  assert.match(partialText, /partially received/i)
  assert.match(partialText, /GR-[0-9]{4}-[0-9]{6}/)
  assert.match(partialText, /1 saco/)
  assert.match(partialText, /Receipt Progress: 1\/2 items · 50%/)

  const cementInput = page.getByLabel('Receive Cimento Portland')
  await cementInput.evaluate((element) => element.removeAttribute('max'))
  await cementInput.fill('2')
  await page.getByRole('button', { name: 'Confirm Receipt' }).click()
  await page.waitForURL((url) => url.pathname === purchaseOrderPath && url.searchParams.get('error') === 'over_receipt')
  assert.match(await page.locator('main').innerText(), /ultrapassa a quantidade restante/i)
  assert.match(await page.locator('main').innerText(), /partially received/i)

  await page.getByLabel('Receive Cimento Portland').fill('1')
  await page.getByLabel('Notes').fill('Receção final E2E')
  await page.getByRole('button', { name: 'Confirm Receipt' }).click()
  await page.waitForURL((url) => url.pathname === purchaseOrderPath && url.searchParams.get('notice') === 'goods_receipt_recorded')

  const receivedText = await page.locator('main').innerText()
  assert.match(receivedText, /received/i)
  assert.match(receivedText, /Receipt Progress: 2\/2 items · 100%/)
  assert.equal(await page.getByRole('button', { name: 'Confirm Receipt' }).count(), 0)

  await page.goto(`${baseUrl}${requestPath}`)
  const completedRequestText = await page.locator('main').innerText()
  assert.match(completedRequestText, /Recebida/i)
  assert.match(completedRequestText, /Purchase Order Issued/)
  assert.match(completedRequestText, /Partially Received/)
  assert.match(completedRequestText, /Received/)
  assert.match(completedRequestText, /PO-[0-9]{4}-[0-9]{6}/)

  console.log('Purchase Order and Goods Receipt browser integration flow passed.')
} finally {
  await browser.close()
}
