\set ON_ERROR_STOP on
begin;

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token) values
('00000000-0000-0000-0000-000000000000','c8000000-0000-4000-8000-000000000001','authenticated','authenticated','lead-admin@example.invalid','',now(),'{}','{"full_name":"Lead Admin"}',now(),now(),'','','',''),
('00000000-0000-0000-0000-000000000002','c8000000-0000-4000-8000-000000000002','authenticated','authenticated','lead-user@example.invalid','',now(),'{}','{"full_name":"Lead User"}',now(),now(),'','','','');
insert into identity.companies(id,name,created_by) values('c8100000-0000-4000-8000-000000000001','Lead Admin Company','c8000000-0000-4000-8000-000000000001');
insert into identity.memberships(company_id,user_id,role,status) values
('c8100000-0000-4000-8000-000000000001','c8000000-0000-4000-8000-000000000001','administrator','active'),
('c8100000-0000-4000-8000-000000000001','c8000000-0000-4000-8000-000000000002','requester','active');

set local role anon;
select public.submit_demo_request('Lead One','Prospect One','lead-one@example.com','+244 923 111 001','Diretor','Processo atual em Excel.');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','c8000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"c8000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$declare request record; updated timestamptz;begin
  select * into request from public.list_demo_requests(10) where email='lead-one@example.com';
  if request.id is null then raise exception 'administrator cannot list demo requests'; end if;
  updated := public.update_demo_request(request.id, request.updated_at, 'qualified', 'Prioridade alta; validar fluxo de aprovações.');
  if not exists(select 1 from public.list_demo_requests(10) where id=request.id and status='qualified' and internal_notes='Prioridade alta; validar fluxo de aprovações.') then raise exception 'administrator update was not persisted'; end if;
  begin
    perform public.update_demo_request(request.id, request.updated_at, 'won', null);
    raise exception 'stale demo request update was accepted';
  exception when sqlstate 'P0001' then null; end;
end$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','c8000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"c8000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$begin
  begin
    perform count(*) from public.list_demo_requests(10);
    raise exception 'non-administrator listed demo requests';
  exception when insufficient_privilege then null; end;
end$$;
reset role;

rollback;
