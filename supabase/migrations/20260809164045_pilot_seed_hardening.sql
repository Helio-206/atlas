alter function platform.seed_atlas_demo_data() rename to seed_atlas_demo_data_impl;

revoke all on function platform.seed_atlas_demo_data_impl() from public, anon, authenticated;
revoke all on function platform.seed_atlas_demo_data_impl() from service_role;

create or replace function platform.seed_atlas_demo_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_demo_company constant uuid := 'd0000000-0000-4000-8000-000000000001';
  v_admin uuid;
begin
  select u.id
  into v_admin
  from auth.users as u
  where u.email = 'admin@atlas.demo'
  limit 1;

  if v_admin is null then
    raise exception using errcode = 'P0001', message = 'demo_users_required';
  end if;

  -- On the first reset, create the stable demo company before the implementation
  -- runs. This deliberately absorbs the normal company-created approval-settings
  -- trigger. The implementation then clears that default row and installs the
  -- reproducible demo threshold without racing the trigger.
  insert into identity.companies (
    id,
    name,
    tax_number,
    created_by,
    created_at,
    updated_at
  ) values (
    v_demo_company,
    'Construtora Horizonte, Lda.',
    '5410000000',
    v_admin,
    now() - interval '60 days',
    now()
  )
  on conflict (id) do nothing;

  perform platform.seed_atlas_demo_data_impl();
end;
$$;

revoke all on function platform.seed_atlas_demo_data() from public, anon, authenticated;
grant execute on function platform.seed_atlas_demo_data() to service_role;

create or replace function public.seed_atlas_demo_data()
returns void
language sql
security invoker
set search_path = ''
as $$
  select platform.seed_atlas_demo_data();
$$;

revoke all on function public.seed_atlas_demo_data() from public, anon, authenticated;
grant execute on function public.seed_atlas_demo_data() to service_role;
