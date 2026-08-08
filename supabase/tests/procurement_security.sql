\set ON_ERROR_STOP on

begin;

DO $$
BEGIN
  IF has_function_privilege(
    'authenticated',
    'platform.calculate_purchase_request_total(uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated can execute internal procurement total helper';
  END IF;
END
$$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000','47000000-0000-0000-0000-00000000000a','authenticated','authenticated','security-proc-a@example.invalid','',now(),'{}'::jsonb,'{"full_name":"Security A"}'::jsonb,now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','47000000-0000-0000-0000-00000000000b','authenticated','authenticated','security-proc-b@example.invalid','',now(),'{}'::jsonb,'{"full_name":"Security B"}'::jsonb,now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','47000000-0000-0000-0000-00000000000c','authenticated','authenticated','security-proc-c@example.invalid','',now(),'{}'::jsonb,'{"full_name":"Security C"}'::jsonb,now(),now(),'','','','');

insert into identity.companies (id, name, tax_number, created_by)
values
  ('48000000-0000-0000-0000-00000000000a','Security Company A',null,'47000000-0000-0000-0000-00000000000a'),
  ('48000000-0000-0000-0000-00000000000b','Security Company B',null,'47000000-0000-0000-0000-00000000000b'),
  ('48000000-0000-0000-0000-00000000000c','Security Company C',null,'47000000-0000-0000-0000-00000000000c');

insert into identity.memberships (company_id, user_id, role, status)
values
  ('48000000-0000-0000-0000-00000000000a','47000000-0000-0000-0000-00000000000a','administrator','active'),
  ('48000000-0000-0000-0000-00000000000b','47000000-0000-0000-0000-00000000000b','administrator','active'),
  ('48000000-0000-0000-0000-00000000000c','47000000-0000-0000-0000-00000000000c','owner','active');

set local role authenticated;
select set_config('request.jwt.claim.sub','47000000-0000-0000-0000-00000000000a',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"47000000-0000-0000-0000-00000000000a","role":"authenticated"}',true);

DO $$
BEGIN
  BEGIN
    PERFORM platform.procurement_requester_name('47000000-0000-0000-0000-00000000000b');
    RAISE EXCEPTION 'cross-company requester profile was exposed';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END
$$;

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','47000000-0000-0000-0000-00000000000c',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"47000000-0000-0000-0000-00000000000c","role":"authenticated"}',true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.get_procurement_approval_settings()) THEN
    RAISE EXCEPTION 'role without Procurement.View can read approval settings';
  END IF;
END
$$;

reset role;
rollback;
