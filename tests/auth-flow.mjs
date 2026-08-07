import assert from 'node:assert/strict'

import { chromium } from 'playwright'

const baseUrl = process.env.ATLAS_TEST_BASE_URL ?? 'http://127.0.0.1:3000'
const testPassword = 'Atlas-Test-2026!'
const testEmail = `atlas-auth-${Date.now()}@example.com`

function isAuthCookie(cookie) {
  return cookie.name.startsWith('sb-') && cookie.name.includes('auth-token')
}

async function expectPath(page, pathname) {
  await page.waitForURL((url) => url.pathname === pathname)
  assert.equal(new URL(page.url()).pathname, pathname)
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const page = await context.newPage()

try {
  // Protected route: an unauthenticated request must not render the dashboard.
  await page.goto(`${baseUrl}/dashboard`)
  await expectPath(page, '/login')
  assert.match(page.url(), /error=session_required/)

  // Sign up locally. Supabase CLI has email confirmations disabled for local dev,
  // so a valid signup creates a session immediately.
  await page.goto(`${baseUrl}/signup`)
  await page.getByLabel('Nome completo').fill('Atlas Auth Test')
  await page.getByLabel('Email').fill(testEmail)
  await page.getByLabel('Password', { exact: true }).fill(testPassword)
  await page.getByLabel('Confirmar password').fill(testPassword)
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expectPath(page, '/dashboard')

  const sessionCookies = (await context.cookies()).filter(isAuthCookie)
  assert.ok(sessionCookies.length > 0, 'signup did not persist Supabase auth cookies')

  for (const cookie of sessionCookies) {
    assert.ok(!cookie.value.includes(testPassword), 'auth cookie exposed password')
    assert.ok(!cookie.value.toLowerCase().includes('service_role'), 'auth cookie exposed privileged role')
    assert.equal(cookie.sameSite, 'Lax', 'auth cookie must use SameSite=Lax')
  }

  // Authenticated users must not be sent back to the login page.
  await page.goto(`${baseUrl}/login`)
  await expectPath(page, '/dashboard')

  // Logout must destroy the normal user session and return to login.
  await page.getByRole('button', { name: 'Terminar sessão' }).click()
  await expectPath(page, '/login')
  assert.equal(
    (await context.cookies()).filter(isAuthCookie).length,
    0,
    'logout left Supabase auth cookies behind',
  )

  // Invalid login must fail safely and not create a session.
  await page.getByLabel('Email').fill(testEmail)
  await page.getByLabel('Password').fill('Wrong-Password-2026!')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expectPath(page, '/login')
  await page.getByRole('alert').waitFor()
  assert.match(await page.getByRole('alert').innerText(), /Email ou password inválidos/)
  assert.equal((await context.cookies()).filter(isAuthCookie).length, 0)

  // Valid login must create a server-side cookie session and open the dashboard.
  await page.getByLabel('Email').fill(testEmail)
  await page.getByLabel('Password').fill(testPassword)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expectPath(page, '/dashboard')
  assert.ok((await context.cookies()).filter(isAuthCookie).length > 0)

  // Expired session: expire every Supabase auth cookie at the browser boundary.
  const cookiesBeforeExpiry = (await context.cookies()).filter(isAuthCookie)
  await context.addCookies(
    cookiesBeforeExpiry.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      expires: Math.floor(Date.now() / 1000) - 60,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
    })),
  )

  await page.goto(`${baseUrl}/dashboard`)
  await expectPath(page, '/login')
  assert.match(page.url(), /error=session_required/)

  console.log('Authentication integration flow passed.')
} finally {
  await browser.close()
}
