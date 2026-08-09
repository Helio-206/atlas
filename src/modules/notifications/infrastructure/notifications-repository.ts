import 'server-only'

import { z } from 'zod'

import { createServerSupabaseClient } from '@/lib/supabase/server'

const notificationSchema = z.object({
  id: z.string().uuid(),
  event_type: z.string(),
  title: z.string(),
  resource_type: z.string().nullable(),
  resource_id: z.string().uuid().nullable(),
  href: z.string().nullable(),
  read_at: z.string().nullable(),
  created_at: z.string(),
})

function assertResult(error: { code?: string; message?: string } | null) {
  if (error) throw new Error(`notification_repository_error:${error.code ?? 'unknown'}`)
}

export async function listNotificationsRepository(maxItems = 20) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('list_notifications', { max_items: maxItems })
  assertResult(error)
  return z.array(notificationSchema).parse(data ?? []).map((row) => ({
    id: row.id,
    eventType: row.event_type,
    title: row.title,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    href: row.href,
    readAt: row.read_at,
    createdAt: row.created_at,
  }))
}

export async function countUnreadNotificationsRepository() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('count_unread_notifications')
  assertResult(error)
  return z.coerce.number().int().nonnegative().parse(data ?? 0)
}

export async function markNotificationReadRepository(notificationId: string) {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.rpc('mark_notification_read', { notification_id: notificationId })
  assertResult(error)
}
