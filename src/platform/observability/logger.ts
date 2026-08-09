import 'server-only'

import { randomUUID } from 'node:crypto'

type OperationalErrorContext = {
  operation: string
  error: unknown
  userId?: string | null
  companyId?: string | null
  correlationId?: string
}

function category(error: unknown) {
  if (error instanceof Error) {
    if (error.name.includes('Zod')) return 'validation'
    if (/permission|forbidden|42501/i.test(error.message)) return 'authorization'
    if (/conflict|40001/i.test(error.message)) return 'concurrency'
    if (/storage/i.test(error.message)) return 'storage'
  }
  return 'unexpected'
}

export function logOperationalError(context: OperationalErrorContext) {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'error',
    correlationId: context.correlationId ?? randomUUID(),
    userId: context.userId ?? null,
    companyId: context.companyId ?? null,
    operation: context.operation,
    errorCategory: category(context.error),
  }))
}
