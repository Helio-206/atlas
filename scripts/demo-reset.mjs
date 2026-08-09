import { createClient } from '@supabase/supabase-js'

import { assertDemoResetAllowed } from './demo-reset-guard.mjs'

const url = process.env.ATLAS_DEMO_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.API_URL
const secret = process.env.ATLAS_DEMO_SECRET_KEY ?? process.env.SUPABASE_SECRET_KEY ?? process.env.SECRET_KEY ?? process.env.SERVICE_ROLE_KEY
const password = process.env.ATLAS_DEMO_PASSWORD

if (!url || !secret || !password) {
  console.error('Demo reset requires ATLAS_DEMO_SUPABASE_URL, ATLAS_DEMO_SECRET_KEY and ATLAS_DEMO_PASSWORD.')
  process.exit(1)
}

try {
  assertDemoResetAllowed(process.env, url)
} catch (error) {
  console.error(error instanceof Error ? error.message : 'demo_reset_guard_failed')
  process.exit(1)
}

const client = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } })
const accounts = [
  ['admin@atlas.demo', 'Helena Manuel'],
  ['project.manager@atlas.demo', 'Paulo Domingos'],
  ['requester@atlas.demo', 'Marta André'],
  ['technical@atlas.demo', 'Carlos Mateus'],
  ['finance@atlas.demo', 'Inês Joaquim'],
  ['director@atlas.demo', 'António Neto'],
  ['procurement@atlas.demo', 'Sofia Miguel'],
  ['warehouse@atlas.demo', 'Daniel Costa'],
]

async function ensureUsers() {
  const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 100 })
  if (error) throw new Error(`demo_user_list_failed:${error.code ?? 'unknown'}`)
  const existing = new Map(data.users.map((user) => [user.email, user]))
  for (const [email, fullName] of accounts) {
    const user = existing.get(email)
    if (user) {
      const { error: updateError } = await client.auth.admin.updateUserById(user.id, { password, user_metadata: { full_name: fullName }, email_confirm: true })
      if (updateError) throw new Error(`demo_user_update_failed:${updateError.code ?? 'unknown'}`)
    } else {
      const { error: createError } = await client.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } })
      if (createError) throw new Error(`demo_user_create_failed:${createError.code ?? 'unknown'}`)
    }
  }
}

function demoPdf(title) {
  const escaped = title.replace(/[()\\]/g, '')
  const body = `BT /F1 18 Tf 72 720 Td (${escaped}) Tj ET`
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >> endobj',
    `4 0 obj << /Length ${body.length} >> stream\n${body}\nendstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (const object of objects) { offsets.push(Buffer.byteLength(pdf)); pdf += `${object}\n` }
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i < offsets.length; i += 1) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf)
}

async function seedDocument(resourceType, resourceId, filename, uploaderEmail) {
  const companyId = 'd0000000-0000-4000-8000-000000000001'
  const storagePath = `${companyId}/demo/${filename}`
  const pdf = demoPdf(filename)
  const { error: uploadError } = await client.storage.from('atlas-documents').upload(storagePath, pdf, { contentType: 'application/pdf', upsert: true })
  if (uploadError) throw new Error(`demo_document_upload_failed:${uploadError.message}`)
  const { error: metadataError } = await client.rpc('seed_atlas_demo_document', {
    resource_type: resourceType,
    resource_id: resourceId,
    storage_path: storagePath,
    original_name: filename,
    mime_type: 'application/pdf',
    size_bytes: pdf.byteLength,
    uploader_email: uploaderEmail,
  })
  if (metadataError) throw new Error(`demo_document_metadata_failed:${metadataError.code ?? 'unknown'}`)
}

try {
  await ensureUsers()
  const { error } = await client.rpc('seed_atlas_demo_data')
  if (error) throw new Error(`demo_seed_failed:${error.code ?? 'unknown'}:${error.message}`)
  await seedDocument('quotation', 'd4000000-0000-4000-8000-000000000081', 'Cotacao-NovaBetao-NB-2026-418.pdf', 'procurement@atlas.demo')
  await seedDocument('purchase_order', 'd5000000-0000-4000-8000-000000000008', 'PO-2026-000042.pdf', 'procurement@atlas.demo')
  await seedDocument('goods_receipt', 'd6000000-0000-4000-8000-000000000081', 'Guia-Entrega-GR-2026-000087.pdf', 'warehouse@atlas.demo')
  console.log('Atlas demo data reset completed for Construtora Horizonte, Lda.')
} catch (error) {
  console.error(error instanceof Error ? error.message : 'demo_reset_failed')
  process.exit(1)
}
