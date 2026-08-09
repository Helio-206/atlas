\set ON_ERROR_STOP on
begin;

do $$declare rls_enabled boolean;begin
  select c.relrowsecurity into rls_enabled
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='demo_requests';
  if rls_enabled is distinct from true then raise exception 'demo_requests RLS is disabled'; end if;
  if has_table_privilege('anon','public.demo_requests','SELECT,INSERT,UPDATE,DELETE') then raise exception 'anon has direct lead table privileges'; end if;
  if has_table_privilege('authenticated','public.demo_requests','SELECT,INSERT,UPDATE,DELETE') then raise exception 'authenticated has direct lead table privileges'; end if;
  if has_function_privilege('anon','public.list_demo_requests(integer)','EXECUTE') then raise exception 'anon can execute lead listing RPC'; end if;
  if has_function_privilege('anon','public.update_demo_request(uuid,timestamptz,text,text)','EXECUTE') then raise exception 'anon can execute lead update RPC'; end if;
  if not has_function_privilege('authenticated','public.list_demo_requests(integer)','EXECUTE') then raise exception 'authenticated cannot execute lead listing RPC'; end if;
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
