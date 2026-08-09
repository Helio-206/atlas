\set ON_ERROR_STOP on
begin;

do $$begin
  if to_regclass('public.demo_requests') is null then raise exception 'demo_requests table missing'; end if;
  if to_regprocedure('public.submit_demo_request(text,text,text,text,text,text)') is null then raise exception 'submit_demo_request RPC missing'; end if;
  if not has_function_privilege('anon','public.submit_demo_request(text,text,text,text,text,text)','EXECUTE') then raise exception 'anon cannot submit demo request'; end if;
  if has_table_privilege('anon','public.demo_requests','INSERT') then raise exception 'anon has direct insert privilege'; end if;
  if has_table_privilege('authenticated','public.demo_requests','SELECT') then raise exception 'authenticated can read leads'; end if;
end$$;

set local role anon;
select public.submit_demo_request(
  '  Helena Manuel  ',
  '  Construtora Horizonte, Lda. ',
  ' HELENA@EXAMPLE.COM ',
  '+244 923 000 000',
  'Diretora Financeira',
  'Quero conhecer o fluxo de Procurement.'
);
reset role;

set local role service_role;
do $$declare request record;begin
  select * into request from public.demo_requests where email='helena@example.com';
  if request.id is null then raise exception 'demo request was not persisted'; end if;
  if request.name<>'Helena Manuel' then raise exception 'name was not normalized'; end if;
  if request.company<>'Construtora Horizonte, Lda.' then raise exception 'company was not normalized'; end if;
  if request.email<>'helena@example.com' then raise exception 'email was not normalized'; end if;
  if request.status<>'new' or request.source<>'landing' then raise exception 'server controlled fields are incorrect'; end if;
end$$;
reset role;

set local role anon;
do $$begin
  begin
    perform public.submit_demo_request('H','Empresa válida','not-an-email','invalid','D','');
    raise exception 'invalid request was accepted';
  exception when sqlstate '22023' then null; end;

  perform public.submit_demo_request('Helena Manuel','Empresa válida','limit@example.com','+244 923 000 001','Diretora','');
  perform public.submit_demo_request('Helena Manuel','Empresa válida','limit@example.com','+244 923 000 001','Diretora','');
  perform public.submit_demo_request('Helena Manuel','Empresa válida','limit@example.com','+244 923 000 001','Diretora','');
  begin
    perform public.submit_demo_request('Helena Manuel','Empresa válida','limit@example.com','+244 923 000 001','Diretora','');
    raise exception 'rate limit was not enforced';
  exception when sqlstate 'P0001' then null; end;
end$$;

rollback;
