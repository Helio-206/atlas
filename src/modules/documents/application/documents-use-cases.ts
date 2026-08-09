import 'server-only'

import { z } from 'zod'

import { validateDocumentUpload, type DocumentResourceType } from '../domain/documents'
import {
  discardDocumentUploadRepository,
  finalizeDocumentUploadRepository,
  getDocumentDownloadRepository,
  listResourceDocumentsRepository,
  prepareDocumentUploadRepository,
} from '../infrastructure/documents-repository'

const uuidSchema = z.string().uuid()

export async function PrepareDocumentUpload(input: {
  resourceType: DocumentResourceType
  resourceId: string
  originalName: string
  mimeType: string
  sizeBytes: number
}) {
  const valid = validateDocumentUpload({
    resourceType: input.resourceType,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    name: input.originalName,
  })
  if (!valid.ok) throw new Error(valid.code)
  return prepareDocumentUploadRepository({ ...input, originalName: valid.name, resourceId: uuidSchema.parse(input.resourceId) })
}

export function FinalizeDocumentUpload(documentId: string) {
  return finalizeDocumentUploadRepository(uuidSchema.parse(documentId))
}

export function DiscardDocumentUpload(documentId: string) {
  return discardDocumentUploadRepository(uuidSchema.parse(documentId))
}

export function ListResourceDocuments(resourceType: DocumentResourceType, resourceId: string) {
  return listResourceDocumentsRepository(resourceType, uuidSchema.parse(resourceId))
}

export function GetDocumentDownload(documentId: string) {
  return getDocumentDownloadRepository(uuidSchema.parse(documentId))
}
