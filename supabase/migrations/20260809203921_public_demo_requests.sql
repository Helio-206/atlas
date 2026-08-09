create table public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text not null,
  email text not null,
  phone text not null,
  role text not null,
  message text,
  created_at timestamptz not null default now(),
  status text not null default 'new',
  source text not null default 'landing',
  constraint demo_requests_name_check check (char_length(btrim(name)) between 2 and 120),
  constraint demo_requests_company_check check (char_length(btrim(company)) between 2 and 160),
  constraint demo_requests_email_check check (char_length(btrim(email)) between 5 and 254),
  constraint demo_requests_phone_check check (char_length(btrim(phone)) between 7 and 40),
  constraint demo_requests_role_check check (char_length(btrim(role)) between 2 and 100),
  constraint demo_requests_message_check check (message is null or char_length(message) <= 2000),
  constraint demo_requests_status_check check (status in ('new','contacted','closed')),
  constraint demo_requests_source_check check (source in ('landing'))
);

create index demo_requests_created_at_idx on public.demo_requests(created_at desc);
create index demo_requests_email_created_at_idx on public.demo_requests(lower(email),created_at desc);

alter table public.demo_requests enable row level security;

revoke all on table public.demo_requests from public,anon,authenticated;
grant select,update on table public.demo_requests to service_role;

create or replace function public.submit_demo_request(
  p_name text,
  p_company text,
  p_email text,
  p_phone text,
  p_role text,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;
  v_name text:=btrim(coalesce(p_name,''));
  v_company text:=btrim(coalesce(p_company,''));
  v_email text:=lower(btrim(coalesce(p_email,'')));
  v_phone text:=btrim(coalesce(p_phone,''));
  v_role text:=btrim(coalesce(p_role,''));
  v_message text:=nullif(btrim(coalesce(p_message,'')),'');
begin
  if char_length(v_name) not between 2 and 120
    or char_length(v_company) not between 2 and 160
    or char_length(v_email) not between 5 and 254
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or char_length(v_phone) not between 7 and 40
    or v_phone !~ '^[+0-9().[:space:]-]+$'
    or char_length(v_role) not between 2 and 100
    or (v_message is not null and char_length(v_message)>2000)
  then
    raise exception using errcode='22023',message='invalid_demo_request';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_email,0));
  if (
    select count(*) from public.demo_requests request
    where lower(request.email)=v_email
      and request.created_at>now()-interval '1 hour'
  )>=3 then
    raise exception using errcode='P0001',message='demo_request_rate_limited';
  end if;

  insert into public.demo_requests(name,company,email,phone,role,message,status,source)
  values(v_name,v_company,v_email,v_phone,v_role,v_message,'new','landing')
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.submit_demo_request(text,text,text,text,text,text) from public;
grant execute on function public.submit_demo_request(text,text,text,text,text,text) to anon,authenticated,service_role;
