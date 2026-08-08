import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.ATLAS_TEST_SUPABASE_URL
const publishableKey = process.env.ATLAS_TEST_PUBLISHABLE_KEY
assert.ok(supabaseUrl, 'ATLAS_TEST_SUPABASE_URL is required')
assert.ok(publishableKey, 'ATLAS_TEST_PUBLISHABLE_KEY is required')

const procurement = JSON.parse(readFileSync('/tmp/atlas-procurement-e2e.json', 'utf8'))
const officer = {
  email: `proc-officer-${Date.now()}@example.com`,
  role: 'procurement_officer',
  name: 'Procurement Officer',
}
const client = createClient(supabaseUrl, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const { data, error } = await client.auth.signUp({
  email: officer.email,
  password: procurement.password,
  options: { data: { full_name: officer.name } },
})
if (error) throw error
assert.ok(data.user, 'Supabase signUp did not return sourcing officer')
officer.id = data.user.id

const mainRequestId = '53000000-0000-4000-8000-000000000001'
const blockedRequestId = '53000000-0000-4000-8000-000000000002'
const mainItemA = '54000000-0000-4000-8000-000000000001'
const mainItemB = '54000000-0000-4000-8000-000000000002'
const blockedItem = '54000000-0000-4000-8000-000000000003'

const containerResult = spawnSync('docker', [
  'ps', '--filter', 'label=com.supabase.cli.project=atlas', '--filter', 'name=supabase_db_', '--format', '{{.Names}}',
], { encoding: 'utf8' })
assert.equal(containerResult.status, 0, containerResult.stderr)
const container = containerResult.stdout.trim().split('\n').filter(Boolean)[0]
assert.ok(container, 'Supabase DB container not found')

const sql = `
insert into identity.memberships (company_id, user_id, role, status)
values ('${procurement.companyId}', '${officer.id}', 'procurement_officer', 'active');

insert into procurement.purchase_requests
(id, company_id, project_id, request_number, requested_by, purpose, priority, required_date, status, estimated_total, currency, approved_at, version)
values
('${mainRequestId}', '${procurement.companyId}', '${procurement.projectId}', 'SRC-E2E-001', '${procurement.accounts.requester.id}', 'Sourcing E2E main', 'high', '2026-11-01', 'approved', 350000, 'AOA', now(), 1),
('${blockedRequestId}', '${procurement.companyId}', '${procurement.projectId}', 'SRC-E2E-002', '${procurement.accounts.requester.id}', 'Sourcing E2E blocked supplier', 'normal', '2026-11-01', 'approved', 100000, 'AOA', now(), 1);

insert into procurement.purchase_request_items
(id, purchase_request_id, description, quantity, unit, estimated_unit_price)
values
('${mainItemA}', '${mainRequestId}', 'Cimento E2E', 2, 'saco', 100000),
('${mainItemB}', '${mainRequestId}', 'Areia E2E', 3, 'm3', 50000),
('${blockedItem}', '${blockedRequestId}', 'Aço E2E', 1, 'lote', 100000);
`
const fixtureResult = spawnSync('docker', [
  'exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1',
], { input: sql, encoding: 'utf8' })
process.stdout.write(fixtureResult.stdout ?? '')
process.stderr.write(fixtureResult.stderr ?? '')
assert.equal(fixtureResult.status, 0, 'Could not create sourcing E2E fixture')

writeFileSync('/tmp/atlas-sourcing-e2e.json', JSON.stringify({
  password: procurement.password,
  companyId: procurement.companyId,
  officer,
  mainRequestId,
  blockedRequestId,
  mainItemA,
  mainItemB,
  blockedItem,
}))
console.log('Sourcing E2E fixture created without service role.')
