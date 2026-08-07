alter table identity.companies
  alter column tax_number drop not null;

create or replace function identity.create_company(
  company_name text,
  company_tax_number text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_company_name text := btrim(company_name);
  v_company_tax_number text := nullif(btrim(company_tax_number), '');
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authentication_required';
  end if;

  if v_company_name is null
    or char_length(v_company_name) < 2
    or char_length(v_company_name) > 160 then
    raise exception using
      errcode = '22023',
      message = 'invalid_company_name';
  end if;

  if v_company_tax_number is not null
    and char_length(v_company_tax_number) > 64 then
    raise exception using
      errcode = '22023',
      message = 'invalid_company_tax_number';
  end if;

  -- Serialise onboarding attempts per user. This prevents double submits or
  -- concurrent requests from creating more than one initial company.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  if exists (
    select 1
    from identity.memberships as membership
    where membership.user_id = v_user_id
      and membership.status = 'active'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'active_membership_exists';
  end if;

  insert into identity.companies (
    name,
    tax_number,
    created_by
  ) values (
    v_company_name,
    v_company_tax_number,
    v_user_id
  )
  returning id into v_company_id;

  insert into identity.memberships (
    company_id,
    user_id,
    role,
    status
  ) values (
    v_company_id,
    v_user_id,
    'administrator',
    'active'
  );

  insert into audit.entries (
    company_id,
    user_id,
    action,
    module,
    resource_type,
    resource_id,
    metadata
  ) values (
    v_company_id,
    v_user_id,
    'company.created',
    'identity',
    'company',
    v_company_id,
    jsonb_build_object(
      'membership_role', 'administrator',
      'source', 'company_onboarding'
    )
  );

  return v_company_id;
end;
$$;

revoke all on function identity.create_company(text, text) from public;
revoke all on function identity.create_company(text, text) from anon;
grant execute on function identity.create_company(text, text) to authenticated;
