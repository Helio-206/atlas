\set ON_ERROR_STOP on

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000','31000000-0000-0000-0000-000000000001','authenticated','authenticated','proc-requester@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Proc Requester"}'::jsonb,now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','31000000-0000-0000-0000-000000000002','authenticated','authenticated','proc-tech@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Proc Technical"}'::jsonb,now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','31000000-0000-0000-0000-000000000003','authenticated','authenticated','proc-fin@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Proc Financial"}'::jsonb,now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','31000000-0000-0000-0000-000000000004','authenticated','authenticated','proc-exec@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Proc Executive"}'::jsonb,now(),now(),'','','','');

insert into identity.companies (id, name, tax_number, created_by)
values ('32000000-0000-0000-0000-000000000001','Procurement Test Company',null,'31000000-0000-0000-0000-000000000001');

insert into identity.memberships (company_id, user_id, role, status)
values
  ('32000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','requester','active'),
  ('32000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000002','technical_reviewer','active'),
  ('32000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000003','financial_approver','active'),
  ('32000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000004','executive_approver','active');

insert into projects.projects (id, company_id, code, name, status, created_by)
values
  ('33000000-0000-0000-0000-000000000001','32000000-0000-0000-0000-000000000001','PROC-ACTIVE','Active Procurement Project','active','31000000-0000-0000-0000-000000000001'),
  ('33000000-0000-0000-0000-000000000002','32000000-0000-0000-0000-000000000001','PROC-DRAFT','Inactive Procurement Project','draft','31000000-0000-0000-0000-000000000001');

-- Requester context.
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"31000000-0000-0000-0000-000000000001","role":"authenticated"}',true);

select set_config(
  'atlas.test.main_request',
  public.create_purchase_request(
    '33000000-0000-0000-0000-000000000001',
    'Materiais de fundação',
    'high',
    '2026-09-15'::date,
    'AOA',
    '[{"description":"Cimento","quantity":2,"unit":"saco","estimatedUnitPrice":100000},{"description":"Areia","quantity":3,"unit":"m3","estimatedUnitPrice":50000}]'::jsonb
  )::text,
  true
);

DO $$
DECLARE
  request_id uuid := current_setting('atlas.test.main_request')::uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM procurement.purchase_requests request
    WHERE request.id = request_id
      AND request.status = 'draft'
      AND request.version = 1
      AND request.estimated_total = 350000
      AND request.requested_by = '31000000-0000-0000-0000-000000000001'::uuid
      AND request.company_id = '32000000-0000-0000-0000-000000000001'::uuid
  ) THEN
    RAISE EXCEPTION 'purchase request creation or total derivation failed';
  END IF;
END
$$;

-- Inactive project cannot be used.
DO $$
BEGIN
  BEGIN
    PERFORM public.create_purchase_request(
      '33000000-0000-0000-0000-000000000002',
      'Should fail', 'normal', '2026-09-15'::date, 'AOA', '[]'::jsonb
    );
    RAISE EXCEPTION 'inactive project was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'active_project_required' THEN RAISE; END IF;
  END;
END
$$;

-- Empty draft may exist, but cannot be submitted.
select set_config(
  'atlas.test.empty_request',
  public.create_purchase_request(
    '33000000-0000-0000-0000-000000000001',
    'Empty draft', 'normal', '2026-09-15'::date, 'AOA', '[]'::jsonb
  )::text,
  true
);

DO $$
BEGIN
  BEGIN
    PERFORM public.submit_purchase_request(current_setting('atlas.test.empty_request')::uuid, 1);
    RAISE EXCEPTION 'request without items was submitted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'purchase_request_items_required' THEN RAISE; END IF;
  END;
END
$$;

-- Main request submission begins technical review.
DO $$
DECLARE
  request_id uuid := current_setting('atlas.test.main_request')::uuid;
BEGIN
  IF public.submit_purchase_request(request_id, 1) <> 2 THEN
    RAISE EXCEPTION 'submission did not increment version';
  END IF;
END
$$;

-- Requester cannot approve own request.
DO $$
BEGIN
  BEGIN
    PERFORM public.approve_technical_review(current_setting('atlas.test.main_request')::uuid, 2, null);
    RAISE EXCEPTION 'self approval was accepted';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM <> 'self_approval_forbidden' THEN RAISE; END IF;
  END;
END
$$;

reset role;

-- Technical approval.
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"31000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
DO $$
BEGIN
  IF public.approve_technical_review(current_setting('atlas.test.main_request')::uuid, 2, 'Technical OK') <> 3 THEN
    RAISE EXCEPTION 'technical approval failed';
  END IF;
END
$$;
reset role;

-- Financial approval below threshold finishes the request.
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"31000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
DO $$
BEGIN
  IF public.approve_financial_review(current_setting('atlas.test.main_request')::uuid, 3, 'Budget OK') <> 4 THEN
    RAISE EXCEPTION 'financial approval failed';
  END IF;
END
$$;
reset role;

DO $$
DECLARE
  request_id uuid := current_setting('atlas.test.main_request')::uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM procurement.purchase_requests request
    WHERE request.id = request_id AND request.status = 'approved' AND request.version = 4 AND request.approved_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'below-threshold request was not approved';
  END IF;

  IF (SELECT count(*) FROM procurement.approval_decisions decision WHERE decision.purchase_request_id = request_id) <> 2 THEN
    RAISE EXCEPTION 'approval decisions are missing';
  END IF;

  IF (SELECT count(*) FROM audit.entries entry WHERE entry.resource_id = request_id AND entry.action IN ('PurchaseRequestCreated','PurchaseRequestSubmitted','TechnicalApprovalGranted','FinancialApprovalGranted')) <> 4 THEN
    RAISE EXCEPTION 'main request audit trail is incomplete';
  END IF;
