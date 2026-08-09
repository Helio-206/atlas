\set ON_ERROR_STOP on
begin;

do $$declare bad_functions text;begin
  select string_agg(n.nspname||'.'||p.proname,', ' order by n.nspname,p.proname) into bad_functions
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('platform','documents','notifications') and p.prosecdef
    and not exists(select 1 from unnest(coalesce(p.proconfig,array[]::text[])) setting where setting like 'search_path=%');
  if bad_functions is not null then raise exception 'SECURITY DEFINER functions without explicit search_path: %',bad_functions; end if;

  if has_table_privilege('authenticated','documents.files','INSERT') or has_table_privilege('authenticated','documents.files','UPDATE') or has_table_privilege('authenticated','documents.files','DELETE') then
    raise exception 'authenticated has direct document metadata writes';
  end if;
  if has_table_privilege('authenticated','notifications.items','INSERT') or has_table_privilege('authenticated','notifications.items','UPDATE') or has_table_privilege('authenticated','notifications.items','DELETE') then
    raise exception 'authenticated has direct notification writes';
  end if;
  if has_function_privilege('authenticated','public.seed_atlas_demo_data()','EXECUTE') then raise exception 'demo reset exposed to authenticated'; end if;
  if has_function_privilege('anon','public.prepare_document_upload(text,uuid,text,text,bigint)','EXECUTE') then raise exception 'anonymous can prepare document uploads'; end if;
  if has_function_privilege('anon','public.mark_notification_read(uuid)','EXECUTE') then raise exception 'anonymous can mutate notifications'; end if;
end$$;

rollback;
