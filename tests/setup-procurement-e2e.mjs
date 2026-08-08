import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.ATLAS_TEST_SUPABASE_URL
const publishableKey = process.env.ATLAS_TEST_PUBLISHABLE_KEY

assert.ok(supabaseUrl, 'ATLAS_TEST_SUPABASE_URL is required')
assert.ok(publishableKey, 'ATLAS_TEST_PUBLISHABLE_KEY is required')

const password = 'Atlas-Procurement-2026!'
const suffix = Date.now()
const accounts = {
  requester: {
    email: `proc-requester-${suffix}@example.com`,
    role: 'requester',
    name: 'Procurement Requester',
  },
  technical: {
    email: `proc-technical-${suffix}@example.com`,
    role: 'technical_reviewer',
    name: 'Technical Reviewer',
  },
  financial: {
    email: `proc-financial-${suffix}@example.com`,
    role: 'financial_approver',
    name: 'Financial Approver',
  },
  executive: {
    email: `proc-executive-${suffix}@example.com`,
    role: 'executive_approver',
    name: 'Executive Approver',
  },
  procurementOfficer: {
    email: `proc-officer-${suffix}@example.com`,
    role: 'procurement_officer',
    name: 'Procurement Officer',
  },
}

for (const account of Object.values(accounts)) {
  const client = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await client.auth.signUp({
    email: account.email,
    password,
    options: { data: { full_name: account.name } },
  })
  if (error) throw error
  assert.ok(data.user, 'Supabase signUp did not return a user')
  account.id = data.user.id
  assert.match(account.id, /^[0-9a-f-]{36}$/)
}

const companyId = '51000000-0000-4000-8000-000000000001'
const projectId = '52000000-0000-4000-8000-000000000001'
const sourcingPurchaseRequestId = '53000000-0000-4000-8000-000000000003'
const sourcingItemIds = [
  '54000000-0000-4000-8000-000000000031',
  '54000000-0000-4000-8000-000000000032',
]
const containerResult = spawnSync(
  'docker',
  [
    'ps',
    '--filter',
    'label=com.supabase.cli.project=atlas',
    '--filter',
    'name=supabase_db_',
    '--format',
    '{{.Names}}',
  ],
  { encoding: 'utf8' },
)
assert.equal(containerResult.status, 0, containerResult.stderr)
const container = containerResult.stdout.trim().split('\n').filter(Boolean)[0]
assert.ok(container, 'Supabase DB container not found')

const sql = `
insert into identity.companies (id, name, tax_number, created_by)
values ('${companyId}', 'Atlas Procurement E2E', null, '${accounts.requester.id}');

insert into identity.memberships (company_id, user_id, role, status)
values
  ('${companyId}', '${accounts.requester.id}', 'requester', 'active'),
  ('${companyId}', '${accounts.technical.id}', 'technical_reviewer', 'active'),
  ('${companyId}', '${accounts.financial.id}', 'financial_approver', 'active'),
  ('${companyId}', '${accounts.executive.id}', 'executive_approver', 'active'),
  ('${companyId}', '${accounts.procurementOfficer.id}', 'procurement_officer', 'active');

insert into projects.projects (id, company_id, code, name, status, created_by)
values ('${projectId}', '${companyId}', 'PROC-E2E', 'Procurement E2E Project', 'active', '${accounts.requester.id}');

insert into procurement.purchase_requests (
  id, company_id, project_id, request_number, requested_by, purpose, priority,
  required_date, status, estimated_total, currency, current_approver_role,
  created_at, updated_at, submitted_at, approved_at, version
) values (
  '${sourcingPurchaseRequestId}', '${companyId}', '${projectId}', 'PR-SOURCING-E2E',
  '${accounts.requester.id}', 'Materiais aprovados para sourcing E2E', 'high',
  '2026-10-20', 'approved', 300000, 'AOA', null,
  now(), now(), now(), now(), 1
);

insert into procurement.purchase_request_items (
  id, purchase_request_id, description, quantity, unit, estimated_unit_price
) values
  ('${sourcingItemIds[0]}', '${sourcingPurchaseRequestId}', 'Cimento Portland', 2, 'saco', 100000),
  ('${sourcingItemIds[1]}', '${sourcingPurchaseRequestId}', 'Areia lavada', 2, 'm3', 50000);

update procurement.approval_settings
set executive_approval_threshold = 1000000,
    currency = 'AOA',
    updated_at = now()
where company_id = '${companyId}';
`

const fixtureResult = spawnSync(
  'docker',
  [
    'exec',
    '-i',
    container,
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
  ],
  { input: sql, encoding: 'utf8' },
)
process.stdout.write(fixtureResult.stdout ?? '')
process.stderr.write(fixtureResult.stderr ?? '')
assert.equal(
  fixtureResult.status,
  0,
  'Could not create Procurement E2E fixture',
)

writeFileSync(
  '/tmp/atlas-procurement-e2e.json',
  JSON.stringify({
    password,
    companyId,
    projectId,
    sourcingPurchaseRequestId,
    sourcingItemIds,
    accounts,
  }),
)

console.log('Procurement and sourcing E2E fixture created without service role.')
