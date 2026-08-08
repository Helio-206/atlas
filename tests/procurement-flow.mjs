import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { chromium } from 'playwright'

const baseUrl = process.env.ATLAS_TEST_BASE_URL ?? 'http://127.0.0.1:3000'
const fixture = JSON.parse(readFileSync('/tmp/atlas-procurement-e2e.json', 'utf8'))

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

async function logout(page) {
  await page.goto(`${baseUrl}/dashboard`)
  await page.getByRole('button', { name: 'Terminar sessão' }).click()
  await waitForPath(page, '/login')
}

async function createRequest(page, { purpose, price, priority = 'high' }) {
  await page.goto(`${baseUrl}/dashboard/procurement/new`)
  await waitForPath(page, '/dashboard/procurement/new')

  await page.getByLabel('Projeto').selectOption(fixture.projectId)
  await page.getByLabel('Finalidade').fill(purpose)
  await page.getByLabel('Prioridade').selectOption(priority)
  await page.getByLabel('Data necessária').fill('2026-10-15')
  await page.getByLabel('Moeda').selectOption('AOA')
  await page.getByLabel('Descrição item 1').fill('Cimento')
  await page.getByLabel('Quantidade item 1').fill('2')
  await page.getByLabel('Unidade item 1').fill('saco')
  await page.getByLabel('Preço estimado item 1').fill(String(price))
  await page.getByRole('button', { name: 'Criar solicitação' }).click()

  await page.waitForURL((url) => /^\/dashboard\/procurement\/[0-9a-f-]{36}$/.test(url.pathname))
  const detailPath = new URL(page.url()).pathname
  const requestNumber = (await page.locator('h1').innerText()).trim()

  assert.match(requestNumber, /^PR-\d{8}-[A-F0-9]{8}$/)
  assert.match(await page.locator('main').innerText(), /Draft/)

  return { detailPath, requestNumber }
}

async function submit(page, detailPath) {
  await page.goto(`${baseUrl}${detailPath}`)
  await page.getByRole('button', { name: 'Submeter' }).click()
  await page.waitForURL((url) => url.pathname === detailPath && url.searchParams.get('notice') === 'submitted')
  assert.match(await page.locator('main').innerText(), /Revisão técnica/)
}

async function approve(page, detailPath, account, notice, expectedStatus) {
  await logout(page)
  await login(page, account)
  await page.goto(`${baseUrl}${detailPath}`)
  await page.getByRole('button', { name: 'Aprovar' }).click()
  await page.waitForURL((url) => url.pathname === detailPath && url.searchParams.get('notice') === notice)
  assert.match(await page.locator('main').innerText(), expectedStatus)
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const page = await context.newPage()

try {
  await page.goto(`${baseUrl}/dashboard/procurement`)
  await waitForPath(page, '/login')

  await login(page, fixture.accounts.requester)

  // Main flow: requester -> technical -> financial -> approved below threshold.
  const low = await createRequest(page, {
    purpose: 'Materiais de fundação E2E',
    price: 100000,
  })
  await submit(page, low.detailPath)

  await logout(page)
  await login(page, fixture.accounts.technical)
  await page.goto(`${baseUrl}/dashboard/approvals`)
  assert.match(await page.locator('main').innerText(), new RegExp(low.requestNumber))
  await page.goto(`${baseUrl}${low.detailPath}`)
  await page.getByPlaceholder('Comentário opcional').fill('Technical E2E OK')
  await page.getByRole('button', { name: 'Aprovar' }).click()
  await page.waitForURL((url) => url.pathname === low.detailPath && url.searchParams.get('notice') === 'technical_approved')
  assert.match(await page.locator('main').innerText(), /Revisão financeira/)

  await logout(page)
  await login(page, fixture.accounts.financial)
  await page.goto(`${baseUrl}/dashboard/approvals`)
  assert.match(await page.locator('main').innerText(), new RegExp(low.requestNumber))
  await page.goto(`${baseUrl}${low.detailPath}`)
  await page.getByPlaceholder('Comentário opcional').fill('Financial E2E OK')
  await page.getByRole('button', { name: 'Aprovar' }).click()
  await page.waitForURL((url) => url.pathname === low.detailPath && url.searchParams.get('notice') === 'financial_approved')
  assert.match(await page.locator('main').innerText(), /Aprovada/)
  assert.match(await page.locator('main').innerText(), /TechnicalApprovalGranted/)
  assert.match(await page.locator('main').innerText(), /FinancialApprovalGranted/)

  // Return path, edit, resubmit, then force executive approval by threshold.
  await logout(page)
  await login(page, fixture.accounts.requester)
  const high = await createRequest(page, {
    purpose: 'Equipamento pesado E2E',
    price: 600000,
    priority: 'urgent',
  })
  await submit(page, high.detailPath)

  await logout(page)
  await login(page, fixture.accounts.technical)
  await page.goto(`${baseUrl}${high.detailPath}`)
  await page.getByPlaceholder('Motivo da devolução').fill('Detalhar especificação')
  await page.getByRole('button', { name: 'Devolver' }).click()
  await page.waitForURL((url) => url.pathname === high.detailPath && url.searchParams.get('notice') === 'returned')
  assert.match(await page.locator('main').innerText(), /Devolvida/)

  await logout(page)
  await login(page, fixture.accounts.requester)
  await page.goto(`${baseUrl}${high.detailPath}`)
  await page.getByLabel('Finalidade').fill('Equipamento pesado E2E revisto')
  await page.getByRole('button', { name: 'Guardar alterações' }).click()
  await page.waitForURL((url) => url.pathname === high.detailPath && url.searchParams.get('notice') === 'updated')
  assert.match(await page.locator('main').innerText(), /Equipamento pesado E2E revisto/)
  await page.getByRole('button', { name: 'Submeter' }).click()
  await page.waitForURL((url) => url.pathname === high.detailPath && url.searchParams.get('notice') === 'submitted')

  await approve(page, high.detailPath, fixture.accounts.technical, 'technical_approved', /Revisão financeira/)
  await approve(page, high.detailPath, fixture.accounts.financial, 'financial_approved', /Revisão executiva/)

  await logout(page)
  await login(page, fixture.accounts.executive)
  await page.goto(`${baseUrl}/dashboard/approvals`)
  assert.match(await page.locator('main').innerText(), new RegExp(high.requestNumber))
  await page.goto(`${baseUrl}${high.detailPath}`)
  await page.getByPlaceholder('Comentário opcional').fill('Executive E2E OK')
  await page.getByRole('button', { name: 'Aprovar' }).click()
  await page.waitForURL((url) => url.pathname === high.detailPath && url.searchParams.get('notice') === 'executive_approved')
  const finalText = await page.locator('main').innerText()
  assert.match(finalText, /Aprovada/)
  assert.match(finalText, /returned/i)
  assert.match(finalText, /ExecutiveApprovalGranted/)

  console.log('Procurement browser integration flows passed.')
} finally {
  await browser.close()
}
