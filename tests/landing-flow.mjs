import assert from 'node:assert/strict'

import { chromium } from 'playwright'

const baseUrl = process.env.ATLAS_TEST_BASE_URL ?? 'http://127.0.0.1:3000'
const email = `landing-${Date.now()}@example.com`
const browser = await chromium.launch({ headless: true })

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1024 } })
  const page = await context.newPage()
  const consoleErrors = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto(baseUrl)
  assert.equal(new URL(page.url()).pathname, '/')
  await page.getByRole('heading', { name: /A sua operação não deveria depender/ }).waitFor()
  await page.getByRole('link', { name: 'Solicitar demonstração' }).first().click()
  await page.waitForFunction(() => window.location.hash === '#demo')

  await page.getByLabel('Nome', { exact: true }).fill('Helena Manuel')
  await page.getByLabel('Empresa', { exact: true }).fill('Construtora Horizonte, Lda.')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Telefone', { exact: true }).fill('+244 923 000 000')
  await page.getByLabel('Cargo', { exact: true }).fill('Diretora Financeira')
  await page.getByLabel(/Mensagem/).fill('Quero avaliar o fluxo de Procurement.')
  await page.getByRole('button', { name: 'Solicitar demonstração' }).click()
  await page.getByRole('status').waitFor()
  assert.match(await page.getByRole('status').innerText(), /Recebemos o seu pedido/)

  for (const width of [1024, 768, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    await page.goto(baseUrl)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(overflow <= 1, `landing overflows horizontally at ${width}px by ${overflow}px`)
  }

  await page.setViewportSize({ width: 1440, height: 1024 })
  await page.goto(baseUrl)
  await page.getByRole('link', { name: 'Entrar' }).click()
  await page.waitForURL((url) => url.pathname === '/login')
  assert.equal(new URL(page.url()).pathname, '/login')
  assert.deepEqual(consoleErrors, [], `browser console errors: ${consoleErrors.join('\n')}`)

  await context.close()
  console.log('Public landing, responsive layout, demo request and login navigation passed.')
} finally {
  await browser.close()
}
