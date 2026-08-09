\set ON_ERROR_STOP on
begin;

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token) values
('00000000-0000-0000-0000-000000000000','c8000000-0000-4000-8000-000000000001','authenticated','authenticated','lead-admin-a@example.invalid','',now(),'{}','{"full_name":"Lead Admin A"}',now(),now(),'','','',''),
('00000000-0000-0000-0000-000000000000','c8000000-0000-4000-8000-000000000002','authenticated','authenticated','lead-admin-b@example.invalid','',now(),'{}','{"full_name":"Lead Admin B"}',now(),now(),'','','','');
insert into identity.companies(id,name,created_by) values
('c8100000-0000-4000-8000-000000000001','Lead Company A','c8000000-0000-4000-8000-000000000001'),
('c8100000-0000-4000-8000-000000000002','Lead Company B','c8000000-0000-4000-8000-000000000002');
insert into identity.memberships(company_id,user_id,role,status) values
('c8100000-0000-4000-8000-000000000001','c8000000-0000-4000-8000-000000000001','administrator','active'),
('c8100000-0000-4000-8000-000000000002','c8000000-0000-4000-8000-000000000002','administrator','active');

set local role service_role;
select public.configure_commercial_admin('lead-admin-a@example.invalid');
reset role;

set local role anon;
select public.submit_demo_request('Lead One','Prospect One','lead-one@example.com','+244 923 111 001','Diretor','Processo atual em Excel.');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','c8000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"c8000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$declare request record; new_version integer; conflict_detected boolean := false;begin
  if not public.can_manage_demo_requests() then raise exception 'commercial administrator capability missing'; end if;
  select * into request from public.list_demo_requests(10) where email='lead-one@example.com';
  if request.id is null then raise exception 'commercial administrator cannot list demo requests'; end if;
  new_version := public.update_demo_request(request.id, request.version, 'qualified', 'Prioridade alta; validar fluxo de aprovações.');
  if new_version<>request.version+1 then raise exception 'demo request version did not advance'; end if;
  if not exists(select 1 from public.list_demo_requests(10) where id=request.id and status='qualified' and internal_notes='Prioridade alta; validar fluxo de aprovações.' and version=new_version) then raise exception 'commercial administrator update was not persisted'; end if;
  begin
    perform public.update_demo_request(request.id, request.version, 'won', null);
  exception when sqlstate 'P0001' then
    conflict_detected := true;
  end;
  if not conflict_detected then raise exception 'stale demo request update was accepted'; end if;
  new_version := public.update_demo_request(request.id, new_version, 'won', 'Piloto iniciado.', true);
  if not exists(select 1 from public.list_demo_requests(10) where id=request.id and status='won' and pilot_active and version=new_version) then raise exception 'active pilot was not persisted'; end if;
  if not exists(select 1 from public.get_demo_request_metrics() where pilots_active=1 and won=1) then raise exception 'commercial metrics are incorrect'; end if;
  begin
    perform public.update_demo_request(request.id, new_version, 'contacted', null, true);
    raise exception 'active pilot accepted for non-won lead';
  exception when sqlstate '22023' then null; end;
end$$;
reset role;

do $$begin
  if not exists(
    select 1 from platform.demo_request_events event
    join public.demo_requests request on request.id=event.demo_request_id
    where request.email='lead-one@example.com' and event.from_status='new' and event.to_status='qualified'
      and event.notes_changed and not event.pilot_active_from and not event.pilot_active_to and event.version=2
  ) then raise exception 'demo request history event missing'; end if;
end$$;

set local role authenticated;
select set_config('request.jwt.claim.sub','c8000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"c8000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$begin
  if public.can_manage_demo_requests() then raise exception 'tenant administrator received commercial capability'; end if;
  begin
    perform count(*) from public.list_demo_requests(10);
    raise exception 'tenant administrator listed global demo requests';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.get_demo_request_metrics();
    raise exception 'tenant administrator listed commercial metrics';
  exception when insufficient_privilege then null; end;
end$$;
reset role;

rollback;
