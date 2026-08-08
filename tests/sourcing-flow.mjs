import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { chromium } from 'playwright'

const baseUrl = process.env.ATLAS_TEST_BASE_URL ?? 'http://127.0.0.1:3000'
const fixture = JSON.parse(readFileSync('/tmp/atlas-sourcing-e2e.json', 'utf8'))

async function login(page) {
  await page.goto(`${baseUrl}/login`)
  await page.getByLabel('Email').fill(fixture.officer.email)
  await page.getByLabel('Password').fill(fixture.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL((url) => url.pathname === '/dashboard')
}

async function createSupplier(page, { name, taxNumber }) {
  await page.goto(`${baseUrl}/dashboard/suppliers/new`)
  await page.getByLabel('Nome').fill(name)
  await page.getByLabel('NIF').fill(taxNumber)
  await page.getByLabel('Email').fill(`${taxNumber.toLowerCase()}@example.com`)
  await page.getByRole('button', { name: 'Criar fornecedor' }).click()
  await page.waitForURL((url) => /^\/dashboard\/suppliers\/[0-9a-f-]{36}$/.test(url.pathname))
  return new URL(page.url()).pathname
}

async function createQuotation(page, { requestId, supplierName, quotationNumber, currency, deliveryDays, price, partial = false }) {
  const path = `/dashboard/procurement/${requestId}/quotations`
  await page.goto(`${baseUrl}${path}`)
  await page.getByLabel('Fornecedor').selectOption({ label: supplierName })
  await page.getByLabel('Número da cotação').fill(quotationNumber)
  await page.getByLabel('Moeda').selectOption(currency)
  await page.getByLabel('Prazo de entrega (dias)').fill(String(deliveryDays))
  await page.getByLabel('Condições de pagamento').fill('30 dias')

  if (partial) {
    await page.getByRole('button', { name: 'Remover' }).last().click()
  }

  const itemCards = page.locator('form').filter({ has: page.getByRole('button', { name: 'Registar cotação' }) }).locator('.space-y-3 > div')
  const count = await itemCards.count()
  assert.ok(count > 0, 'Quotation form has no request items')
  for (let index = 0; index < count; index += 1) {
    await itemCards.nth(index).locator('input[type="number"]').nth(1).fill(String(price))
  }

  await page.getByRole('button', { name: 'Registar cotação' }).click()
  await page.waitForURL((url) => url.pathname === path && url.searchParams.get('notice') === 'quotation_created')

  const row = page.locator('tbody tr').filter({ hasText: supplierName })
  await row.getByRole('button', { name: 'Submit quotation' }).click()
  await page.waitForURL((url) => url.pathname === path && url.searchParams.get('notice') === 'quotation_submitted')
  return path
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

try {
  await login(page)

  const supplierAPath = await createSupplier(page, { name: 'Supplier A E2E', taxNumber: 'E2E-A' })
  const supplierBPath = await createSupplier(page, { name: 'Supplier B E2E', taxNumber: 'E2E-B' })
  const supplierCPath = await createSupplier(page, { name: 'Supplier C E2E', taxNumber: 'E2E-C' })

  await createQuotation(page, {
    requestId: fixture.mainRequestId,
    supplierName: 'Supplier A E2E',
    quotationNumber: 'QA-E2E',
    currency: 'AOA',
    deliveryDays: 5,
    price: 90000,
  })
  const comparisonPath = await createQuotation(page, {
    requestId: fixture.mainRequestId,
    supplierName: 'Supplier B E2E',
    quotationNumber: 'QB-E2E',
    currency: 'USD',
    deliveryDays: 3,
    price: 100,
    partial: true,
  })

  await page.goto(`${baseUrl}${comparisonPath}`)
  const comparisonText = await page.locator('main').innerText()
  assert.match(comparisonText, /Partial quotation/)
  assert.match(comparisonText, /Quotations in different currencies cannot be directly compared without an exchange rate\./)
  assert.doesNotMatch(comparisonText, /Lowest Price/)
  assert.match(comparisonText, /Fastest Delivery/)
  assert.match(comparisonText, /Best Coverage/)

  const supplierARow = page.locator('tbody tr').filter({ hasText: 'Supplier A E2E' })
  await supplierARow.getByPlaceholder('Justificação da seleção').fill('Cobertura completa e condições comerciais adequadas')
  await supplierARow.getByRole('button', { name: 'Select supplier' }).click()
  await page.waitForURL((url) => url.pathname === comparisonPath && url.searchParams.get('notice') === 'supplier_selected')
  assert.match(await page.locator('main').innerText(), /Selected Supplier/)
  assert.match(await page.locator('main').innerText(), /Supplier A E2E/)

  await page.goto(`${baseUrl}/dashboard/procurement/${fixture.mainRequestId}`)
  assert.match(await page.locator('main').innerText(), /Fornecedor selecionado/)
  assert.match(await page.locator('main').innerText(), /Cobertura completa e condições comerciais adequadas/)

  await createQuotation(page, {
    requestId: fixture.blockedRequestId,
    supplierName: 'Supplier C E2E',
    quotationNumber: 'QC-E2E',
    currency: 'AOA',
    deliveryDays: 2,
    price: 95000,
  })

  await page.goto(`${baseUrl}${supplierCPath}`)
  await page.getByRole('button', { name: 'Bloquear' }).click()
  await page.waitForURL((url) => url.pathname === supplierCPath && url.searchParams.get('notice') === 'supplier_blocked')

  const blockedComparisonPath = `/dashboard/procurement/${fixture.blockedRequestId}/quotations`
  await page.goto(`${baseUrl}${blockedComparisonPath}`)
  const blockedRow = page.locator('tbody tr').filter({ hasText: 'Supplier C E2E' })
  assert.match(await blockedRow.innerText(), /blocked/i)
  assert.match(await blockedRow.innerText(), /Blocked supplier cannot be selected\./)
  assert.equal(await blockedRow.getByRole('button', { name: 'Select supplier' }).count(), 0)

  assert.match(supplierAPath, /^\/dashboard\/suppliers\/[0-9a-f-]{36}$/)
  assert.match(supplierBPath, /^\/dashboard\/suppliers\/[0-9a-f-]{36}$/)
  console.log('Supplier, quotation comparison and selection E2E flow passed.')
} finally {
  await browser.close()
}
