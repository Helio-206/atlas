import 'server-only'

import { z } from 'zod'

import {
  countUnreadNotificationsRepository,
  listNotificationsRepository,
  markNotificationReadRepository,
} from '../infrastructure/notifications-repository'

export function ListNotifications(maxItems = 20) {
  return listNotificationsRepository(Math.max(1, Math.min(maxItems, 100)))
}

export function CountUnreadNotifications() {
  return countUnreadNotificationsRepository()
}

export function MarkNotificationRead(notificationId: string) {
  return markNotificationReadRepository(z.string().uuid().parse(notificationId))
}
