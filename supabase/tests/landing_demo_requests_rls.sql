\set ON_ERROR_STOP on
begin;

do $$declare rls_enabled boolean; policy_count integer;begin
  select c.relrowsecurity into rls_enabled
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='demo_requests';
  if rls_enabled is distinct from true then raise exception 'demo_requests RLS is disabled'; end if;

  select count(*) into policy_count from pg_policies where schemaname='public' and tablename='demo_requests';
  if policy_count<>0 then raise exception 'demo_requests must remain closed without client table policies'; end if;

  if has_table_privilege('anon','public.demo_requests','SELECT,INSERT,UPDATE,DELETE') then raise exception 'anon has table privileges'; end if;
  if has_table_privilege('authenticated','public.demo_requests','SELECT,INSERT,UPDATE,DELETE') then raise exception 'authenticated has table privileges'; end if;
  if not has_table_privilege('service_role','public.demo_requests','SELECT') then raise exception 'service role cannot review demo requests'; end if;
end$$;

set local role anon;
select public.submit_demo_request('RLS Visitor','RLS Company','rls@example.com','+244 923 111 222','Gestora',null);

do $$begin
  begin
    perform count(*) from public.demo_requests;
    raise exception 'anon read demo requests';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.demo_requests(name,company,email,phone,role) values('Direct Insert','RLS Company','direct@example.com','+244 923 111 222','Gestora');
    raise exception 'anon inserted directly';
  exception when insufficient_privilege then null; end;
end$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','b6000000-0000-4000-8000-000000000099',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"b6000000-0000-4000-8000-000000000099","role":"authenticated"}',true);
do $$begin
  begin
    perform count(*) from public.demo_requests;
    raise exception 'authenticated read demo requests';
  exception when insufficient_privilege then null; end;
end$$;
reset role;

set local role service_role;
do $$declare c integer;begin
  select count(*) into c from public.demo_requests where email='rls@example.com';
  if c<>1 then raise exception 'service role cannot review submitted request'; end if;
end$$;

rollback;
