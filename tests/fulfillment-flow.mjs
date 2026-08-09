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

  await page.getByRole('button', { name: 'Emitir ordem de compra' }).click()
  await page.waitForURL((url) => /^\/dashboard\/purchase-orders\/[0-9a-f-]{36}$/.test(url.pathname) && url.searchParams.get('notice') === 'purchase_order_issued')
  const purchaseOrderPath = new URL(page.url()).pathname
  assert.match(purchaseOrderPath, /^\/dashboard\/purchase-orders\/[0-9a-f-]{36}$/)

  const issuedText = await page.locator('main').innerText()
  assert.match(issuedText, /PO-[0-9]{4}-[0-9]{6}/)
  assert.match(issuedText, /Supplier A E2E/)
  assert.match(issuedText, /Procurement E2E Project/)
  assert.match(issuedText, /QA-E2E/)
  assert.match(issuedText, /Emitida/i)
  assert.match(issuedText, /Cimento Portland/)
  assert.match(issuedText, /Areia lavada/)

  await page.getByRole('link', { name: 'Registar receção' }).first().click()
  await page.getByLabel('Receber Cimento Portland').fill('1')
  await page.getByLabel('Receber Areia lavada').fill('2')
  await page.getByLabel('Notas').fill('Receção parcial E2E')
  await page.getByRole('button', { name: 'Registar receção' }).last().click()
  await page.waitForURL((url) => url.pathname === purchaseOrderPath && url.searchParams.get('notice') === 'goods_receipt_recorded')

  const partialText = await page.locator('main').innerText()
  assert.match(partialText, /Parcialmente recebida/i)
  assert.match(partialText, /GR-[0-9]{4}-[0-9]{6}/)
  assert.match(partialText, /1 saco/)
  assert.match(partialText, /Progresso de receção: 1\/2 itens completos · 50%/)

  await page.getByRole('link', { name: 'Registar receção' }).first().click()
  const cementInput = page.getByLabel('Receber Cimento Portland')
  await cementInput.fill('1')
  await cementInput.evaluate((element) => element.removeAttribute('max'))
  await page.locator('#goods-receipt-form').evaluate((form) => {
    form.addEventListener('submit', () => {
      const input = form.querySelector('input[aria-label="Receber Cimento Portland"]')
      input.value = '2'
    }, { capture: true, once: true })
  })
  await page.getByRole('button', { name: 'Registar receção' }).last().click()
  await page.waitForURL((url) => url.pathname === purchaseOrderPath && url.searchParams.get('error') === 'over_receipt')
  assert.match(await page.locator('main').innerText(), /ultrapassa a quantidade restante/i)
  assert.match(await page.locator('main').innerText(), /Parcialmente recebida/i)

  await page.getByRole('link', { name: 'Registar receção' }).first().click()
  await page.getByLabel('Receber Cimento Portland').fill('1')
  await page.getByLabel('Notas').fill('Receção final E2E')
  await page.getByRole('button', { name: 'Registar receção' }).last().click()
  await page.waitForURL((url) => url.pathname === purchaseOrderPath && url.searchParams.get('notice') === 'goods_receipt_recorded')

  const receivedText = await page.locator('main').innerText()
  assert.match(receivedText, /received/i)
  assert.match(receivedText, /Progresso de receção: 2\/2 itens completos · 100%/)
  assert.equal(await page.getByRole('link', { name: 'Registar receção' }).count(), 0)

  await page.goto(`${baseUrl}${requestPath}`)
  const completedRequestText = await page.locator('main').innerText()
  assert.match(completedRequestText, /Recebida/i)
  assert.match(completedRequestText, /Ordem de compra/i)
  assert.match(completedRequestText, /Receções/i)
  assert.match(completedRequestText, /PO-[0-9]{4}-[0-9]{6}/)

  console.log('Purchase Order and Goods Receipt browser integration flow passed.')
} finally {
  await browser.close()
}
