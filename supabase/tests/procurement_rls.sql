\set ON_ERROR_STOP on

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000','41000000-0000-0000-0000-00000000000a','authenticated','authenticated','rls-proc-a@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"RLS Proc A"}'::jsonb,now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','41000000-0000-0000-0000-00000000000b','authenticated','authenticated','rls-proc-b@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"RLS Proc B"}'::jsonb,now(),now(),'','','','');

insert into identity.companies (id, name, tax_number, created_by)
values
  ('42000000-0000-0000-0000-00000000000a','RLS Procurement A',null,'41000000-0000-0000-0000-00000000000a'),
  ('42000000-0000-0000-0000-00000000000b','RLS Procurement B',null,'41000000-0000-0000-0000-00000000000b');

insert into identity.memberships (company_id, user_id, role, status)
values
  ('42000000-0000-0000-0000-00000000000a','41000000-0000-0000-0000-00000000000a','administrator','active'),
  ('42000000-0000-0000-0000-00000000000b','41000000-0000-0000-0000-00000000000b','administrator','active');

insert into projects.projects (id, company_id, code, name, status, created_by)
values
  ('43000000-0000-0000-0000-00000000000a','42000000-0000-0000-0000-00000000000a','RLS-A','RLS Project A','active','41000000-0000-0000-0000-00000000000a'),
  ('43000000-0000-0000-0000-00000000000b','42000000-0000-0000-0000-00000000000b','RLS-B','RLS Project B','active','41000000-0000-0000-0000-00000000000b');

insert into procurement.purchase_requests (
  id, company_id, project_id, request_number, requested_by, purpose, priority,
  required_date, status, estimated_total, currency, version
) values
  ('44000000-0000-0000-0000-00000000000a','42000000-0000-0000-0000-00000000000a','43000000-0000-0000-0000-00000000000a','RLS-PR-A','41000000-0000-0000-0000-00000000000a','Request A','normal','2026-09-01','technical_review',100,'AOA',1),
  ('44000000-0000-0000-0000-00000000000b','42000000-0000-0000-0000-00000000000b','43000000-0000-0000-0000-00000000000b','RLS-PR-B','41000000-0000-0000-0000-00000000000b','Request B','normal','2026-09-01','technical_review',200,'AOA',1);

insert into procurement.purchase_request_items (
  id, purchase_request_id, description, quantity, unit, estimated_unit_price
) values
  ('45000000-0000-0000-0000-00000000000a','44000000-0000-0000-0000-00000000000a','Item A',1,'un',100),
  ('45000000-0000-0000-0000-00000000000b','44000000-0000-0000-0000-00000000000b','Item B',1,'un',200);

insert into procurement.approval_decisions (
  id, purchase_request_id, company_id, stage, decision, decided_by, comment
) values
  ('46000000-0000-0000-0000-00000000000a','44000000-0000-0000-0000-00000000000a','42000000-0000-0000-0000-00000000000a','technical','returned','41000000-0000-0000-0000-00000000000a','A'),
  ('46000000-0000-0000-0000-00000000000b','44000000-0000-0000-0000-00000000000b','42000000-0000-0000-0000-00000000000b','technical','returned','41000000-0000-0000-0000-00000000000b','B');

-- Company A sees only A across aggregate tables.
set local role authenticated;
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-00000000000a',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"41000000-0000-0000-0000-00000000000a","role":"authenticated"}',true);

DO $$
BEGIN
  IF (SELECT count(*) FROM procurement.purchase_requests) <> 1 THEN
    RAISE EXCEPTION 'Company A purchase request RLS count failed';
  END IF;
  IF EXISTS (SELECT 1 FROM procurement.purchase_requests request WHERE request.company_id <> '42000000-0000-0000-0000-00000000000a'::uuid) THEN
    RAISE EXCEPTION 'Company A read Company B request';
  END IF;
  IF (SELECT count(*) FROM procurement.purchase_request_items) <> 1 THEN
    RAISE EXCEPTION 'Company A item RLS count failed';
  END IF;
  IF EXISTS (SELECT 1 FROM procurement.purchase_request_items item WHERE item.id = '45000000-0000-0000-0000-00000000000b'::uuid) THEN
    RAISE EXCEPTION 'Company A read Company B item';
  END IF;
  IF (SELECT count(*) FROM procurement.approval_decisions) <> 1 THEN
    RAISE EXCEPTION 'Company A approval RLS count failed';
  END IF;
  IF EXISTS (SELECT 1 FROM procurement.approval_decisions decision WHERE decision.company_id <> '42000000-0000-0000-0000-00000000000a'::uuid) THEN
    RAISE EXCEPTION 'Company A read Company B decision';
  END IF;
END
$$;

reset role;

-- Company B sees only B.
set local role authenticated;
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-00000000000b',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"41000000-0000-0000-0000-00000000000b","role":"authenticated"}',true);

DO $$
BEGIN
  IF (SELECT count(*) FROM procurement.purchase_requests) <> 1 THEN
    RAISE EXCEPTION 'Company B purchase request RLS count failed';
  END IF;
  IF EXISTS (SELECT 1 FROM procurement.purchase_requests request WHERE request.company_id <> '42000000-0000-0000-0000-00000000000b'::uuid) THEN
    RAISE EXCEPTION 'Company B read Company A request';
  END IF;
  IF (SELECT count(*) FROM procurement.purchase_request_items) <> 1 THEN
    RAISE EXCEPTION 'Company B item RLS count failed';
  END IF;
  IF EXISTS (SELECT 1 FROM procurement.purchase_request_items item WHERE item.id = '45000000-0000-0000-0000-00000000000a'::uuid) THEN
    RAISE EXCEPTION 'Company B read Company A item';
  END IF;
  IF (SELECT count(*) FROM procurement.approval_decisions) <> 1 THEN
    RAISE EXCEPTION 'Company B approval RLS count failed';
  END IF;
  IF EXISTS (SELECT 1 FROM procurement.approval_decisions decision WHERE decision.company_id <> '42000000-0000-0000-0000-00000000000b'::uuid) THEN
    RAISE EXCEPTION 'Company B read Company A decision';
  END IF;
END
$$;

reset role;

-- Anonymous cannot even use the private procurement schema.
set local role anon;
DO $$
BEGIN
  BEGIN
    PERFORM 1 FROM procurement.purchase_requests LIMIT 1;
    RAISE EXCEPTION 'anonymous read purchase requests';
  EXCEPTION WHEN insufficient_privilege THEN
    null;
  END;

  BEGIN
    PERFORM 1 FROM procurement.purchase_request_items LIMIT 1;
    RAISE EXCEPTION 'anonymous read purchase request items';
  EXCEPTION WHEN insufficient_privilege THEN
    null;
  END;

  BEGIN
    PERFORM 1 FROM procurement.approval_decisions LIMIT 1;
    RAISE EXCEPTION 'anonymous read approval decisions';
  EXCEPTION WHEN insufficient_privilege THEN
    null;
  END;
END
$$;
reset role;

rollback;
