import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { chromium } from 'playwright'

const baseUrl = process.env.ATLAS_TEST_BASE_URL ?? 'http://127.0.0.1:3000'
const fixture = JSON.parse(readFileSync('/tmp/atlas-procurement-e2e.json', 'utf8'))
const requestPath = `/dashboard/procurement/${fixture.sourcingPurchaseRequestId}`
const quotationsPath = `${requestPath}/quotations`

async function waitForPath(page, pathname) {
  await page.waitForURL((url) => url.pathname === pathname)
  assert.equal(new URL(page.url()).pathname, pathname)
}

async function login(page, account) {
  await page.goto(`${baseUrl}/login`)
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(fixture.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await waitForPath(page, '/dashboard')
}

async function createSupplier(page, { name, taxNumber }) {
  await page.goto(`${baseUrl}/dashboard/suppliers/new`)
  await page.getByLabel('Nome').fill(name)
  await page.getByLabel('NIF').fill(taxNumber)
  await page.getByLabel('Email').fill(`${taxNumber.toLowerCase()}@example.com`)
  await page.getByRole('button', { name: 'Criar fornecedor' }).click()
  await page.waitForURL((url) => /^\/dashboard\/suppliers\/[0-9a-f-]{36}$/.test(url.pathname) && url.searchParams.get('notice') === 'supplier_created')
  const path = new URL(page.url()).pathname
  assert.match(await page.locator('main').innerText(), new RegExp(name))
  return path
}

async function createQuotation(page, { supplierName, number, prices, partial = false, deliveryDays }) {
  await page.goto(`${baseUrl}${quotationsPath}`)
  await page.getByText('Registar nova cotação').click()
  const quotationForm = page.locator('form', { has: page.getByRole('button', { name: 'Registar cotação' }) })
  await quotationForm.getByLabel('Fornecedor').selectOption({ label: supplierName })
  await quotationForm.getByLabel('Número da cotação').fill(number)
  await quotationForm.getByLabel('Moeda').selectOption('AOA')
  await quotationForm.getByLabel('Imposto').fill('0')
  await quotationForm.getByLabel('Válida até').fill('2026-12-20')
  await quotationForm.getByLabel('Prazo de entrega (dias)').fill(String(deliveryDays))
  await quotationForm.getByLabel('Condições de pagamento').fill('30 dias')

  if (partial) {
    await quotationForm.getByRole('button', { name: 'Remover' }).last().click()
  }

  const priceInputs = quotationForm.locator('label', { hasText: 'Preço unit.' }).locator('input')
  assert.equal(await priceInputs.count(), prices.length)
  for (let index = 0; index < prices.length; index += 1) {
    await priceInputs.nth(index).fill(String(prices[index]))
  }

  await quotationForm.getByRole('button', { name: 'Registar cotação' }).click()
  await page.waitForURL((url) => url.pathname === quotationsPath && url.searchParams.get('notice') === 'quotation_created')
  const text = await page.locator('main').innerText()
  assert.match(text, new RegExp(supplierName))
  if (partial) assert.match(text, /item não cotado/)

  const draftColumn = page.locator('th', { has: page.getByRole('button', { name: 'Submeter cotação' }) })
  await draftColumn.getByRole('button', { name: 'Submeter cotação' }).click()
  await page.waitForURL((url) => url.pathname === quotationsPath && url.searchParams.get('notice') === 'quotation_submitted')
  assert.match(await page.locator('main').innerText(), new RegExp(`${supplierName}[\\s\\S]*submitted`, 'i'))
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const page = await context.newPage()

try {
  await login(page, fixture.accounts.procurementOfficer)

  const supplierAPath = await createSupplier(page, {
    name: 'Supplier A E2E',
    taxNumber: 'E2E-A-001',
  })
  const supplierBPath = await createSupplier(page, {
    name: 'Supplier B E2E',
    taxNumber: 'E2E-B-001',
  })

  await createQuotation(page, {
    supplierName: 'Supplier A E2E',
    number: 'QA-E2E',
    prices: [90000, 40000],
    deliveryDays: 5,
  })
  await createQuotation(page, {
    supplierName: 'Supplier B E2E',
    number: 'QB-E2E',
    prices: [80000],
    partial: true,
    deliveryDays: 2,
  })

  await page.goto(`${baseUrl}${quotationsPath}`)
  const comparisonText = await page.locator('main').innerText()
  assert.match(comparisonText, /Supplier A E2E/)
  assert.match(comparisonText, /Supplier B E2E/)
  assert.match(comparisonText, /Menor preço/)
  assert.match(comparisonText, /Entrega mais rápida/)
  assert.match(comparisonText, /Cobertura completa/)
  assert.match(comparisonText, /item não cotado/)

  await page.goto(`${baseUrl}${supplierBPath}`)
  await page.getByRole('button', { name: 'Bloquear' }).click()
  await page.waitForURL((url) => url.pathname === supplierBPath && url.searchParams.get('notice') === 'supplier_blocked')
  assert.match(await page.locator('main').innerText(), /blocked/i)

  await page.goto(`${baseUrl}${quotationsPath}`)
  const selectionSection = page.locator('section', { hasText: 'Selecionar fornecedor' })
  assert.match(await selectionSection.innerText(), /Fornecedor bloqueado/)
  assert.equal(await selectionSection.getByRole('button', { name: 'Selecionar' }).count(), 1)

  await selectionSection.getByRole('button', { name: 'Selecionar' }).click()
  await selectionSection.getByLabel('Justificação (obrigatória)').fill('Melhor equilíbrio entre preço, cobertura e prazo.')
  await selectionSection.getByRole('button', { name: 'Confirmar seleção' }).click()
  await page.waitForURL((url) => url.pathname === quotationsPath && url.searchParams.get('notice') === 'supplier_selected')
  const selectedText = await page.locator('main').innerText()
  assert.match(selectedText, /selected supplier/i)
  assert.match(selectedText, /Supplier A E2E/)
  assert.match(selectedText, /Melhor equilíbrio entre preço, cobertura e prazo\./)

  await page.goto(`${baseUrl}${requestPath}`)
  const requestText = await page.locator('main').innerText()
  assert.match(requestText, /Fornecedor selecionado/i)
  assert.match(requestText, /selected supplier/i)
  assert.match(requestText, /Supplier A E2E/)

  assert.match(supplierAPath, /^\/dashboard\/suppliers\/[0-9a-f-]{36}$/)

  console.log('Sourcing browser integration flow passed.')
} finally {
  await browser.close()
}
