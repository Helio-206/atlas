import { describe, expect, it } from 'vitest'

import { DOCUMENT_MAX_BYTES, validateDocumentUpload } from './documents'

describe('document upload policy', () => {
  it('accepts a quotation PDF', () => {
    expect(validateDocumentUpload({ resourceType: 'quotation', mimeType: 'application/pdf', sizeBytes: 1024, name: 'cotacao.pdf' })).toEqual({ ok: true, name: 'cotacao.pdf' })
  })

  it('rejects quotation images', () => {
    expect(validateDocumentUpload({ resourceType: 'quotation', mimeType: 'image/png', sizeBytes: 1024, name: 'cotacao.png' })).toEqual({ ok: false, code: 'quotation_pdf_required' })
  })

  it('accepts a receipt JPEG', () => {
    expect(validateDocumentUpload({ resourceType: 'goods_receipt', mimeType: 'image/jpeg', sizeBytes: 1024, name: 'guia.jpg' }).ok).toBe(true)
  })

  it('rejects unsupported MIME types', () => {
    expect(validateDocumentUpload({ resourceType: 'purchase_order', mimeType: 'text/plain', sizeBytes: 100, name: 'po.txt' })).toEqual({ ok: false, code: 'mime_not_allowed' })
  })

  it('rejects zero and oversized files', () => {
    expect(validateDocumentUpload({ resourceType: 'purchase_order', mimeType: 'application/pdf', sizeBytes: 0, name: 'po.pdf' }).ok).toBe(false)
    expect(validateDocumentUpload({ resourceType: 'purchase_order', mimeType: 'application/pdf', sizeBytes: DOCUMENT_MAX_BYTES + 1, name: 'po.pdf' }).ok).toBe(false)
  })

  it('normalizes newlines in display names without using them as storage paths', () => {
    expect(validateDocumentUpload({ resourceType: 'purchase_order', mimeType: 'application/pdf', sizeBytes: 100, name: 'PO\n042.pdf' })).toEqual({ ok: true, name: 'PO 042.pdf' })
  })
})
