'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logOperationalError } from '@/platform/observability/logger'

import {
  DiscardDocumentUpload,
  FinalizeDocumentUpload,
  PrepareDocumentUpload,
} from '../application/documents-use-cases'
import type { DocumentResourceType } from '../domain/documents'

function text(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function safeReturnTo(value: string) {
  return value.startsWith('/dashboard/') || value === '/dashboard' ? value : '/dashboard'
}

function resourceType(value: string): DocumentResourceType | null {
  return ['quotation', 'purchase_order', 'goods_receipt'].includes(value) ? value as DocumentResourceType : null
}

function documentError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('mime') || message.includes('quotation_pdf_required') || message.includes('must_be_pdf')) return 'document_type'
  if (message.includes('size')) return 'document_size'
  if (message.includes('forbidden') || message.includes('permission')) return 'permission_denied'
  if (message.includes('not_found')) return 'not_found'
  return 'document_failed'
}

export async function uploadDocumentAction(formData: FormData) {
  const returnTo = safeReturnTo(text(formData, 'return_to'))
  const type = resourceType(text(formData, 'resource_type'))
  const resourceId = text(formData, 'resource_id')
  const file = formData.get('file')
  if (!type || !(file instanceof File) || file.size <= 0) redirect(`${returnTo}?error=document_invalid`)

  let prepared: { document_id: string; storage_path: string } | null = null
  try {
    prepared = await PrepareDocumentUpload({
      resourceType: type,
      resourceId,
      originalName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    })
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.storage.from('atlas-documents').upload(prepared.storage_path, file, {
      contentType: file.type,
      upsert: false,
    })
    if (error) throw new Error(`storage_upload_failed:${error.message}`)
    await FinalizeDocumentUpload(prepared.document_id)
  } catch (error) {
    if (prepared) {
      try {
        const supabase = await createServerSupabaseClient()
        await supabase.storage.from('atlas-documents').remove([prepared.storage_path])
        await DiscardDocumentUpload(prepared.document_id)
      } catch {
        // The pending row remains isolated and unreadable if cleanup itself fails.
      }
    }
    logOperationalError({ operation: 'documents.upload', error })
    redirect(`${returnTo}?error=${documentError(error)}`)
  }

  revalidatePath(returnTo)
  redirect(`${returnTo}?notice=document_uploaded`)
}
