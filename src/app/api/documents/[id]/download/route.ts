import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { GetDocumentDownload } from '@/modules/documents/application/documents-use-cases'
import { logOperationalError } from '@/platform/observability/logger'

const idSchema = z.string().uuid()

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  if (!idSchema.safeParse(id).success) return new NextResponse('Not found', { status: 404 })

  try {
    const document = await GetDocumentDownload(id)
    if (!document) return new NextResponse('Not found', { status: 404 })
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase.storage.from('atlas-documents').createSignedUrl(document.storagePath, 60)
    if (error || !data?.signedUrl) return new NextResponse('Unable to open document', { status: 503 })
    return NextResponse.redirect(data.signedUrl)
  } catch (error) {
    logOperationalError({ operation: 'documents.download', error })
    return new NextResponse('Not found', { status: 404 })
  }
}
