import type { DocumentResourceType } from '../domain/documents'
import { uploadDocumentAction } from './actions'

export type DocumentListItem = {
  id: string
  originalName: string
  mimeType: string
  sizeBytes: number
  uploadedBy: string
  createdAt: string
}

export function DocumentSection({
  title = 'Documentos',
  resourceType,
  resourceId,
  returnTo,
  documents,
  canUpload,
}: {
  title?: string
  resourceType: DocumentResourceType
  resourceId: string
  returnTo: string
  documents: DocumentListItem[]
  canUpload: boolean
}) {
  const accept = resourceType === 'quotation' ? 'application/pdf' : 'application/pdf,image/png,image/jpeg'
  return (
    <section className="mt-5 border-t border-[var(--border)] pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-medium tracking-[-0.01em]">{title}</h2>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">PDF, PNG ou JPEG até 10 MB{resourceType === 'quotation' ? ' · cotações apenas em PDF' : ''}.</p>
        </div>
        {canUpload ? (
          <form action={uploadDocumentAction} className="flex items-center gap-2">
            <input name="resource_type" type="hidden" value={resourceType} />
            <input name="resource_id" type="hidden" value={resourceId} />
            <input name="return_to" type="hidden" value={returnTo} />
            <input accept={accept} aria-label={`Ficheiro para ${title}`} className="max-w-60 text-[11px] text-[var(--text-secondary)] file:mr-3 file:border file:border-[var(--border)] file:bg-[var(--surface)] file:px-3 file:py-1.5 file:text-[11px]" name="file" required type="file" />
            <button className="atlas-button" type="submit">Anexar</button>
          </form>
        ) : null}
      </div>
      <div className="atlas-paper-panel mt-3 divide-y divide-[var(--paper-border)] overflow-hidden">
        {documents.length === 0 ? (
          <p className="px-3 py-4 text-[12px] text-[var(--text-muted)]">Nenhum documento anexado.</p>
        ) : documents.map((document) => (
          <a className="atlas-paper-row grid min-h-11 grid-cols-[1fr_auto_auto] items-center gap-4 px-3 py-2 text-[12px]" href={`/api/documents/${document.id}/download`} key={document.id}>
            <span className="atlas-link truncate font-medium">{document.originalName}</span>
            <span className="atlas-tabular text-[var(--text-muted)]">{formatBytes(document.sizeBytes)}</span>
            <span aria-hidden className="text-[var(--text-muted)]">↓</span>
          </a>
        ))}
      </div>
    </section>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
