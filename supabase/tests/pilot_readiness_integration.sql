\set ON_ERROR_STOP on
begin;

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token) values
('00000000-0000-0000-0000-000000000000','a6000000-0000-4000-8000-000000000001','authenticated','authenticated','admin@atlas.demo','',now(),'{"provider":"email","providers":["email"]}','{"full_name":"Helena Manuel"}',now(),now(),'','','',''),
('00000000-0000-0000-0000-000000000000','a6000000-0000-4000-8000-000000000002','authenticated','authenticated','project.manager@atlas.demo','',now(),'{"provider":"email","providers":["email"]}','{"full_name":"Paulo Domingos"}',now(),now(),'','','',''),
('00000000-0000-0000-0000-000000000000','a6000000-0000-4000-8000-000000000003','authenticated','authenticated','requester@atlas.demo','',now(),'{"provider":"email","providers":["email"]}','{"full_name":"Marta André"}',now(),now(),'','','',''),
('00000000-0000-0000-0000-000000000000','a6000000-0000-4000-8000-000000000004','authenticated','authenticated','technical@atlas.demo','',now(),'{"provider":"email","providers":["email"]}','{"full_name":"Carlos Mateus"}',now(),now(),'','','',''),
('00000000-0000-0000-0000-000000000000','a6000000-0000-4000-8000-000000000005','authenticated','authenticated','finance@atlas.demo','',now(),'{"provider":"email","providers":["email"]}','{"full_name":"Inês Joaquim"}',now(),now(),'','','',''),
('00000000-0000-0000-0000-000000000000','a6000000-0000-4000-8000-000000000006','authenticated','authenticated','director@atlas.demo','',now(),'{"provider":"email","providers":["email"]}','{"full_name":"António Neto"}',now(),now(),'','','',''),
('00000000-0000-0000-0000-000000000000','a6000000-0000-4000-8000-000000000007','authenticated','authenticated','procurement@atlas.demo','',now(),'{"provider":"email","providers":["email"]}','{"full_name":"Sofia Miguel"}',now(),now(),'','','',''),
('00000000-0000-0000-0000-000000000000','a6000000-0000-4000-8000-000000000008','authenticated','authenticated','warehouse@atlas.demo','',now(),'{"provider":"email","providers":["email"]}','{"full_name":"Daniel Costa"}',now(),now(),'','','','');

select platform.seed_atlas_demo_data();

do $$
declare
  states text[];
  bucket_public boolean;
  bucket_limit bigint;
  warning_fixed boolean;
begin
  if (select count(*) from identity.companies where id='d0000000-0000-4000-8000-000000000001')<>1 then raise exception 'demo company missing'; end if;
  if (select count(*) from projects.projects where company_id='d0000000-0000-4000-8000-000000000001')<>3 then raise exception 'demo projects incomplete'; end if;
  if (select count(*) from procurement.suppliers where company_id='d0000000-0000-4000-8000-000000000001')<5 then raise exception 'demo suppliers incomplete'; end if;
  select array_agg(distinct status::text order by status::text) into states from procurement.purchase_requests where company_id='d0000000-0000-4000-8000-000000000001';
  if not states @> array['draft','technical_review','financial_review','executive_review','approved','supplier_selected','ordered','partially_received','received','returned','rejected'] then raise exception 'demo state coverage incomplete: %',states; end if;
  if not exists(select 1 from procurement.purchase_orders where order_number='PO-2026-000042' and status='partially_received') then raise exception 'demo story PO missing'; end if;
  if not exists(select 1 from procurement.goods_receipts where receipt_number='GR-2026-000087' and status='partial') then raise exception 'demo story receipt missing'; end if;
  if (select coalesce(sum(gri.quantity_received),0) from procurement.goods_receipt_items gri where gri.purchase_order_item_id='d5100000-0000-4000-8000-000000000081')<>80 then raise exception 'demo cement progress incorrect'; end if;
  if not exists(select 1 from notifications.items where company_id='d0000000-0000-4000-8000-000000000001') then raise exception 'demo notifications missing'; end if;

  select public,file_size_limit into bucket_public,bucket_limit from storage.buckets where id='atlas-documents';
  if bucket_public is distinct from false or bucket_limit<>10485760 then raise exception 'document bucket is not private/limited'; end if;

  select position('::procurement.purchase_request_status' in pg_get_functiondef(p.oid))>0 into warning_fixed
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='platform' and p.proname='record_goods_receipt' and pg_get_function_identity_arguments(p.oid)='p_purchase_order_id uuid, p_expected_version integer, p_notes text, p_items jsonb';
  if not warning_fixed then raise exception 'record_goods_receipt enum cast fix missing'; end if;

  if has_function_privilege('authenticated','public.seed_atlas_demo_data()','EXECUTE') then raise exception 'authenticated can reset demo'; end if;
  if has_function_privilege('anon','public.seed_atlas_demo_data()','EXECUTE') then raise exception 'anon can reset demo'; end if;
  if not has_function_privilege('service_role','public.seed_atlas_demo_data()','EXECUTE') then raise exception 'service_role cannot reset demo'; end if;
end$$;

set local role authenticated;
select set_config('request.jwt.claim.sub','a6000000-0000-4000-8000-000000000007',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"a6000000-0000-4000-8000-000000000007","role":"authenticated"}',true);

do $$
declare prepared record;begin
  if not ('Procurement.PurchaseOrderIssue'=any(public.get_procurement_permissions())) then raise exception 'procurement officer lost PO permission'; end if;
  select * into prepared from public.prepare_document_upload('quotation','d4000000-0000-4000-8000-000000000081','../unsafe-name.pdf','application/pdf',2048);
  if prepared.storage_path not like 'd0000000-0000-4000-8000-000000000001/%' then raise exception 'storage path not tenant-scoped'; end if;
  if prepared.storage_path like '%unsafe-name%' then raise exception 'browser filename used as storage path'; end if;
  perform public.finalize_document_upload(prepared.document_id);
  if not exists(select 1 from public.list_resource_documents('quotation','d4000000-0000-4000-8000-000000000081') d where d.id=prepared.document_id) then raise exception 'finalized document not readable'; end if;
end$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','a6000000-0000-4000-8000-000000000008',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"a6000000-0000-4000-8000-000000000008","role":"authenticated"}',true);

do $$begin
  if not ('Procurement.GoodsReceiptCreate'=any(public.get_procurement_permissions())) then raise exception 'warehouse cannot create goods receipt'; end if;
  if 'Procurement.SupplierManage'=any(public.get_procurement_permissions()) then raise exception 'warehouse received supplier management permission'; end if;
end$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','a6000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"a6000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

do $$declare member_count integer; audit_count integer;begin
  select count(*) into member_count from public.list_company_members();
  if member_count<>8 then raise exception 'admin member list incomplete: %',member_count; end if;
  select count(*) into audit_count from public.list_company_audit(200);
  if audit_count<20 then raise exception 'demo audit trail too small: %',audit_count; end if;
end$$;

reset role;
rollback;
