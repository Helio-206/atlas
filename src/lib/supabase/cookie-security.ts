export function shouldUseSecureCookies() {
  const applicationUrl = process.env.NEXT_PUBLIC_APP_URL

  if (applicationUrl) {
    return applicationUrl.startsWith('https://')
  }

  return process.env.NODE_ENV === 'production'
}
