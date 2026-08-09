alter table public.demo_requests
  drop constraint if exists demo_requests_status_check;

update public.demo_requests
set status = 'lost'
where status = 'closed';

alter table public.demo_requests
  add column if not exists internal_notes text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists version integer not null default 1,
  add column if not exists pilot_active boolean not null default false;

alter table public.demo_requests
  add constraint demo_requests_status_check
  check (status in ('new','contacted','qualified','demo_scheduled','pilot_proposed','won','lost')),
  add constraint demo_requests_internal_notes_check
  check (internal_notes is null or char_length(internal_notes) <= 4000),
  add constraint demo_requests_version_check
  check (version > 0),
  add constraint demo_requests_active_pilot_check
  check (not pilot_active or status = 'won');

create index if not exists demo_requests_status_created_at_idx
  on public.demo_requests(status, created_at desc);

create table platform.staff_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_staff_users_role_check check (role in ('commercial_admin')),
  constraint platform_staff_users_status_check check (status in ('active','suspended'))
);

create table platform.demo_request_events (
  id uuid primary key default gen_random_uuid(),
  demo_request_id uuid not null references public.demo_requests(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id),
  from_status text not null,
  to_status text not null,
  notes_changed boolean not null,
  pilot_active_from boolean not null,
  pilot_active_to boolean not null,
  version integer not null,
  created_at timestamptz not null default now(),
  constraint demo_request_events_from_status_check check (from_status in ('new','contacted','qualified','demo_scheduled','pilot_proposed','won','lost')),
  constraint demo_request_events_to_status_check check (to_status in ('new','contacted','qualified','demo_scheduled','pilot_proposed','won','lost')),
  constraint demo_request_events_version_check check (version > 1)
);

create index demo_request_events_request_created_idx
  on platform.demo_request_events(demo_request_id, created_at desc);

alter table platform.staff_users enable row level security;
alter table platform.demo_request_events enable row level security;
revoke all on table platform.staff_users, platform.demo_request_events from public, anon, authenticated;

create or replace function platform.can_manage_demo_requests()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from platform.staff_users staff
    where staff.user_id = auth.uid()
      and staff.role = 'commercial_admin'
      and staff.status = 'active'
  );
$$;

create or replace function platform.require_demo_request_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if not platform.can_manage_demo_requests() then
    raise exception using errcode = '42501', message = 'commercial_administrator_required';
  end if;
end;
$$;

