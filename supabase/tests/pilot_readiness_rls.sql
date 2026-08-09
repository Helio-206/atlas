\set ON_ERROR_STOP on
begin;

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token) values
('00000000-0000-0000-0000-000000000000','b6000000-0000-4000-8000-000000000001','authenticated','authenticated','pilot-a@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{"full_name":"Pilot A"}',now(),now(),'','','',''),
('00000000-0000-0000-0000-000000000000','b6000000-0000-4000-8000-000000000002','authenticated','authenticated','pilot-b@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{"full_name":"Pilot B"}',now(),now(),'','','','');
insert into identity.companies(id,name,created_by) values
('b6100000-0000-4000-8000-000000000001','Company A','b6000000-0000-4000-8000-000000000001'),
('b6100000-0000-4000-8000-000000000002','Company B','b6000000-0000-4000-8000-000000000002');
insert into identity.memberships(company_id,user_id,role,status) values
('b6100000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001','requester','active'),
('b6100000-0000-4000-8000-000000000002','b6000000-0000-4000-8000-000000000002','requester','active');
insert into projects.projects(id,company_id,code,name,status,created_by) values
('b6200000-0000-4000-8000-000000000001','b6100000-0000-4000-8000-000000000001','PA','Project A','active','b6000000-0000-4000-8000-000000000001'),
('b6200000-0000-4000-8000-000000000002','b6100000-0000-4000-8000-000000000002','PB','Project B','active','b6000000-0000-4000-8000-000000000002');
insert into procurement.purchase_requests(id,company_id,project_id,request_number,requested_by,purpose,priority,required_date,status,currency) values
('b6300000-0000-4000-8000-000000000001','b6100000-0000-4000-8000-000000000001','b6200000-0000-4000-8000-000000000001','RLS-A','b6000000-0000-4000-8000-000000000001','RLS sourcing A','normal','2026-10-01','approved','AOA'),
('b6300000-0000-4000-8000-000000000002','b6100000-0000-4000-8000-000000000002','b6200000-0000-4000-8000-000000000002','RLS-B','b6000000-0000-4000-8000-000000000002','RLS sourcing B','normal','2026-10-01','approved','AOA');
insert into procurement.suppliers(id,company_id,name,status,created_by) values
('b6400000-0000-4000-8000-000000000001','b6100000-0000-4000-8000-000000000001','Supplier A','active','b6000000-0000-4000-8000-000000000001'),
('b6400000-0000-4000-8000-000000000002','b6100000-0000-4000-8000-000000000002','Supplier B','active','b6000000-0000-4000-8000-000000000002');
insert into procurement.quotations(id,company_id,purchase_request_id,supplier_id,currency,status,created_by) values
('b6500000-0000-4000-8000-000000000001','b6100000-0000-4000-8000-000000000001','b6300000-0000-4000-8000-000000000001','b6400000-0000-4000-8000-000000000001','AOA','submitted','b6000000-0000-4000-8000-000000000001'),
('b6500000-0000-4000-8000-000000000002','b6100000-0000-4000-8000-000000000002','b6300000-0000-4000-8000-000000000002','b6400000-0000-4000-8000-000000000002','AOA','submitted','b6000000-0000-4000-8000-000000000002');
insert into documents.files(id,company_id,project_id,resource_type,resource_id,storage_path,original_name,mime_type,size_bytes,uploaded_by,status) values
('b6600000-0000-4000-8000-000000000001','b6100000-0000-4000-8000-000000000001','b6200000-0000-4000-8000-000000000001','quotation','b6500000-0000-4000-8000-000000000001','b6100000-0000-4000-8000-000000000001/a.pdf','A.pdf','application/pdf',100,'b6000000-0000-4000-8000-000000000001','ready'),
('b6600000-0000-4000-8000-000000000002','b6100000-0000-4000-8000-000000000002','b6200000-0000-4000-8000-000000000002','quotation','b6500000-0000-4000-8000-000000000002','b6100000-0000-4000-8000-000000000002/b.pdf','B.pdf','application/pdf',100,'b6000000-0000-4000-8000-000000000002','ready');
insert into notifications.items(id,company_id,user_id,event_type,title) values
('b6700000-0000-4000-8000-000000000001','b6100000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001','Test','A notification'),
('b6700000-0000-4000-8000-000000000002','b6100000-0000-4000-8000-000000000002','b6000000-0000-4000-8000-000000000002','Test','B notification');

set local role authenticated;
select set_config('request.jwt.claim.sub','b6000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"b6000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

do $$declare c integer;begin
  select count(*) into c from documents.files; if c<>1 then raise exception 'documents RLS leaked rows: %',c; end if;
  select count(*) into c from notifications.items; if c<>1 then raise exception 'notifications RLS leaked rows: %',c; end if;
  if not platform.can_access_document_object('b6100000-0000-4000-8000-000000000001/a.pdf','read') then raise exception 'own document object denied'; end if;
  if platform.can_access_document_object('b6100000-0000-4000-8000-000000000002/b.pdf','read') then raise exception 'cross-tenant document object allowed'; end if;
  begin
    perform public.get_document_download('b6600000-0000-4000-8000-000000000002');
    raise exception 'cross-tenant download authorization unexpectedly succeeded';
  exception when sqlstate '42501' then null; end;
end$$;

reset role;
do $$begin
  if has_table_privilege('anon','documents.files','SELECT') then raise exception 'anon can select documents'; end if;
  if has_table_privilege('anon','notifications.items','SELECT') then raise exception 'anon can select notifications'; end if;
  if has_function_privilege('anon','public.get_document_download(uuid)','EXECUTE') then raise exception 'anon can request document download'; end if;
  if has_function_privilege('anon','public.list_notifications(integer)','EXECUTE') then raise exception 'anon can list notifications'; end if;
end$$;

rollback;
