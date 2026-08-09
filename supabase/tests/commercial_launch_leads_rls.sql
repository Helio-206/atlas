\set ON_ERROR_STOP on
begin;

do $$declare rls_enabled boolean;begin
  select c.relrowsecurity into rls_enabled
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='demo_requests';
  if rls_enabled is distinct from true then raise exception 'demo_requests RLS is disabled'; end if;
  if not (select relrowsecurity from pg_class where oid='platform.staff_users'::regclass) then raise exception 'platform staff RLS is disabled'; end if;
  if not (select relrowsecurity from pg_class where oid='platform.demo_request_events'::regclass) then raise exception 'demo request events RLS is disabled'; end if;
  if has_table_privilege('anon','public.demo_requests','SELECT,INSERT,UPDATE,DELETE') then raise exception 'anon has direct lead table privileges'; end if;
  if has_table_privilege('authenticated','public.demo_requests','SELECT,INSERT,UPDATE,DELETE') then raise exception 'authenticated has direct lead table privileges'; end if;
  if has_table_privilege('authenticated','platform.staff_users','SELECT,INSERT,UPDATE,DELETE') then raise exception 'authenticated has platform staff table privileges'; end if;
  if has_table_privilege('authenticated','platform.demo_request_events','SELECT,INSERT,UPDATE,DELETE') then raise exception 'authenticated has lead history table privileges'; end if;
  if has_function_privilege('anon','public.can_manage_demo_requests()','EXECUTE') then raise exception 'anon can inspect commercial capability'; end if;
  if has_function_privilege('anon','public.list_demo_requests(integer)','EXECUTE') then raise exception 'anon can execute lead listing RPC'; end if;
  if has_function_privilege('anon','public.get_demo_request_metrics()','EXECUTE') then raise exception 'anon can execute commercial metrics RPC'; end if;
  if has_function_privilege('anon','public.update_demo_request(uuid,integer,text,text,boolean)','EXECUTE') then raise exception 'anon can execute lead update RPC'; end if;
  if has_function_privilege('authenticated','public.configure_commercial_admin(text)','EXECUTE') then raise exception 'authenticated can provision commercial administrators'; end if;
  if not has_function_privilege('service_role','public.configure_commercial_admin(text)','EXECUTE') then raise exception 'service role cannot provision commercial administrators'; end if;
end$$;

set local role anon;
do $$begin
  begin
    perform count(*) from public.demo_requests;
    raise exception 'anonymous read demo requests';
  exception when insufficient_privilege then null; end;
end$$;
reset role;

rollback;
