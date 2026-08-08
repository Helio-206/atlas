\set ON_ERROR_STOP on

begin;

DO $$
BEGIN
  IF has_table_privilege('anon','procurement.suppliers','SELECT')
     OR has_table_privilege('anon','procurement.quotations','SELECT')
     OR has_table_privilege('anon','procurement.quotation_items','SELECT')
     OR has_table_privilege('anon','procurement.supplier_selections','SELECT') THEN
    RAISE EXCEPTION 'anonymous has sourcing table read privileges';
  END IF;

  IF has_table_privilege('authenticated','procurement.suppliers','INSERT,UPDATE,DELETE')
     OR has_table_privilege('authenticated','procurement.quotations','INSERT,UPDATE,DELETE')
     OR has_table_privilege('authenticated','procurement.quotation_items','INSERT,UPDATE,DELETE')
     OR has_table_privilege('authenticated','procurement.supplier_selections','INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'authenticated has direct sourcing write privileges';
  END IF;
END
$$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000','71000000-0000-0000-0000-000000000001','authenticated','authenticated','rls-source-a@example.invalid','',now(),'{}'::jsonb,'{"full_name":"RLS Source A"}'::jsonb,now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','71000000-0000-0000-0000-000000000002','authenticated','authenticated','rls-source-b@example.invalid','',now(),'{}'::jsonb,'{"full_name":"RLS Source B"}'::jsonb,now(),now(),'','','','');

insert into identity.companies (id,name,tax_number,created_by) values
  ('72000000-0000-0000-0000-000000000001','RLS Sourcing A',null,'71000000-0000-0000-0000-000000000001'),
  ('72000000-0000-0000-0000-000000000002','RLS Sourcing B',null,'71000000-0000-0000-0000-000000000002');

insert into identity.memberships (company_id,user_id,role,status) values
  ('72000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001','procurement_officer','active'),
  ('72000000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000002','procurement_officer','active');

insert into projects.projects (id,company_id,code,name,status,created_by) values
  ('73000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000001','RLS-SA','RLS Source Project A','active','71000000-0000-0000-0000-000000000001'),
  ('73000000-0000-0000-0000-000000000002','72000000-0000-0000-0000-000000000002','RLS-SB','RLS Source Project B','active','71000000-0000-0000-0000-000000000002');

insert into procurement.purchase_requests (
  id,company_id,project_id,request_number,requested_by,purpose,priority,required_date,status,estimated_total,currency,version,approved_at
) values
  ('74000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001','RLS-S-A','71000000-0000-0000-0000-000000000001','RLS A','normal','2026-11-01','approved',100,'AOA',1,now()),
  ('74000000-0000-0000-0000-000000000002','72000000-0000-0000-0000-000000000002','73000000-0000-0000-0000-000000000002','RLS-S-B','71000000-0000-0000-0000-000000000002','RLS B','normal','2026-11-01','approved',100,'AOA',1,now());

insert into procurement.purchase_request_items (id,purchase_request_id,description,quantity,unit,estimated_unit_price) values
  ('75000000-0000-0000-0000-000000000001','74000000-0000-0000-0000-000000000001','A item',1,'un',100),
  ('75000000-0000-0000-0000-000000000002','74000000-0000-0000-0000-000000000002','B item',1,'un',100);

insert into procurement.suppliers (id,company_id,name,tax_number,status,created_by) values
  ('76000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000001','Supplier A','RLS-A','active','71000000-0000-0000-0000-000000000001'),
  ('76000000-0000-0000-0000-000000000002','72000000-0000-0000-0000-000000000002','Supplier B','RLS-B','active','71000000-0000-0000-0000-000000000002');

