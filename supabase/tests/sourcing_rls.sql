\set ON_ERROR_STOP on
begin;

insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token) values
('00000000-0000-0000-0000-000000000000','71000000-0000-4000-8000-000000000001','authenticated','authenticated','rls-a@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"RLS A"}'::jsonb,now(),now(),'','','',''),
('00000000-0000-0000-0000-000000000000','71000000-0000-4000-8000-000000000002','authenticated','authenticated','rls-b@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"RLS B"}'::jsonb,now(),now(),'','','','');
insert into identity.companies(id,name,tax_number,created_by) values
('72000000-0000-4000-8000-000000000001','RLS Sourcing A',null,'71000000-0000-4000-8000-000000000001'),
('72000000-0000-4000-8000-000000000002','RLS Sourcing B',null,'71000000-0000-4000-8000-000000000002');
insert into identity.memberships(company_id,user_id,role,status) values
('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','procurement_officer','active'),
('72000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000002','procurement_officer','active');
insert into projects.projects(id,company_id,code,name,status,created_by) values
('73000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','RLS-A','Project A','active','71000000-0000-4000-8000-000000000001'),
('73000000-0000-4000-8000-000000000002','72000000-0000-4000-8000-000000000002','RLS-B','Project B','active','71000000-0000-4000-8000-000000000002');
insert into procurement.purchase_requests(id,company_id,project_id,request_number,requested_by,purpose,priority,required_date,status,estimated_total,currency) values
('74000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','RLS-SRC-A','71000000-0000-4000-8000-000000000001','RLS Request A','normal','2026-10-01','approved',10,'AOA'),
('74000000-0000-4000-8000-000000000002','72000000-0000-4000-8000-000000000002','73000000-0000-4000-8000-000000000002','RLS-SRC-B','71000000-0000-4000-8000-000000000002','RLS Request B','normal','2026-10-01','approved',10,'AOA');
insert into procurement.purchase_request_items(id,purchase_request_id,description,quantity,unit,estimated_unit_price) values
('75000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001','Item A',1,'un',10),
('75000000-0000-4000-8000-000000000002','74000000-0000-4000-8000-000000000002','Item B',1,'un',10);
insert into procurement.suppliers(id,company_id,name,tax_number,status,created_by) values
('76000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','Supplier A','RLS-A','active','71000000-0000-4000-8000-000000000001'),
('76000000-0000-4000-8000-000000000002','72000000-0000-4000-8000-000000000002','Supplier B','RLS-B','active','71000000-0000-4000-8000-000000000002');
insert into procurement.quotations(id,company_id,purchase_request_id,supplier_id,quotation_number,currency,subtotal,tax_amount,total,status,created_by) values
('77000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000001','RLS-QA','AOA',10,0,10,'submitted','71000000-0000-4000-8000-000000000001'),
('77000000-0000-4000-8000-000000000002','72000000-0000-4000-8000-000000000002','74000000-0000-4000-8000-000000000002','76000000-0000-4000-8000-000000000002','RLS-QB','AOA',10,0,10,'submitted','71000000-0000-4000-8000-000000000002');
insert into procurement.quotation_items(id,quotation_id,purchase_request_item_id,description,quantity,unit,unit_price) values
('78000000-0000-4000-8000-000000000001','77000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000001','Item A',1,'un',10),
('78000000-0000-4000-8000-000000000002','77000000-0000-4000-8000-000000000002','75000000-0000-4000-8000-000000000002','Item B',1,'un',10);
insert into procurement.supplier_selections(id,company_id,purchase_request_id,quotation_id,supplier_id,selected_by,justification) values
('79000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001','77000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','A selection'),
('79000000-0000-4000-8000-000000000002','72000000-0000-4000-8000-000000000002','74000000-0000-4000-8000-000000000002','77000000-0000-4000-8000-000000000002','76000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000002','B selection');

set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
DO $$ begin
  if (select count(*) from procurement.suppliers)<>1 or not exists(select 1 from procurement.suppliers where name='Supplier A') then raise exception 'Company A supplier isolation failed'; end if;
  if (select count(*) from procurement.quotations)<>1 or not exists(select 1 from procurement.quotations where quotation_number='RLS-QA') then raise exception 'Company A quotation isolation failed'; end if;
  if (select count(*) from procurement.quotation_items)<>1 or not exists(select 1 from procurement.quotation_items where description='Item A') then raise exception 'Company A quotation item isolation failed'; end if;
  if (select count(*) from procurement.supplier_selections)<>1 or not exists(select 1 from procurement.supplier_selections where justification='A selection') then raise exception 'Company A selection isolation failed'; end if;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
DO $$ begin
  if (select count(*) from procurement.suppliers)<>1 or not exists(select 1 from procurement.suppliers where name='Supplier B') then raise exception 'Company B supplier isolation failed'; end if;
  if (select count(*) from procurement.quotations)<>1 or not exists(select 1 from procurement.quotations where quotation_number='RLS-QB') then raise exception 'Company B quotation isolation failed'; end if;
  if (select count(*) from procurement.quotation_items)<>1 or not exists(select 1 from procurement.quotation_items where description='Item B') then raise exception 'Company B quotation item isolation failed'; end if;
  if (select count(*) from procurement.supplier_selections)<>1 or not exists(select 1 from procurement.supplier_selections where justification='B selection') then raise exception 'Company B selection isolation failed'; end if;
end $$;
reset role;

set local role anon;
DO $$ begin
  BEGIN PERFORM 1 FROM procurement.suppliers LIMIT 1; RAISE EXCEPTION 'anonymous read suppliers'; EXCEPTION WHEN insufficient_privilege THEN null; END;
  BEGIN PERFORM 1 FROM procurement.quotations LIMIT 1; RAISE EXCEPTION 'anonymous read quotations'; EXCEPTION WHEN insufficient_privilege THEN null; END;
  BEGIN PERFORM 1 FROM procurement.quotation_items LIMIT 1; RAISE EXCEPTION 'anonymous read quotation items'; EXCEPTION WHEN insufficient_privilege THEN null; END;
  BEGIN PERFORM 1 FROM procurement.supplier_selections LIMIT 1; RAISE EXCEPTION 'anonymous read selections'; EXCEPTION WHEN insufficient_privilege THEN null; END;
end $$;
reset role;

rollback;