END
$$;

-- High value request requires executive review.
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"31000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select set_config(
  'atlas.test.high_request',
  public.create_purchase_request(
    '33000000-0000-0000-0000-000000000001',
    'Heavy equipment rental', 'urgent', '2026-10-01'::date, 'AOA',
    '[{"description":"Crane rental","quantity":2,"unit":"day","estimatedUnitPrice":600000}]'::jsonb
  )::text,
  true
);
select public.submit_purchase_request(current_setting('atlas.test.high_request')::uuid, 1);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
select public.approve_technical_review(current_setting('atlas.test.high_request')::uuid, 2, null);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claim.role','authenticated',true);
select public.approve_financial_review(current_setting('atlas.test.high_request')::uuid, 3, null);
reset role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM procurement.purchase_requests request
    WHERE request.id = current_setting('atlas.test.high_request')::uuid
      AND request.status = 'executive_review'
      AND request.version = 4
  ) THEN
    RAISE EXCEPTION 'high request did not enter executive review';
  END IF;
END
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000004',true);
select set_config('request.jwt.claim.role','authenticated',true);
select public.approve_executive_review(current_setting('atlas.test.high_request')::uuid, 4, 'Executive OK');
reset role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM procurement.purchase_requests request
    WHERE request.id = current_setting('atlas.test.high_request')::uuid
      AND request.status = 'approved'
      AND request.version = 5
  ) THEN
    RAISE EXCEPTION 'executive approval failed';
  END IF;
END
$$;

-- Return, edit, resubmit, reject.
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config(
  'atlas.test.return_request',
  public.create_purchase_request(
    '33000000-0000-0000-0000-000000000001',
    'Return cycle', 'normal', '2026-10-10'::date, 'AOA',
    '[{"description":"Steel","quantity":1,"unit":"lot","estimatedUnitPrice":100000}]'::jsonb
  )::text,
  true
);
select public.submit_purchase_request(current_setting('atlas.test.return_request')::uuid, 1);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
select public.return_purchase_request(current_setting('atlas.test.return_request')::uuid, 2, 'Clarify scope');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select public.update_purchase_request(
  current_setting('atlas.test.return_request')::uuid,
  3,
  '33000000-0000-0000-0000-000000000001',
  'Return cycle revised',
  'high',
  '2026-10-12'::date,
  'AOA'
);
select public.submit_purchase_request(current_setting('atlas.test.return_request')::uuid, 4);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
select public.reject_purchase_request(current_setting('atlas.test.return_request')::uuid, 5, 'Still insufficient');
reset role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM procurement.purchase_requests request
    WHERE request.id = current_setting('atlas.test.return_request')::uuid
      AND request.status = 'rejected'
      AND request.version = 6
      AND request.purpose = 'Return cycle revised'
  ) THEN
    RAISE EXCEPTION 'return/resubmit/reject flow failed';
  END IF;

  IF (SELECT count(*) FROM procurement.approval_decisions decision WHERE decision.purchase_request_id = current_setting('atlas.test.return_request')::uuid) <> 2 THEN
    RAISE EXCEPTION 'return and reject decisions were not append-only';
  END IF;
END
$$;

-- Cancellation before final approval.
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config(
  'atlas.test.cancel_request',
  public.create_purchase_request(
    '33000000-0000-0000-0000-000000000001',
    'Cancel me', 'low', '2026-11-01'::date, 'AOA', '[]'::jsonb
  )::text,
  true
);
select public.cancel_purchase_request(current_setting('atlas.test.cancel_request')::uuid, 1);
reset role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM procurement.purchase_requests request
    WHERE request.id = current_setting('atlas.test.cancel_request')::uuid AND request.status = 'cancelled' AND request.version = 2
  ) THEN
    RAISE EXCEPTION 'cancellation failed';
  END IF;
END
$$;

-- Optimistic concurrency on item mutation.
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config(
  'atlas.test.version_request',
  public.create_purchase_request(
    '33000000-0000-0000-0000-000000000001',
    'Concurrency test', 'normal', '2026-11-02'::date, 'AOA', '[]'::jsonb
  )::text,
  true
);
select public.add_purchase_request_item(current_setting('atlas.test.version_request')::uuid, 1, 'First', 1, 'un', 10);
DO $$
BEGIN
  BEGIN
    PERFORM public.add_purchase_request_item(current_setting('atlas.test.version_request')::uuid, 1, 'Stale', 1, 'un', 10);
    RAISE EXCEPTION 'stale item mutation was accepted';
  EXCEPTION WHEN serialization_failure THEN
    IF SQLERRM <> 'purchase_request_version_conflict' THEN RAISE; END IF;
  END;
END
$$;
reset role;

-- Wrong reviewer permission is rejected.
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config(
  'atlas.test.permission_request',
  public.create_purchase_request(
    '33000000-0000-0000-0000-000000000001',
    'Permission test', 'normal', '2026-11-03'::date, 'AOA',
    '[{"description":"Test","quantity":1,"unit":"un","estimatedUnitPrice":10}]'::jsonb
  )::text,
  true
);
select public.submit_purchase_request(current_setting('atlas.test.permission_request')::uuid, 1);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claim.role','authenticated',true);
DO $$
BEGIN
  BEGIN
    PERFORM public.approve_technical_review(current_setting('atlas.test.permission_request')::uuid, 2, null);
    RAISE EXCEPTION 'financial approver performed technical approval';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM <> 'procurement_permission_denied' THEN RAISE; END IF;
  END;
END
$$;
reset role;

rollback;