insert into procurement.quotations (
  id,company_id,purchase_request_id,supplier_id,quotation_number,currency,subtotal,tax_amount,total,status,created_by
) values
  ('77000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000001','74000000-0000-0000-0000-000000000001','76000000-0000-0000-0000-000000000001','RLS-Q-A','AOA',90,0,90,'submitted','71000000-0000-0000-0000-000000000001'),
  ('77000000-0000-0000-0000-000000000002','72000000-0000-0000-0000-000000000002','74000000-0000-0000-0000-000000000002','76000000-0000-0000-0000-000000000002','RLS-Q-B','AOA',95,0,95,'submitted','71000000-0000-0000-0000-000000000002');

insert into procurement.quotation_items (
  id,quotation_id,purchase_request_item_id,description,quantity,unit,unit_price
) values
  ('78000000-0000-0000-0000-000000000001','77000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000001','A item',1,'un',90),
  ('78000000-0000-0000-0000-000000000002','77000000-0000-0000-0000-000000000002','75000000-0000-0000-0000-000000000002','B item',1,'un',95);

insert into procurement.supplier_selections (
  id,company_id,purchase_request_id,quotation_id,supplier_id,selected_by,justification
) values
  ('79000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000001','74000000-0000-0000-0000-000000000001','77000000-0000-0000-0000-000000000001','76000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001','A selected'),
  ('79000000-0000-0000-0000-000000000002','72000000-0000-0000-0000-000000000002','74000000-0000-0000-0000-000000000002','77000000-0000-0000-0000-000000000002','76000000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000002','B selected');

set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}',true);

DO $$
BEGIN
  IF (SELECT count(*) FROM procurement.suppliers) <> 1 OR NOT EXISTS (SELECT 1 FROM procurement.suppliers WHERE id='76000000-0000-0000-0000-000000000001') THEN
    RAISE EXCEPTION 'Company A supplier RLS failed';
  END IF;
  IF (SELECT count(*) FROM procurement.quotations) <> 1 OR NOT EXISTS (SELECT 1 FROM procurement.quotations WHERE id='77000000-0000-0000-0000-000000000001') THEN
    RAISE EXCEPTION 'Company A quotation RLS failed';
  END IF;
  IF (SELECT count(*) FROM procurement.quotation_items) <> 1 OR NOT EXISTS (SELECT 1 FROM procurement.quotation_items WHERE id='78000000-0000-0000-0000-000000000001') THEN
    RAISE EXCEPTION 'Company A quotation item RLS failed';
  END IF;
  IF (SELECT count(*) FROM procurement.supplier_selections) <> 1 OR NOT EXISTS (SELECT 1 FROM procurement.supplier_selections WHERE id='79000000-0000-0000-0000-000000000001') THEN
    RAISE EXCEPTION 'Company A selection RLS failed';
  END IF;
END
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"71000000-0000-0000-0000-000000000002","role":"authenticated"}',true);

DO $$
BEGIN
  IF (SELECT count(*) FROM procurement.suppliers) <> 1 OR NOT EXISTS (SELECT 1 FROM procurement.suppliers WHERE id='76000000-0000-0000-0000-000000000002') THEN
    RAISE EXCEPTION 'Company B supplier RLS failed';
  END IF;
  IF (SELECT count(*) FROM procurement.quotations) <> 1 OR NOT EXISTS (SELECT 1 FROM procurement.quotations WHERE id='77000000-0000-0000-0000-000000000002') THEN
    RAISE EXCEPTION 'Company B quotation RLS failed';
  END IF;
  IF (SELECT count(*) FROM procurement.quotation_items) <> 1 OR NOT EXISTS (SELECT 1 FROM procurement.quotation_items WHERE id='78000000-0000-0000-0000-000000000002') THEN
    RAISE EXCEPTION 'Company B quotation item RLS failed';
  END IF;
  IF (SELECT count(*) FROM procurement.supplier_selections) <> 1 OR NOT EXISTS (SELECT 1 FROM procurement.supplier_selections WHERE id='79000000-0000-0000-0000-000000000002') THEN
    RAISE EXCEPTION 'Company B selection RLS failed';
  END IF;
END
$$;

reset role;
rollback;
