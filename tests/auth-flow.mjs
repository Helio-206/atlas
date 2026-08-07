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
  // Protected routes reject unauthenticated requests.
  await page.goto(`${baseUrl}/dashboard`)
  await expectPath(page, '/login')
  assert.match(page.url(), /error=session_required/)

  await page.goto(`${baseUrl}/onboarding/company`)
  await expectPath(page, '/login')
  assert.match(page.url(), /error=session_required/)

  // Local signup creates a session immediately and starts company onboarding.
  await page.goto(`${baseUrl}/signup`)
  await page.getByLabel('Nome completo').fill('Atlas Auth Test')
  await page.getByLabel('Email').fill(testEmail)
  await page.getByLabel('Password', { exact: true }).fill(testPassword)
  await page.getByLabel('Confirmar password').fill(testPassword)
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expectPath(page, '/onboarding/company')

  const sessionCookies = (await context.cookies()).filter(isAuthCookie)
  assert.ok(sessionCookies.length > 0, 'signup did not persist Supabase auth cookies')

  for (const cookie of sessionCookies) {
    assert.ok(!cookie.value.includes(testPassword), 'auth cookie exposed password')
    assert.ok(!cookie.value.toLowerCase().includes('service_role'), 'auth cookie exposed privileged role')
    assert.equal(cookie.sameSite, 'Lax', 'auth cookie must use SameSite=Lax')
  }

  // An authenticated user without an active company cannot open the dashboard.
  await page.goto(`${baseUrl}/dashboard`)
  await expectPath(page, '/onboarding/company')

  // Server-side Zod validation rejects a whitespace-only company name.
  await page.getByLabel('Nome da empresa').fill('  ')
  await page.getByRole('button', { name: 'Criar empresa e continuar' }).click()
  await page.waitForURL(
    (url) =>
      url.pathname === '/onboarding/company' &&
      url.searchParams.get('error') === 'invalid_form',
  )
  assert.equal(new URL(page.url()).pathname, '/onboarding/company')
  const onboardingAlert = page.locator('main [role="alert"]')
  await onboardingAlert.waitFor()
  assert.match(await onboardingAlert.innerText(), /Verifique os dados da empresa/)

  // Successful onboarding creates the company atomically and unlocks dashboard.
  await page.getByLabel('Nome da empresa').fill('Atlas Browser Construction')
  await page.getByLabel(/NIF/).fill('')
  await page.getByRole('button', { name: 'Criar empresa e continuar' }).click()
  await expectPath(page, '/dashboard')

  // Active members cannot repeat onboarding.
  await page.goto(`${baseUrl}/onboarding/company`)
  await expectPath(page, '/dashboard')

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
  const applicationAlert = page.locator('main [role="alert"]')
  await applicationAlert.waitFor()
  assert.match(
    await applicationAlert.innerText(),
    /Email ou password inválidos/,
  )
  assert.equal((await context.cookies()).filter(isAuthCookie).length, 0)

  // Valid login restores the server-side session and opens the dashboard because
  // the active company membership already exists.
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

  console.log('Authentication and company onboarding integration flow passed.')
} finally {
  await browser.close()
}
