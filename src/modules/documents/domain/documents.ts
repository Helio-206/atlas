export const DOCUMENT_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'] as const
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024

export type DocumentResourceType = 'quotation' | 'purchase_order' | 'goods_receipt'
export type DocumentMimeType = (typeof DOCUMENT_MIME_TYPES)[number]

export function validateDocumentUpload(input: {
  resourceType: DocumentResourceType
  mimeType: string
  sizeBytes: number
  name: string
}) {
  const name = input.name.replace(/[\r\n]/g, ' ').trim()
  if (!name || name.length > 255) return { ok: false as const, code: 'invalid_name' }
  if (!DOCUMENT_MIME_TYPES.includes(input.mimeType as DocumentMimeType)) {
    return { ok: false as const, code: 'mime_not_allowed' }
  }
  if (input.resourceType === 'quotation' && input.mimeType !== 'application/pdf') {
    return { ok: false as const, code: 'quotation_pdf_required' }
  }
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > DOCUMENT_MAX_BYTES) {
    return { ok: false as const, code: 'invalid_size' }
  }
  return { ok: true as const, name }
}
