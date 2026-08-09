import assert from 'node:assert/strict'

import { chromium } from 'playwright'

const baseUrl = process.env.ATLAS_TEST_BASE_URL ?? 'http://127.0.0.1:3000'
const password = process.env.ATLAS_DEMO_PASSWORD
if (!password) throw new Error('ATLAS_DEMO_PASSWORD is required for demo E2E')

const accounts = {
  requester: 'requester@atlas.demo', technical: 'technical@atlas.demo', finance: 'finance@atlas.demo', director: 'director@atlas.demo',
  procurement: 'procurement@atlas.demo', warehouse: 'warehouse@atlas.demo', admin: 'admin@atlas.demo',
}

async function login(page, email) {
  await page.goto(`${baseUrl}/login`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL((url) => url.pathname === '/dashboard')
}
async function logout(page) {
  await page.goto(`${baseUrl}/dashboard`)
  await page.getByRole('button', { name: 'Terminar sessão' }).click()
  await page.waitForURL((url) => url.pathname === '/login')
}
async function switchUser(page, email) { await logout(page); await login(page, email) }

async function createQuotation(page, quotationsPath, supplierName, number, prices, deliveryDays) {
  await page.goto(`${baseUrl}${quotationsPath}`)
  await page.getByText('Registar nova cotação').click()
  const form = page.locator('form', { has: page.getByRole('button', { name: 'Registar cotação' }) })
  await form.getByLabel('Fornecedor').selectOption({ label: supplierName })
  await form.getByLabel('Número da cotação').fill(number)
  await form.getByLabel('Moeda').selectOption('AOA')
  await form.getByLabel('Imposto').fill('0')
  await form.getByLabel('Válida até').fill('2026-12-20')
  await form.getByLabel('Prazo de entrega (dias)').fill(String(deliveryDays))
  await form.getByLabel('Condições de pagamento').fill('30 dias')
  const priceInputs = form.locator('label', { hasText: 'Preço unit.' }).locator('input')
  assert.equal(await priceInputs.count(), prices.length)
  for (let i=0;i<prices.length;i+=1) await priceInputs.nth(i).fill(String(prices[i]))
  await form.getByRole('button', { name: 'Registar cotação' }).click()
  await page.waitForURL((url) => url.pathname === quotationsPath && url.searchParams.get('notice') === 'quotation_created')
  const draft = page.locator('th', { hasText: supplierName }).filter({ has: page.getByRole('button', { name: 'Submeter cotação' }) })
  await draft.getByRole('button', { name: 'Submeter cotação' }).click()
  await page.waitForURL((url) => url.pathname === quotationsPath && url.searchParams.get('notice') === 'quotation_submitted')
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const page = await context.newPage()

try {
  await login(page, accounts.requester)
  assert.match(await page.locator('main').innerText(), /Construtora Horizonte|Visão geral/)

  await page.goto(`${baseUrl}/dashboard/procurement/new`)
  await page.getByLabel('Projeto').selectOption({ label: 'AUR-26 — Edifício Aurora' })
  const purpose = `Pilot journey ${Date.now()}`
  await page.getByLabel('Finalidade').fill(purpose)
  await page.getByLabel('Prioridade').selectOption('high')
  await page.getByLabel('Data necessária').fill('2026-10-15')
  await page.getByLabel('Moeda').selectOption('AOA')
  await page.getByLabel('Descrição item 1').fill('Cimento estrutural piloto')
  await page.getByLabel('Quantidade item 1').fill('100')
  await page.getByLabel('Unidade item 1').fill('saco')
  await page.getByLabel('Preço estimado item 1').fill('30000')
  await page.getByRole('button', { name: 'Adicionar item' }).click()
  await page.getByLabel('Descrição item 2').fill('Aço nervurado piloto')
  await page.getByLabel('Quantidade item 2').fill('50')
  await page.getByLabel('Unidade item 2').fill('barra')
  await page.getByLabel('Preço estimado item 2').fill('60000')
  await page.getByRole('button', { name: 'Criar solicitação' }).click()
  await page.waitForURL((url) => /^\/dashboard\/procurement\/[0-9a-f-]{36}$/.test(url.pathname))
  const requestPath = new URL(page.url()).pathname
  const requestNumber = (await page.locator('h1').innerText()).trim()
  await page.getByRole('button', { name: 'Submeter' }).click()
  await page.waitForURL((url) => url.pathname === requestPath && url.searchParams.get('notice') === 'submitted')

  await switchUser(page, accounts.technical)
  await page.getByRole('button', { name: 'Notificações' }).click()
  assert.match(await page.locator('#atlas-sidebar').innerText(), new RegExp(requestNumber))
  await page.goto(`${baseUrl}${requestPath}`)
  await page.getByLabel('Comentário da decisão').fill('Requisitos técnicos validados no piloto.')
  await page.getByRole('button', { name: 'Aprovar' }).click()
  await page.waitForURL((url) => url.pathname === requestPath && url.searchParams.get('notice') === 'technical_approved')

  await switchUser(page, accounts.finance)
  await page.goto(`${baseUrl}${requestPath}`)
  await page.getByLabel('Comentário da decisão').fill('Cabimento financeiro validado.')
  await page.getByRole('button', { name: 'Aprovar' }).click()
  await page.waitForURL((url) => url.pathname === requestPath && url.searchParams.get('notice') === 'financial_approved')
  assert.match(await page.locator('main').innerText(), /Revisão executiva/)

  await switchUser(page, accounts.director)
  await page.goto(`${baseUrl}${requestPath}`)
  await page.getByLabel('Comentário da decisão').fill('Direção aprova aquisição para piloto.')
  await page.getByRole('button', { name: 'Aprovar' }).click()
  await page.waitForURL((url) => url.pathname === requestPath && url.searchParams.get('notice') === 'executive_approved')
  assert.match(await page.locator('main').innerText(), /Aprovada/)

  await switchUser(page, accounts.procurement)
  const quotationsPath = `${requestPath}/quotations`
  await createQuotation(page, quotationsPath, 'NovaBetão, Lda.', 'PILOT-NB-001', [24000, 50000], 5)
  await createQuotation(page, quotationsPath, 'ConstruSul', 'PILOT-CS-001', [26000, 52000], 8)
  await page.goto(`${baseUrl}${quotationsPath}`)
  const comparison = await page.locator('main').innerText()
  assert.match(comparison, /NovaBetão, Lda./)
  assert.match(comparison, /ConstruSul/)
  assert.match(comparison, /Menor preço/)
  const selection = page.locator('section', { hasText: 'Selecionar fornecedor' })
  await selection.getByRole('button', { name: 'Selecionar' }).first().click()
  await selection.getByLabel('Justificação (obrigatória)').fill('Melhor preço com cobertura integral e prazo adequado.')
  await selection.getByRole('button', { name: 'Confirmar seleção' }).click()
  await page.waitForURL((url) => url.pathname === quotationsPath && url.searchParams.get('notice') === 'supplier_selected')

  await page.goto(`${baseUrl}${requestPath}`)
  await page.getByRole('button', { name: 'Emitir ordem de compra' }).click()
  await page.waitForURL((url) => /^\/dashboard\/purchase-orders\/[0-9a-f-]{36}$/.test(url.pathname) && url.searchParams.get('notice') === 'purchase_order_issued')
  const purchaseOrderPath = new URL(page.url()).pathname
  assert.match(await page.locator('main').innerText(), /NovaBetão, Lda./)

  // Signed URL authorization: a logged-in procurement user can obtain a temporary URL for the seeded quotation document.
  await page.goto(`${baseUrl}/dashboard/procurement/d3000000-0000-4000-8000-000000000008/quotations`)
  const documentLink = page.getByRole('link', { name: /Cotacao-NovaBetao-NB-2026-418\.pdf/ })
  const href = await documentLink.getAttribute('href')
  assert.ok(href)
  const signed = await page.request.get(`${baseUrl}${href}`, { maxRedirects: 0 })
  assert.equal(signed.status(), 307)

  await switchUser(page, accounts.warehouse)
  await page.goto(`${baseUrl}${purchaseOrderPath}`)
  await page.getByRole('link', { name: 'Registar receção' }).first().click()
  await page.getByLabel('Receber Cimento estrutural piloto').fill('60')
  await page.getByLabel('Receber Aço nervurado piloto').fill('50')
  await page.getByLabel('Notas').fill('Primeira entrega do piloto.')
  await page.getByRole('button', { name: 'Registar receção' }).last().click()
  await page.waitForURL((url) => url.pathname === purchaseOrderPath && url.searchParams.get('notice') === 'goods_receipt_recorded')
  assert.match(await page.locator('main').innerText(), /Parcialmente recebida/)

  await page.getByRole('link', { name: 'Registar receção' }).first().click()
  await page.getByLabel('Receber Cimento estrutural piloto').fill('40')
  await page.getByRole('button', { name: 'Registar receção' }).last().click()
  await page.waitForURL((url) => url.pathname === purchaseOrderPath && url.searchParams.get('notice') === 'goods_receipt_recorded')
  assert.match(await page.locator('main').innerText(), /Recebida/)

  await switchUser(page, accounts.admin)
  await page.goto(`${baseUrl}${requestPath}`)
  const audit = await page.locator('main').innerText()
  assert.match(audit, /PurchaseRequestSubmitted/)
  assert.match(audit, /TechnicalApprovalGranted/)
  assert.match(audit, /FinancialApprovalGranted/)
  assert.match(audit, /ExecutiveApprovalGranted/)
  assert.match(audit, /SupplierSelected/)
  assert.match(audit, /PurchaseOrderIssued/)
  assert.match(audit, /PurchaseRequestReceived/)
  await page.goto(`${baseUrl}/dashboard/audit`)
  assert.match(await page.locator('main').innerText(), /Auditoria/)

  console.log('Demo procurement journey passed without direct database manipulation.')
} finally {
  await browser.close()
}
