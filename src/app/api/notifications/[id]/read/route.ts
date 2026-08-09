import { NextResponse } from 'next/server'
import { z } from 'zod'

import { MarkNotificationRead } from '@/modules/notifications/application/notification-use-cases'
import { logOperationalError } from '@/platform/observability/logger'

const idSchema = z.string().uuid()

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const url = new URL(request.url)
  const next = safeNext(url.searchParams.get('next'))
  if (!idSchema.safeParse(id).success) return NextResponse.redirect(new URL(next, url.origin))
  try {
    await MarkNotificationRead(id)
  } catch (error) {
    logOperationalError({ operation: 'notifications.mark_read', error })
  }
  return NextResponse.redirect(new URL(next, url.origin))
}

function safeNext(value: string | null) {
  return value && (value === '/dashboard' || value.startsWith('/dashboard/')) ? value : '/dashboard'
}
