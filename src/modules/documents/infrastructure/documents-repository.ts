import 'server-only'

import { z } from 'zod'

import { createServerSupabaseClient } from '@/lib/supabase/server'

import type { DocumentResourceType } from '../domain/documents'

const documentRowSchema = z.object({
  id: z.string().uuid(),
  original_name: z.string(),
  mime_type: z.string(),
  size_bytes: z.coerce.number(),
  uploaded_by: z.string().uuid(),
  created_at: z.string(),
})

const preparedSchema = z.object({ document_id: z.string().uuid(), storage_path: z.string() })
const downloadSchema = z.object({ storage_path: z.string(), original_name: z.string(), mime_type: z.string() })

export class DocumentRepositoryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DocumentRepositoryError'
  }
}

function assertResult(error: { code?: string; message?: string } | null) {
  if (error) throw new DocumentRepositoryError([error.code, error.message].filter(Boolean).join(': '))
}

export async function prepareDocumentUploadRepository(input: {
  resourceType: DocumentResourceType
  resourceId: string
  originalName: string
  mimeType: string
  sizeBytes: number
}) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('prepare_document_upload', {
    resource_type: input.resourceType,
    resource_id: input.resourceId,
    original_name: input.originalName,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
  })
  assertResult(error)
  return preparedSchema.parse(z.array(preparedSchema).parse(data ?? [])[0])
}

export async function finalizeDocumentUploadRepository(documentId: string) {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.rpc('finalize_document_upload', { document_id: documentId })
  assertResult(error)
}

export async function discardDocumentUploadRepository(documentId: string) {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.rpc('discard_document_upload', { document_id: documentId })
  assertResult(error)
}

export async function listResourceDocumentsRepository(resourceType: DocumentResourceType, resourceId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('list_resource_documents', { resource_type: resourceType, resource_id: resourceId })
  assertResult(error)
  return z.array(documentRowSchema).parse(data ?? []).map((row) => ({
    id: row.id,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  }))
}

export async function getDocumentDownloadRepository(documentId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('get_document_download', { document_id: documentId })
  assertResult(error)
  const row = z.array(downloadSchema).parse(data ?? [])[0]
  return row ? { storagePath: row.storage_path, originalName: row.original_name, mimeType: row.mime_type } : null
}