create or replace function platform.configure_commercial_admin(p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  select user_record.id into v_user_id
  from auth.users user_record
  where lower(user_record.email) = lower(btrim(coalesce(p_email, '')));
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'commercial_admin_user_not_found';
  end if;

  insert into platform.staff_users(user_id, role, status)
  values(v_user_id, 'commercial_admin', 'active')
  on conflict(user_id) do update set
    role = excluded.role,
    status = excluded.status,
    updated_at = now();
  return v_user_id;
end;
$$;

create or replace function platform.list_demo_requests(p_limit integer default 100)
returns table(
  id uuid,
  name text,
  company text,
  role text,
  email text,
  phone text,
  message text,
  status text,
  internal_notes text,
  pilot_active boolean,
  version integer,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform platform.require_demo_request_admin();
  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception using errcode = '22023', message = 'demo_request_limit_invalid';
  end if;

  return query
  select request.id, request.name, request.company, request.role, request.email,
    request.phone, request.message, request.status, request.internal_notes, request.pilot_active,
    request.version, request.created_at, request.updated_at
  from public.demo_requests request
  order by request.created_at desc, request.id desc
  limit p_limit;
end;
$$;

create or replace function platform.get_demo_request_metrics()
returns table(
  new_leads bigint,
  demos_scheduled bigint,
  pilots_proposed bigint,
  pilots_active bigint,
  won bigint,
  lost bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform platform.require_demo_request_admin();
  return query
  select
    count(*) filter(where request.status = 'new'),
    count(*) filter(where request.status = 'demo_scheduled'),
    count(*) filter(where request.status = 'pilot_proposed'),
    count(*) filter(where request.pilot_active),
    count(*) filter(where request.status = 'won'),
    count(*) filter(where request.status = 'lost')
  from public.demo_requests request;
end;
$$;

create or replace function platform.update_demo_request(
  p_id uuid,
  p_expected_version integer,
  p_status text,
  p_internal_notes text default null,
  p_pilot_active boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new_version integer;
  v_previous_status text;
  v_previous_notes text;
  v_previous_pilot_active boolean;
  v_notes text := nullif(btrim(coalesce(p_internal_notes, '')), '');
begin
  perform platform.require_demo_request_admin();
  if p_status not in ('new','contacted','qualified','demo_scheduled','pilot_proposed','won','lost') then
    raise exception using errcode = '22023', message = 'demo_request_status_invalid';
  end if;
  if v_notes is not null and char_length(v_notes) > 4000 then
    raise exception using errcode = '22023', message = 'demo_request_notes_invalid';
  end if;
  if coalesce(p_pilot_active, false) and p_status <> 'won' then
    raise exception using errcode = '22023', message = 'active_pilot_requires_won_lead';
  end if;

  select request.status, request.internal_notes, request.pilot_active
  into v_previous_status, v_previous_notes, v_previous_pilot_active
  from public.demo_requests request
  where request.id = p_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'demo_request_not_found';
  end if;

  update public.demo_requests request
  set status = p_status,
      internal_notes = v_notes,
      pilot_active = coalesce(p_pilot_active, false),
      updated_at = clock_timestamp(),
      version = request.version + 1
  where request.id = p_id
    and request.version = p_expected_version
  returning request.version into v_new_version;

  if v_new_version is null then
    raise exception using errcode = 'P0001', message = 'demo_request_conflict';
  end if;

  insert into platform.demo_request_events(
    demo_request_id, actor_user_id, from_status, to_status, notes_changed,
    pilot_active_from, pilot_active_to, version
  ) values(
    p_id, auth.uid(), v_previous_status, p_status,
    v_previous_notes is distinct from v_notes, v_previous_pilot_active,
    coalesce(p_pilot_active, false), v_new_version
  );

  return v_new_version;
end;
$$;

revoke all on function platform.can_manage_demo_requests(), platform.require_demo_request_admin() from public, anon, authenticated;
revoke all on function platform.configure_commercial_admin(text) from public, anon, authenticated;
revoke all on function platform.list_demo_requests(integer) from public, anon;
revoke all on function platform.get_demo_request_metrics() from public, anon;
revoke all on function platform.update_demo_request(uuid, integer, text, text, boolean) from public, anon;
grant execute on function platform.can_manage_demo_requests(), platform.list_demo_requests(integer), platform.get_demo_request_metrics(), platform.update_demo_request(uuid, integer, text, text, boolean) to authenticated;
grant execute on function platform.configure_commercial_admin(text) to service_role;

create or replace function public.can_manage_demo_requests()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ select platform.can_manage_demo_requests(); $$;

create or replace function public.configure_commercial_admin(p_email text)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select platform.configure_commercial_admin($1); $$;

create or replace function public.list_demo_requests(p_limit integer default 100)
returns table(
  id uuid,
  name text,
  company text,
  role text,
  email text,
  phone text,
  message text,
  status text,
  internal_notes text,
  pilot_active boolean,
  version integer,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$ select * from platform.list_demo_requests($1); $$;

create or replace function public.get_demo_request_metrics()
returns table(
  new_leads bigint,
  demos_scheduled bigint,
  pilots_proposed bigint,
  pilots_active bigint,
  won bigint,
  lost bigint
)
language sql
stable
security invoker
set search_path = ''
as $$ select * from platform.get_demo_request_metrics(); $$;

create or replace function public.update_demo_request(
  p_id uuid,
  p_expected_version integer,
  p_status text,
  p_internal_notes text default null,
  p_pilot_active boolean default false
)
returns integer
language sql
security invoker
set search_path = ''
as $$ select platform.update_demo_request($1, $2, $3, $4, $5); $$;

revoke all on function public.can_manage_demo_requests(), public.configure_commercial_admin(text), public.list_demo_requests(integer), public.get_demo_request_metrics(), public.update_demo_request(uuid, integer, text, text, boolean) from public, anon;
grant execute on function public.can_manage_demo_requests(), public.list_demo_requests(integer), public.get_demo_request_metrics(), public.update_demo_request(uuid, integer, text, text, boolean) to authenticated;
grant execute on function public.configure_commercial_admin(text) to service_role;
