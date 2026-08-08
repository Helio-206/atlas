\set ON_ERROR_STOP on
begin;

insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token) values
('00000000-0000-0000-0000-000000000000','61000000-0000-4000-8000-000000000001','authenticated','authenticated','sourcing-officer@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Sourcing Officer"}'::jsonb,now(),now(),'','','',''),
('00000000-0000-0000-0000-000000000000','61000000-0000-4000-8000-000000000002','authenticated','authenticated','other-officer@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Other Officer"}'::jsonb,now(),now(),'','','','');

insert into identity.companies(id,name,tax_number,created_by) values
('62000000-0000-4000-8000-000000000001','Sourcing Company A',null,'61000000-0000-4000-8000-000000000001'),
('62000000-0000-4000-8000-000000000002','Sourcing Company B',null,'61000000-0000-4000-8000-000000000002');
insert into identity.memberships(company_id,user_id,role,status) values
('62000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','procurement_officer','active'),
('62000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000002','procurement_officer','active');
insert into projects.projects(id,company_id,code,name,status,created_by) values
('63000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','SRC-A','Sourcing A','active','61000000-0000-4000-8000-000000000001');
insert into procurement.purchase_requests(id,company_id,project_id,request_number,requested_by,purpose,priority,required_date,status,estimated_total,currency,version) values
('64000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','63000000-0000-4000-8000-000000000001','SRC-PR-001','61000000-0000-4000-8000-000000000001','Approved sourcing request','normal','2026-10-01','approved',350,'AOA',1),
('64000000-0000-4000-8000-000000000002','62000000-0000-4000-8000-000000000001','63000000-0000-4000-8000-000000000001','SRC-PR-002','61000000-0000-4000-8000-000000000001','Blocked supplier request','normal','2026-10-01','approved',100,'AOA',1),
('64000000-0000-4000-8000-000000000003','62000000-0000-4000-8000-000000000001','63000000-0000-4000-8000-000000000001','SRC-PR-DRAFT','61000000-0000-4000-8000-000000000001','Draft request','normal','2026-10-01','draft',100,'AOA',1);
insert into procurement.purchase_request_items(id,purchase_request_id,description,quantity,unit,estimated_unit_price) values
('65000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000001','Cimento',2,'saco',100),
('65000000-0000-4000-8000-000000000002','64000000-0000-4000-8000-000000000001','Areia',3,'m3',50),
('65000000-0000-4000-8000-000000000003','64000000-0000-4000-8000-000000000002','Aço',1,'lote',100),
('65000000-0000-4000-8000-000000000004','64000000-0000-4000-8000-000000000003','Teste',1,'un',100);
insert into procurement.suppliers(id,company_id,name,tax_number,status,created_by) values
('66000000-0000-4000-8000-000000000099','62000000-0000-4000-8000-000000000002','Foreign Supplier','FOREIGN','active','61000000-0000-4000-8000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

select set_config('atlas.supplier.a',public.create_supplier('Supplier A','NIF-A','a@example.invalid','9001','Luanda')::text,true);
select set_config('atlas.supplier.b',public.create_supplier('Supplier B','NIF-B','b@example.invalid','9002','Luanda')::text,true);
select set_config('atlas.supplier.c',public.create_supplier('Supplier C','NIF-C',null,null,null)::text,true);

DO $$ begin
  begin perform public.create_supplier('Duplicate','NIF-A',null,null,null); raise exception 'duplicate tax number accepted';
  exception when unique_violation then if SQLERRM <> 'supplier_tax_number_exists' then raise; end if; end;
end $$;

DO $$ begin
  begin perform public.create_quotation('64000000-0000-4000-8000-000000000003',current_setting('atlas.supplier.a')::uuid,null,'AOA',0,null,5,null,null,'[]'::jsonb); raise exception 'quotation for draft PR accepted';
  exception when raise_exception then if SQLERRM <> 'approved_purchase_request_required' then raise; end if; end;
end $$;

DO $$ begin
  begin perform public.create_quotation('64000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000099',null,'AOA',0,null,5,null,null,'[]'::jsonb); raise exception 'cross tenant supplier accepted';
  exception when raise_exception then if SQLERRM <> 'supplier_not_found' then raise; end if; end;
end $$;

select set_config('atlas.quote.a',public.create_quotation(
  '64000000-0000-4000-8000-000000000001',current_setting('atlas.supplier.a')::uuid,'QA-1','AOA',35,'2026-12-31',5,'30 dias','Completa',
  '[{"purchaseRequestItemId":"65000000-0000-4000-8000-000000000001","description":"Cimento","quantity":2,"unit":"saco","unitPrice":100},{"purchaseRequestItemId":"65000000-0000-4000-8000-000000000002","description":"Areia","quantity":3,"unit":"m3","unitPrice":50}]'::jsonb
)::text,true);
select set_config('atlas.quote.b',public.create_quotation(
  '64000000-0000-4000-8000-000000000001',current_setting('atlas.supplier.b')::uuid,'QB-1','AOA',0,'2026-12-31',3,'Pronto pagamento','Parcial',
  '[{"purchaseRequestItemId":"65000000-0000-4000-8000-000000000001","description":"Cimento","quantity":2,"unit":"saco","unitPrice":80}]'::jsonb
)::text,true);

DO $$ declare qa uuid:=current_setting('atlas.quote.a')::uuid; qb uuid:=current_setting('atlas.quote.b')::uuid; begin
  if not exists(select 1 from procurement.quotations where id=qa and subtotal=350 and total=385) then raise exception 'quotation total was not derived'; end if;
  if not exists(select 1 from public.list_purchase_request_quotations('64000000-0000-4000-8000-000000000001') where id=qb and coverage_count=1 and request_item_count=2 and coverage_percent=50) then raise exception 'partial quotation coverage failed'; end if;
end $$;

DO $$ begin
  begin perform public.update_supplier(current_setting('atlas.supplier.a')::uuid,99,'Supplier A','NIF-A','a@example.invalid','9001','Luanda'); raise exception 'stale supplier update accepted';
  exception when serialization_failure then if SQLERRM <> 'supplier_version_conflict' then raise; end if; end;
end $$;

select public.submit_quotation(current_setting('atlas.quote.a')::uuid,1);
select public.submit_quotation(current_setting('atlas.quote.b')::uuid,1);
select public.select_supplier('64000000-0000-4000-8000-000000000001',current_setting('atlas.quote.a')::uuid,1,2,'Melhor equilíbrio entre preço, cobertura e prazo');

DO $$ begin
  if not exists(select 1 from procurement.purchase_requests where id='64000000-0000-4000-8000-000000000001' and status='supplier_selected' and version=2) then raise exception 'supplier selection did not transition PR'; end if;
  if (select count(*) from procurement.supplier_selections where purchase_request_id='64000000-0000-4000-8000-000000000001')<>1 then raise exception 'selection not persisted once'; end if;
  if not exists(select 1 from procurement.quotations where id=current_setting('atlas.quote.a')::uuid and status='accepted') then raise exception 'selected quotation not accepted'; end if;
end $$;

reset role;
DO $$ begin
  if not exists(select 1 from audit.entries where resource_id='64000000-0000-4000-8000-000000000001' and action='SupplierSelected') then raise exception 'supplier selection audit missing'; end if;
  if (select count(*) from audit.entries where action in ('SupplierCreated','QuotationCreated','QuotationSubmitted','SupplierSelected') and company_id='62000000-0000-4000-8000-000000000001') <> 8 then raise exception 'sourcing audit event count mismatch'; end if;
end $$;

set local role authenticated;
select set_config('atlas.quote.c',public.create_quotation(
  '64000000-0000-4000-8000-000000000002',current_setting('atlas.supplier.c')::uuid,'QC-1','AOA',0,null,2,null,null,
  '[{"purchaseRequestItemId":"65000000-0000-4000-8000-000000000003","description":"Aço","quantity":1,"unit":"lote","unitPrice":90}]'::jsonb
)::text,true);
select public.submit_quotation(current_setting('atlas.quote.c')::uuid,1);
select public.block_supplier(current_setting('atlas.supplier.c')::uuid,1);

DO $$ begin
  begin perform public.select_supplier('64000000-0000-4000-8000-000000000002',current_setting('atlas.quote.c')::uuid,1,2,'Tentativa bloqueada'); raise exception 'blocked supplier selected';
  exception when raise_exception then if SQLERRM <> 'supplier_blocked' then raise; end if; end;
end $$;

reset role;
DO $$ begin
  if not exists(select 1 from audit.entries where resource_id=current_setting('atlas.supplier.c')::uuid and action='SupplierBlocked') then raise exception 'supplier block audit missing'; end if;
end $$;

rollback;
