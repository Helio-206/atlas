create schema if not exists procurement;

create type procurement.purchase_request_status as enum (
  'draft',
  'submitted',
  'technical_review',
  'financial_review',
  'executive_review',
  'approved',
  'returned',
  'rejected',
  'cancelled'
);

alter table projects.projects
  add constraint projects_id_company_unique unique (id, company_id);

create table procurement.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references identity.companies(id),
  project_id uuid not null,
  request_number text not null,
  requested_by uuid not null references auth.users(id),
  purpose text not null,
  priority text not null default 'normal',
  required_date date not null,
  status procurement.purchase_request_status not null default 'draft',
  estimated_total numeric(18, 2) not null default 0,
  currency text not null,
  current_approver_role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  approved_at timestamptz,
  version integer not null default 1,
  constraint purchase_requests_company_number_unique unique (company_id, request_number),
  constraint purchase_requests_id_company_unique unique (id, company_id),
  constraint purchase_requests_project_company_fk
    foreign key (project_id, company_id)
    references projects.projects(id, company_id),
  constraint purchase_requests_purpose_check
    check (char_length(btrim(purpose)) between 2 and 2000),
  constraint purchase_requests_priority_check
    check (priority in ('low', 'normal', 'high', 'urgent')),
  constraint purchase_requests_total_check check (estimated_total >= 0),
  constraint purchase_requests_currency_check check (currency in ('AOA', 'USD', 'EUR')),
  constraint purchase_requests_version_check check (version >= 1),
  constraint purchase_requests_approver_role_check
    check (
      current_approver_role is null
      or current_approver_role in (
        'technical_reviewer',
        'financial_approver',
        'executive_approver'
      )
    )
);

create table procurement.purchase_request_items (
  id uuid primary key default gen_random_uuid(),
  purchase_request_id uuid not null
    references procurement.purchase_requests(id) on delete cascade,
  description text not null,
  quantity numeric(18, 4) not null,
  unit text not null,
  estimated_unit_price numeric(18, 2) not null,
  created_at timestamptz not null default now(),
  constraint purchase_request_items_description_check
    check (char_length(btrim(description)) between 1 and 500),
  constraint purchase_request_items_quantity_check check (quantity > 0),
  constraint purchase_request_items_unit_check
    check (char_length(btrim(unit)) between 1 and 40),
  constraint purchase_request_items_price_check check (estimated_unit_price >= 0)
);

create table procurement.approval_settings (
  company_id uuid primary key references identity.companies(id) on delete cascade,
  executive_approval_threshold numeric(18, 2) not null default 1000000,
  currency text not null default 'AOA',
  updated_at timestamptz not null default now(),
  constraint approval_settings_threshold_check
    check (executive_approval_threshold >= 0),
  constraint approval_settings_currency_check check (currency in ('AOA', 'USD', 'EUR'))
);

create table procurement.approval_decisions (
  id uuid primary key default gen_random_uuid(),
  purchase_request_id uuid not null,
  company_id uuid not null references identity.companies(id),
  stage text not null,
  decision text not null,
  decided_by uuid not null references auth.users(id),
  comment text,
  created_at timestamptz not null default now(),
  constraint approval_decisions_request_company_fk
    foreign key (purchase_request_id, company_id)
    references procurement.purchase_requests(id, company_id) on delete cascade,
  constraint approval_decisions_stage_check
    check (stage in ('technical', 'financial', 'executive')),
  constraint approval_decisions_decision_check
    check (decision in ('approved', 'rejected', 'returned')),
  constraint approval_decisions_comment_check
    check (comment is null or char_length(comment) <= 2000)
);

create index purchase_requests_company_created_idx
  on procurement.purchase_requests (company_id, created_at desc);
create index purchase_requests_company_status_idx
  on procurement.purchase_requests (company_id, status, created_at desc);
create index purchase_requests_project_idx
  on procurement.purchase_requests (project_id, created_at desc);
create index purchase_requests_requester_idx
  on procurement.purchase_requests (requested_by, created_at desc);
create index purchase_request_items_request_idx
  on procurement.purchase_request_items (purchase_request_id, created_at);
create index approval_decisions_request_created_idx
  on procurement.approval_decisions (purchase_request_id, created_at);
create index approval_decisions_company_created_idx
  on procurement.approval_decisions (company_id, created_at desc);

create or replace function platform.current_procurement_role()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_role text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  v_company_id := platform.current_company_id();

  select membership.role
  into v_role
  from identity.memberships as membership
  where membership.user_id = v_user_id
    and membership.company_id = v_company_id
    and membership.status = 'active'
  limit 1;

  if v_role is null then
    raise exception using errcode = '42501', message = 'active_membership_required';
  end if;

  return v_role;
end;
$$;

create or replace function platform.procurement_permissions()
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := platform.current_procurement_role();
begin
  case v_role
    when 'administrator' then
      return array[
        'Procurement.View',
        'Procurement.Create',
        'Procurement.EditOwn',
        'Procurement.Submit',
        'Procurement.TechnicalApprove',
        'Procurement.FinancialApprove',
        'Procurement.ExecutiveApprove',
        'Procurement.Cancel'
      ]::text[];
    when 'requester' then
      return array[
        'Procurement.View',
        'Procurement.Create',
        'Procurement.EditOwn',
        'Procurement.Submit',
        'Procurement.Cancel'
      ]::text[];
    when 'technical_reviewer' then
      return array['Procurement.View', 'Procurement.TechnicalApprove']::text[];
    when 'financial_approver' then
      return array['Procurement.View', 'Procurement.FinancialApprove']::text[];
    when 'executive_approver' then
      return array['Procurement.View', 'Procurement.ExecutiveApprove']::text[];
    else
      return array[]::text[];
  end case;
end;
$$;

create or replace function platform.procurement_has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_permission = any(platform.procurement_permissions());
$$;

create or replace function platform.require_procurement_permission(p_permission text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not platform.procurement_has_permission(p_permission) then
    raise exception using errcode = '42501', message = 'procurement_permission_denied';
  end if;
end;
$$;

create or replace function platform.can_read_purchase_request(p_purchase_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from procurement.purchase_requests as request
    join identity.memberships as membership
      on membership.company_id = request.company_id
    where request.id = p_purchase_request_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  )
  and platform.procurement_has_permission('Procurement.View');
$$;

create or replace function platform.procurement_requester_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select profile.full_name
  from identity.profiles as profile
  where profile.id = p_user_id;
$$;

create or replace function platform.initialize_procurement_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into procurement.approval_settings (
    company_id,
    executive_approval_threshold,
    currency
  ) values (
    new.id,
    1000000,
    'AOA'
  )
  on conflict (company_id) do nothing;

  return new;
end;
$$;

revoke all on function platform.initialize_procurement_settings() from public, anon, authenticated;

drop trigger if exists on_company_created_procurement_settings on identity.companies;
create trigger on_company_created_procurement_settings
after insert on identity.companies
for each row
execute function platform.initialize_procurement_settings();

insert into procurement.approval_settings (
  company_id,
  executive_approval_threshold,
  currency
)
select company.id, 1000000, 'AOA'
from identity.companies as company
on conflict (company_id) do nothing;

create or replace function platform.calculate_purchase_request_total(
  p_purchase_request_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(item.quantity * item.estimated_unit_price), 0)::numeric(18, 2)
  from procurement.purchase_request_items as item
  where item.purchase_request_id = p_purchase_request_id;
$$;

create or replace function platform.create_purchase_request(
  p_project_id uuid,
  p_purpose text,
  p_priority text,
  p_required_date date,
  p_currency text,
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_request_id uuid;
  v_request_number text;
  v_purpose text := btrim(p_purpose);
  v_item jsonb;
  v_description text;
  v_unit text;
  v_quantity numeric;
  v_price numeric;
  v_total numeric;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  perform platform.require_procurement_permission('Procurement.Create');
  v_company_id := platform.current_company_id();

  if v_purpose is null or char_length(v_purpose) < 2 or char_length(v_purpose) > 2000 then
    raise exception using errcode = '22023', message = 'invalid_purchase_request_purpose';
  end if;

  if p_priority not in ('low', 'normal', 'high', 'urgent') then
    raise exception using errcode = '22023', message = 'invalid_purchase_request_priority';
  end if;

  if p_required_date is null then
    raise exception using errcode = '22023', message = 'required_date_required';
  end if;

  if p_currency not in ('AOA', 'USD', 'EUR') then
    raise exception using errcode = '22023', message = 'invalid_purchase_request_currency';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception using errcode = '22023', message = 'invalid_purchase_request_items';
  end if;

  if not exists (
    select 1
    from projects.projects as project
    where project.id = p_project_id
      and project.company_id = v_company_id
      and project.status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'active_project_required';
  end if;

  v_request_number := format(
    'PR-%s-%s',
    to_char(current_date, 'YYYYMMDD'),
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  );

  insert into procurement.purchase_requests (
    company_id,
    project_id,
    request_number,
    requested_by,
    purpose,
    priority,
    required_date,
    status,
    estimated_total,
    currency,
    current_approver_role,
    version
  ) values (
    v_company_id,
    p_project_id,
    v_request_number,
    v_user_id,
    v_purpose,
    p_priority,
    p_required_date,
    'draft',
    0,
    p_currency,
    null,
    1
  )
  returning id into v_request_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_description := btrim(v_item ->> 'description');
    v_unit := btrim(v_item ->> 'unit');
    v_quantity := nullif(v_item ->> 'quantity', '')::numeric;
    v_price := nullif(v_item ->> 'estimatedUnitPrice', '')::numeric;

    if v_description is null or char_length(v_description) < 1 or char_length(v_description) > 500 then
      raise exception using errcode = '22023', message = 'invalid_purchase_request_item_description';
    end if;

    if v_unit is null or char_length(v_unit) < 1 or char_length(v_unit) > 40 then
      raise exception using errcode = '22023', message = 'invalid_purchase_request_item_unit';
    end if;

    if v_quantity is null or v_quantity <= 0 then
      raise exception using errcode = '22023', message = 'invalid_purchase_request_item_quantity';
    end if;

    if v_price is null or v_price < 0 then
      raise exception using errcode = '22023', message = 'invalid_purchase_request_item_price';
    end if;

    insert into procurement.purchase_request_items (
      purchase_request_id,
      description,
      quantity,
      unit,
      estimated_unit_price
    ) values (
      v_request_id,
      v_description,
      v_quantity,
      v_unit,
      v_price
    );
  end loop;

  v_total := platform.calculate_purchase_request_total(v_request_id);

  update procurement.purchase_requests
  set estimated_total = v_total
  where id = v_request_id;

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
    'PurchaseRequestCreated',
    'procurement',
    'purchase_request',
    v_request_id,
    jsonb_build_object(
      'request_number', v_request_number,
      'project_id', p_project_id,
      'currency', p_currency,
      'estimated_total', v_total,
      'version', 1
    )
  );

  return v_request_id;
end;
$$;

create or replace function platform.update_purchase_request(
  p_purchase_request_id uuid,
  p_expected_version integer,
  p_project_id uuid,
  p_purpose text,
  p_priority text,
  p_required_date date,
  p_currency text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_request procurement.purchase_requests%rowtype;
  v_new_version integer;
  v_purpose text := btrim(p_purpose);
begin
  perform platform.require_procurement_permission('Procurement.EditOwn');
  v_company_id := platform.current_company_id();

  select request.*
  into v_request
  from procurement.purchase_requests as request
  where request.id = p_purchase_request_id
    and request.company_id = v_company_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'purchase_request_not_found';
  end if;

  if v_request.requested_by <> v_user_id then
    raise exception using errcode = '42501', message = 'purchase_request_not_owned';
  end if;

  if v_request.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'purchase_request_version_conflict';
  end if;

  if v_request.status not in ('draft', 'returned') then
    raise exception using errcode = 'P0001', message = 'purchase_request_not_editable';
  end if;

  if not exists (
    select 1
    from projects.projects as project
    where project.id = p_project_id
      and project.company_id = v_company_id
      and project.status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'active_project_required';
  end if;

  if v_purpose is null or char_length(v_purpose) < 2 or char_length(v_purpose) > 2000 then
    raise exception using errcode = '22023', message = 'invalid_purchase_request_purpose';
  end if;

  if p_priority not in ('low', 'normal', 'high', 'urgent') then
    raise exception using errcode = '22023', message = 'invalid_purchase_request_priority';
  end if;

  if p_required_date is null then
    raise exception using errcode = '22023', message = 'required_date_required';
  end if;

  if p_currency not in ('AOA', 'USD', 'EUR') then
    raise exception using errcode = '22023', message = 'invalid_purchase_request_currency';
  end if;

  update procurement.purchase_requests as request
  set project_id = p_project_id,
      purpose = v_purpose,
      priority = p_priority,
      required_date = p_required_date,
      currency = p_currency,
      updated_at = now(),
      version = request.version + 1
  where request.id = p_purchase_request_id
    and request.company_id = v_company_id
    and request.version = p_expected_version
  returning request.version into v_new_version;

  if not found then
    raise exception using errcode = '40001', message = 'purchase_request_version_conflict';
  end if;

  insert into audit.entries (
    company_id, user_id, action, module, resource_type, resource_id, metadata
  ) values (
    v_company_id,
    v_user_id,
    'PurchaseRequestUpdated',
    'procurement',
    'purchase_request',
    p_purchase_request_id,
    jsonb_build_object('change', 'request_fields', 'version', v_new_version)
  );

  return v_new_version;
end;
$$;

create or replace function platform.add_purchase_request_item(
  p_purchase_request_id uuid,
  p_expected_version integer,
  p_description text,
  p_quantity numeric,
  p_unit text,
  p_estimated_unit_price numeric
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_request procurement.purchase_requests%rowtype;
  v_new_version integer;
  v_total numeric;
  v_description text := btrim(p_description);
  v_unit text := btrim(p_unit);
begin
  perform platform.require_procurement_permission('Procurement.EditOwn');
  v_company_id := platform.current_company_id();

  select request.* into v_request
  from procurement.purchase_requests as request
  where request.id = p_purchase_request_id
    and request.company_id = v_company_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'purchase_request_not_found';
  end if;
  if v_request.requested_by <> v_user_id then
    raise exception using errcode = '42501', message = 'purchase_request_not_owned';
  end if;
  if v_request.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'purchase_request_version_conflict';
  end if;
  if v_request.status not in ('draft', 'returned') then
    raise exception using errcode = 'P0001', message = 'purchase_request_not_editable';
  end if;
  if v_description is null or char_length(v_description) < 1 or char_length(v_description) > 500 then
    raise exception using errcode = '22023', message = 'invalid_purchase_request_item_description';
  end if;
  if v_unit is null or char_length(v_unit) < 1 or char_length(v_unit) > 40 then
    raise exception using errcode = '22023', message = 'invalid_purchase_request_item_unit';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception using errcode = '22023', message = 'invalid_purchase_request_item_quantity';
  end if;
  if p_estimated_unit_price is null or p_estimated_unit_price < 0 then
    raise exception using errcode = '22023', message = 'invalid_purchase_request_item_price';
  end if;

  insert into procurement.purchase_request_items (
    purchase_request_id, description, quantity, unit, estimated_unit_price
  ) values (
    p_purchase_request_id, v_description, p_quantity, v_unit, p_estimated_unit_price
  );

  v_total := platform.calculate_purchase_request_total(p_purchase_request_id);

  update procurement.purchase_requests as request
  set estimated_total = v_total,
      updated_at = now(),
      version = request.version + 1
  where request.id = p_purchase_request_id
    and request.version = p_expected_version
  returning request.version into v_new_version;

  insert into audit.entries (
    company_id, user_id, action, module, resource_type, resource_id, metadata
  ) values (
    v_company_id,
    v_user_id,
    'PurchaseRequestUpdated',
    'procurement',
    'purchase_request',
    p_purchase_request_id,
    jsonb_build_object('change', 'item_added', 'estimated_total', v_total, 'version', v_new_version)
  );

  return v_new_version;
end;
$$;

create or replace function platform.update_purchase_request_item(
  p_purchase_request_id uuid,
  p_item_id uuid,
  p_expected_version integer,
  p_description text,
  p_quantity numeric,
  p_unit text,
  p_estimated_unit_price numeric
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_request procurement.purchase_requests%rowtype;
  v_new_version integer;
  v_total numeric;
  v_description text := btrim(p_description);
  v_unit text := btrim(p_unit);
begin
  perform platform.require_procurement_permission('Procurement.EditOwn');
  v_company_id := platform.current_company_id();

  select request.* into v_request
  from procurement.purchase_requests as request
  where request.id = p_purchase_request_id
    and request.company_id = v_company_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'purchase_request_not_found';
  end if;
  if v_request.requested_by <> v_user_id then
    raise exception using errcode = '42501', message = 'purchase_request_not_owned';
  end if;
  if v_request.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'purchase_request_version_conflict';
  end if;
  if v_request.status not in ('draft', 'returned') then
    raise exception using errcode = 'P0001', message = 'purchase_request_not_editable';
  end if;
  if v_description is null or char_length(v_description) < 1 or char_length(v_description) > 500 then
    raise exception using errcode = '22023', message = 'invalid_purchase_request_item_description';
  end if;
  if v_unit is null or char_length(v_unit) < 1 or char_length(v_unit) > 40 then
    raise exception using errcode = '22023', message = 'invalid_purchase_request_item_unit';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception using errcode = '22023', message = 'invalid_purchase_request_item_quantity';
  end if;
  if p_estimated_unit_price is null or p_estimated_unit_price < 0 then
    raise exception using errcode = '22023', message = 'invalid_purchase_request_item_price';
  end if;

  update procurement.purchase_request_items as item
  set description = v_description,
      quantity = p_quantity,
      unit = v_unit,
      estimated_unit_price = p_estimated_unit_price
  where item.id = p_item_id
    and item.purchase_request_id = p_purchase_request_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'purchase_request_item_not_found';
  end if;

  v_total := platform.calculate_purchase_request_total(p_purchase_request_id);

  update procurement.purchase_requests as request
  set estimated_total = v_total,
      updated_at = now(),
      version = request.version + 1
  where request.id = p_purchase_request_id
    and request.version = p_expected_version
  returning request.version into v_new_version;

  insert into audit.entries (
    company_id, user_id, action, module, resource_type, resource_id, metadata
  ) values (
    v_company_id,
    v_user_id,
    'PurchaseRequestUpdated',
    'procurement',
    'purchase_request',
    p_purchase_request_id,
    jsonb_build_object('change', 'item_updated', 'item_id', p_item_id, 'estimated_total', v_total, 'version', v_new_version)
  );

  return v_new_version;
end;
$$;

create or replace function platform.remove_purchase_request_item(
  p_purchase_request_id uuid,
  p_item_id uuid,
  p_expected_version integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_request procurement.purchase_requests%rowtype;
  v_new_version integer;
  v_total numeric;
begin
  perform platform.require_procurement_permission('Procurement.EditOwn');
  v_company_id := platform.current_company_id();

  select request.* into v_request
  from procurement.purchase_requests as request
  where request.id = p_purchase_request_id
    and request.company_id = v_company_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'purchase_request_not_found';
  end if;
  if v_request.requested_by <> v_user_id then
    raise exception using errcode = '42501', message = 'purchase_request_not_owned';
  end if;
  if v_request.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'purchase_request_version_conflict';
  end if;
  if v_request.status not in ('draft', 'returned') then
    raise exception using errcode = 'P0001', message = 'purchase_request_not_editable';
  end if;

  delete from procurement.purchase_request_items as item
  where item.id = p_item_id
    and item.purchase_request_id = p_purchase_request_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'purchase_request_item_not_found';
  end if;

  v_total := platform.calculate_purchase_request_total(p_purchase_request_id);

  update procurement.purchase_requests as request
  set estimated_total = v_total,
      updated_at = now(),
      version = request.version + 1
  where request.id = p_purchase_request_id
    and request.version = p_expected_version
  returning request.version into v_new_version;

  insert into audit.entries (
    company_id, user_id, action, module, resource_type, resource_id, metadata
  ) values (
    v_company_id,
    v_user_id,
    'PurchaseRequestUpdated',
    'procurement',
    'purchase_request',
    p_purchase_request_id,
    jsonb_build_object('change', 'item_removed', 'item_id', p_item_id, 'estimated_total', v_total, 'version', v_new_version)
  );

  return v_new_version;
end;
$$;

create or replace function platform.submit_purchase_request(
  p_purchase_request_id uuid,
  p_expected_version integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_request procurement.purchase_requests%rowtype;
  v_new_version integer;
begin
  perform platform.require_procurement_permission('Procurement.Submit');
  v_company_id := platform.current_company_id();

  select request.* into v_request
  from procurement.purchase_requests as request
  where request.id = p_purchase_request_id
    and request.company_id = v_company_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'purchase_request_not_found';
  end if;
  if v_request.requested_by <> v_user_id then
    raise exception using errcode = '42501', message = 'purchase_request_not_owned';
  end if;
  if v_request.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'purchase_request_version_conflict';
  end if;
  if v_request.status not in ('draft', 'returned') then
    raise exception using errcode = 'P0001', message = 'purchase_request_not_submittable';
  end if;
  if not exists (
    select 1
    from procurement.purchase_request_items as item
    where item.purchase_request_id = p_purchase_request_id
  ) then
    raise exception using errcode = 'P0001', message = 'purchase_request_items_required';
  end if;
  if not exists (
    select 1
    from projects.projects as project
    where project.id = v_request.project_id
      and project.company_id = v_company_id
      and project.status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'active_project_required';
  end if;

  update procurement.purchase_requests as request
  set status = 'technical_review',
      current_approver_role = 'technical_reviewer',
      submitted_at = now(),
      approved_at = null,
      updated_at = now(),
      version = request.version + 1
  where request.id = p_purchase_request_id
    and request.version = p_expected_version
  returning request.version into v_new_version;

  insert into audit.entries (
    company_id, user_id, action, module, resource_type, resource_id, metadata
  ) values (
    v_company_id,
    v_user_id,
    'PurchaseRequestSubmitted',
    'procurement',
    'purchase_request',
    p_purchase_request_id,
    jsonb_build_object('from_status', v_request.status, 'to_status', 'technical_review', 'version', v_new_version)
  );

  return v_new_version;
end;
$$;

create or replace function platform.approve_technical_review(
  p_purchase_request_id uuid,
  p_expected_version integer,
  p_comment text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_request procurement.purchase_requests%rowtype;
  v_new_version integer;
begin
  perform platform.require_procurement_permission('Procurement.TechnicalApprove');
  v_company_id := platform.current_company_id();

  select request.* into v_request
  from procurement.purchase_requests as request
  where request.id = p_purchase_request_id
    and request.company_id = v_company_id
  for update;

  if not found then raise exception using errcode = 'P0001', message = 'purchase_request_not_found'; end if;
  if v_request.requested_by = v_user_id then raise exception using errcode = '42501', message = 'self_approval_forbidden'; end if;
  if v_request.version <> p_expected_version then raise exception using errcode = '40001', message = 'purchase_request_version_conflict'; end if;
  if v_request.status <> 'technical_review' then raise exception using errcode = 'P0001', message = 'invalid_purchase_request_transition'; end if;

  insert into procurement.approval_decisions (
    purchase_request_id, company_id, stage, decision, decided_by, comment
  ) values (
    p_purchase_request_id, v_company_id, 'technical', 'approved', v_user_id, nullif(btrim(p_comment), '')
  );

  update procurement.purchase_requests as request
  set status = 'financial_review',
      current_approver_role = 'financial_approver',
      updated_at = now(),
      version = request.version + 1
  where request.id = p_purchase_request_id
    and request.version = p_expected_version
  returning request.version into v_new_version;

  insert into audit.entries (
    company_id, user_id, action, module, resource_type, resource_id, metadata
  ) values (
    v_company_id, v_user_id, 'TechnicalApprovalGranted', 'procurement', 'purchase_request', p_purchase_request_id,
    jsonb_build_object('to_status', 'financial_review', 'version', v_new_version)
  );

  return v_new_version;
end;
$$;

create or replace function platform.approve_financial_review(
  p_purchase_request_id uuid,
  p_expected_version integer,
  p_comment text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_request procurement.purchase_requests%rowtype;
  v_setting procurement.approval_settings%rowtype;
  v_target_status procurement.purchase_request_status;
  v_new_version integer;
  v_currency_mismatch boolean;
begin
  perform platform.require_procurement_permission('Procurement.FinancialApprove');
  v_company_id := platform.current_company_id();

  select request.* into v_request
  from procurement.purchase_requests as request
  where request.id = p_purchase_request_id
    and request.company_id = v_company_id
  for update;

  if not found then raise exception using errcode = 'P0001', message = 'purchase_request_not_found'; end if;
  if v_request.requested_by = v_user_id then raise exception using errcode = '42501', message = 'self_approval_forbidden'; end if;
  if v_request.version <> p_expected_version then raise exception using errcode = '40001', message = 'purchase_request_version_conflict'; end if;
  if v_request.status <> 'financial_review' then raise exception using errcode = 'P0001', message = 'invalid_purchase_request_transition'; end if;

  select setting.* into v_setting
  from procurement.approval_settings as setting
  where setting.company_id = v_company_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'approval_settings_required';
  end if;

  v_currency_mismatch := v_request.currency <> v_setting.currency;

  if not v_currency_mismatch
    and v_request.estimated_total < v_setting.executive_approval_threshold then
    v_target_status := 'approved';
  else
    v_target_status := 'executive_review';
  end if;

  insert into procurement.approval_decisions (
    purchase_request_id, company_id, stage, decision, decided_by, comment
  ) values (
    p_purchase_request_id, v_company_id, 'financial', 'approved', v_user_id, nullif(btrim(p_comment), '')
  );

  update procurement.purchase_requests as request
  set status = v_target_status,
      current_approver_role = case when v_target_status = 'executive_review' then 'executive_approver' else null end,
      approved_at = case when v_target_status = 'approved' then now() else null end,
      updated_at = now(),
      version = request.version + 1
  where request.id = p_purchase_request_id
    and request.version = p_expected_version
  returning request.version into v_new_version;

  insert into audit.entries (
    company_id, user_id, action, module, resource_type, resource_id, metadata
  ) values (
    v_company_id, v_user_id, 'FinancialApprovalGranted', 'procurement', 'purchase_request', p_purchase_request_id,
    jsonb_build_object(
      'to_status', v_target_status,
      'threshold', v_setting.executive_approval_threshold,
      'threshold_currency', v_setting.currency,
      'currency_mismatch', v_currency_mismatch,
      'version', v_new_version
    )
  );

  return v_new_version;
end;
$$;

create or replace function platform.approve_executive_review(
  p_purchase_request_id uuid,
  p_expected_version integer,
  p_comment text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_request procurement.purchase_requests%rowtype;
  v_new_version integer;
begin
  perform platform.require_procurement_permission('Procurement.ExecutiveApprove');
  v_company_id := platform.current_company_id();

  select request.* into v_request
  from procurement.purchase_requests as request
  where request.id = p_purchase_request_id
    and request.company_id = v_company_id
  for update;

  if not found then raise exception using errcode = 'P0001', message = 'purchase_request_not_found'; end if;
  if v_request.requested_by = v_user_id then raise exception using errcode = '42501', message = 'self_approval_forbidden'; end if;
  if v_request.version <> p_expected_version then raise exception using errcode = '40001', message = 'purchase_request_version_conflict'; end if;
  if v_request.status <> 'executive_review' then raise exception using errcode = 'P0001', message = 'invalid_purchase_request_transition'; end if;

  insert into procurement.approval_decisions (
    purchase_request_id, company_id, stage, decision, decided_by, comment
  ) values (
    p_purchase_request_id, v_company_id, 'executive', 'approved', v_user_id, nullif(btrim(p_comment), '')
  );

  update procurement.purchase_requests as request
  set status = 'approved',
      current_approver_role = null,
      approved_at = now(),
      updated_at = now(),
      version = request.version + 1
  where request.id = p_purchase_request_id
    and request.version = p_expected_version
  returning request.version into v_new_version;

  insert into audit.entries (
    company_id, user_id, action, module, resource_type, resource_id, metadata
  ) values (
    v_company_id, v_user_id, 'ExecutiveApprovalGranted', 'procurement', 'purchase_request', p_purchase_request_id,
    jsonb_build_object('to_status', 'approved', 'version', v_new_version)
  );

  return v_new_version;
end;
$$;

create or replace function platform.decide_purchase_request(
  p_purchase_request_id uuid,
  p_expected_version integer,
  p_decision text,
  p_comment text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_request procurement.purchase_requests%rowtype;
  v_permission text;
  v_stage text;
  v_target_status procurement.purchase_request_status;
  v_audit_action text;
  v_new_version integer;
begin
  if p_decision not in ('returned', 'rejected') then
    raise exception using errcode = '22023', message = 'invalid_approval_decision';
  end if;

  v_company_id := platform.current_company_id();

  select request.* into v_request
  from procurement.purchase_requests as request
  where request.id = p_purchase_request_id
    and request.company_id = v_company_id
  for update;

  if not found then raise exception using errcode = 'P0001', message = 'purchase_request_not_found'; end if;
  if v_request.requested_by = v_user_id then raise exception using errcode = '42501', message = 'self_approval_forbidden'; end if;
  if v_request.version <> p_expected_version then raise exception using errcode = '40001', message = 'purchase_request_version_conflict'; end if;

  case v_request.status
    when 'technical_review' then
      v_permission := 'Procurement.TechnicalApprove';
      v_stage := 'technical';
    when 'financial_review' then
      v_permission := 'Procurement.FinancialApprove';
      v_stage := 'financial';
    when 'executive_review' then
      v_permission := 'Procurement.ExecutiveApprove';
      v_stage := 'executive';
    else
      raise exception using errcode = 'P0001', message = 'invalid_purchase_request_transition';
  end case;

  perform platform.require_procurement_permission(v_permission);

  if p_decision = 'returned' then
    v_target_status := 'returned';
    v_audit_action := 'PurchaseRequestReturned';
  else
    v_target_status := 'rejected';
    v_audit_action := 'PurchaseRequestRejected';
  end if;

  insert into procurement.approval_decisions (
    purchase_request_id, company_id, stage, decision, decided_by, comment
  ) values (
    p_purchase_request_id, v_company_id, v_stage, p_decision, v_user_id, nullif(btrim(p_comment), '')
  );

  update procurement.purchase_requests as request
  set status = v_target_status,
      current_approver_role = null,
      approved_at = null,
      updated_at = now(),
      version = request.version + 1
  where request.id = p_purchase_request_id
    and request.version = p_expected_version
  returning request.version into v_new_version;

  insert into audit.entries (
    company_id, user_id, action, module, resource_type, resource_id, metadata
  ) values (
    v_company_id, v_user_id, v_audit_action, 'procurement', 'purchase_request', p_purchase_request_id,
    jsonb_build_object('stage', v_stage, 'from_status', v_request.status, 'to_status', v_target_status, 'version', v_new_version)
  );

  return v_new_version;
end;
$$;

create or replace function platform.cancel_purchase_request(
  p_purchase_request_id uuid,
  p_expected_version integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_role text;
  v_request procurement.purchase_requests%rowtype;
  v_new_version integer;
begin
  perform platform.require_procurement_permission('Procurement.Cancel');
  v_company_id := platform.current_company_id();
  v_role := platform.current_procurement_role();

  select request.* into v_request
  from procurement.purchase_requests as request
  where request.id = p_purchase_request_id
    and request.company_id = v_company_id
  for update;

  if not found then raise exception using errcode = 'P0001', message = 'purchase_request_not_found'; end if;
  if v_request.version <> p_expected_version then raise exception using errcode = '40001', message = 'purchase_request_version_conflict'; end if;
  if v_request.requested_by <> v_user_id and v_role <> 'administrator' then
    raise exception using errcode = '42501', message = 'purchase_request_cancel_forbidden';
  end if;
  if v_request.status in ('approved', 'rejected', 'cancelled') then
    raise exception using errcode = 'P0001', message = 'purchase_request_not_cancellable';
  end if;

  update procurement.purchase_requests as request
  set status = 'cancelled',
      current_approver_role = null,
      updated_at = now(),
      version = request.version + 1
  where request.id = p_purchase_request_id
    and request.version = p_expected_version
  returning request.version into v_new_version;

  insert into audit.entries (
    company_id, user_id, action, module, resource_type, resource_id, metadata
  ) values (
    v_company_id, v_user_id, 'PurchaseRequestCancelled', 'procurement', 'purchase_request', p_purchase_request_id,
    jsonb_build_object('from_status', v_request.status, 'to_status', 'cancelled', 'version', v_new_version)
  );

  return v_new_version;
end;
$$;

create or replace function platform.update_procurement_approval_settings(
  p_threshold numeric,
  p_currency text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
begin
  if platform.current_procurement_role() <> 'administrator' then
    raise exception using errcode = '42501', message = 'administrator_required';
  end if;

  if p_threshold is null or p_threshold < 0 then
    raise exception using errcode = '22023', message = 'invalid_approval_threshold';
  end if;
  if p_currency not in ('AOA', 'USD', 'EUR') then
    raise exception using errcode = '22023', message = 'invalid_approval_currency';
  end if;

  v_company_id := platform.current_company_id();

  insert into procurement.approval_settings (
    company_id, executive_approval_threshold, currency, updated_at
  ) values (
    v_company_id, p_threshold, p_currency, now()
  )
  on conflict (company_id) do update
  set executive_approval_threshold = excluded.executive_approval_threshold,
      currency = excluded.currency,
      updated_at = now();

  insert into audit.entries (
    company_id, user_id, action, module, resource_type, resource_id, metadata
  ) values (
    v_company_id, v_user_id, 'ProcurementApprovalSettingsUpdated', 'procurement', 'approval_settings', v_company_id,
    jsonb_build_object('threshold', p_threshold, 'currency', p_currency)
  );
end;
$$;

create or replace function platform.list_purchase_request_audit(p_purchase_request_id uuid)
returns table (
  action text,
  user_id uuid,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
begin
  perform platform.require_procurement_permission('Procurement.View');
  v_company_id := platform.current_company_id();

  if not exists (
    select 1
    from procurement.purchase_requests as request
    where request.id = p_purchase_request_id
      and request.company_id = v_company_id
  ) then
    raise exception using errcode = 'P0001', message = 'purchase_request_not_found';
  end if;

  return query
  select entry.action, entry.user_id, entry.metadata, entry.created_at
  from audit.entries as entry
  where entry.company_id = v_company_id
    and entry.module = 'procurement'
    and entry.resource_type = 'purchase_request'
    and entry.resource_id = p_purchase_request_id
  order by entry.created_at, entry.id;
end;
$$;

alter table procurement.purchase_requests enable row level security;
alter table procurement.purchase_request_items enable row level security;
alter table procurement.approval_settings enable row level security;
alter table procurement.approval_decisions enable row level security;

revoke all on schema procurement from anon;
revoke all on procurement.purchase_requests from anon;
revoke all on procurement.purchase_request_items from anon;
revoke all on procurement.approval_settings from anon;
revoke all on procurement.approval_decisions from anon;

grant usage on schema procurement to authenticated;
grant select on procurement.purchase_requests to authenticated;
grant select on procurement.purchase_request_items to authenticated;
grant select on procurement.approval_settings to authenticated;
grant select on procurement.approval_decisions to authenticated;

revoke insert, update, delete, truncate, references, trigger
  on procurement.purchase_requests from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on procurement.purchase_request_items from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on procurement.approval_settings from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on procurement.approval_decisions from authenticated;

create policy purchase_requests_select_company
on procurement.purchase_requests
for select
to authenticated
using (
  identity.is_company_member(company_id)
  and platform.procurement_has_permission('Procurement.View')
);

create policy purchase_request_items_select_company
on procurement.purchase_request_items
for select
to authenticated
using (platform.can_read_purchase_request(purchase_request_id));

create policy approval_settings_select_company
on procurement.approval_settings
for select
to authenticated
using (identity.is_company_member(company_id));

create policy approval_decisions_select_company
on procurement.approval_decisions
for select
to authenticated
using (
  identity.is_company_member(company_id)
  and platform.procurement_has_permission('Procurement.View')
);

create or replace function public.get_procurement_permissions()
returns text[]
language sql
stable
security invoker
set search_path = ''
as $$
  select platform.procurement_permissions();
$$;

create or replace function public.create_purchase_request(
  project_id uuid,
  purpose text,
  priority text,
  required_date date,
  currency text,
  items jsonb default '[]'::jsonb
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select platform.create_purchase_request(project_id, purpose, priority, required_date, currency, items);
$$;

create or replace function public.update_purchase_request(
  purchase_request_id uuid,
  expected_version integer,
  project_id uuid,
  purpose text,
  priority text,
  required_date date,
  currency text
)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select platform.update_purchase_request(
    purchase_request_id, expected_version, project_id, purpose, priority, required_date, currency
  );
$$;

create or replace function public.add_purchase_request_item(
  purchase_request_id uuid,
  expected_version integer,
  description text,
  quantity numeric,
  unit text,
  estimated_unit_price numeric
)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select platform.add_purchase_request_item(
    purchase_request_id, expected_version, description, quantity, unit, estimated_unit_price
  );
$$;

create or replace function public.update_purchase_request_item(
  purchase_request_id uuid,
  item_id uuid,
  expected_version integer,
  description text,
  quantity numeric,
  unit text,
  estimated_unit_price numeric
)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select platform.update_purchase_request_item(
    purchase_request_id, item_id, expected_version, description, quantity, unit, estimated_unit_price
  );
$$;

create or replace function public.remove_purchase_request_item(
  purchase_request_id uuid,
  item_id uuid,
  expected_version integer
)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select platform.remove_purchase_request_item(purchase_request_id, item_id, expected_version);
$$;

create or replace function public.submit_purchase_request(
  purchase_request_id uuid,
  expected_version integer
)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select platform.submit_purchase_request(purchase_request_id, expected_version);
$$;

create or replace function public.approve_technical_review(
  purchase_request_id uuid,
  expected_version integer,
  comment text default null
)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select platform.approve_technical_review(purchase_request_id, expected_version, comment);
$$;

create or replace function public.approve_financial_review(
  purchase_request_id uuid,
  expected_version integer,
  comment text default null
)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select platform.approve_financial_review(purchase_request_id, expected_version, comment);
$$;

create or replace function public.approve_executive_review(
  purchase_request_id uuid,
  expected_version integer,
  comment text default null
)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select platform.approve_executive_review(purchase_request_id, expected_version, comment);
$$;

create or replace function public.return_purchase_request(
  purchase_request_id uuid,
  expected_version integer,
  comment text default null
)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select platform.decide_purchase_request(purchase_request_id, expected_version, 'returned', comment);
$$;

create or replace function public.reject_purchase_request(
  purchase_request_id uuid,
  expected_version integer,
  comment text default null
)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select platform.decide_purchase_request(purchase_request_id, expected_version, 'rejected', comment);
$$;

create or replace function public.cancel_purchase_request(
  purchase_request_id uuid,
  expected_version integer
)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select platform.cancel_purchase_request(purchase_request_id, expected_version);
$$;

create or replace function public.update_procurement_approval_settings(
  threshold numeric,
  currency text
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select platform.update_procurement_approval_settings(threshold, currency);
$$;

create or replace function public.list_purchase_requests(
  status_filter text default null,
  project_id_filter uuid default null,
  priority_filter text default null
)
returns table (
  id uuid,
  project_id uuid,
  project_name text,
  request_number text,
  requested_by uuid,
  requester_name text,
  purpose text,
  priority text,
  required_date date,
  status text,
  estimated_total numeric,
  currency text,
  current_approver_role text,
  created_at timestamptz,
  updated_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  version integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    request.id,
    request.project_id,
    project.name,
    request.request_number,
    request.requested_by,
    platform.procurement_requester_name(request.requested_by),
    request.purpose,
    request.priority,
    request.required_date,
    request.status::text,
    request.estimated_total,
    request.currency,
    request.current_approver_role,
    request.created_at,
    request.updated_at,
    request.submitted_at,
    request.approved_at,
    request.version
  from procurement.purchase_requests as request
  join projects.projects as project
    on project.id = request.project_id
    and project.company_id = request.company_id
  where request.company_id = platform.current_company_id()
    and platform.procurement_has_permission('Procurement.View')
    and (status_filter is null or request.status::text = status_filter)
    and (project_id_filter is null or request.project_id = project_id_filter)
    and (priority_filter is null or request.priority = priority_filter)
  order by request.created_at desc, request.id;
$$;

create or replace function public.get_purchase_request(purchase_request_id uuid)
returns table (
  id uuid,
  project_id uuid,
  project_name text,
  request_number text,
  requested_by uuid,
  requester_name text,
  purpose text,
  priority text,
  required_date date,
  status text,
  estimated_total numeric,
  currency text,
  current_approver_role text,
  created_at timestamptz,
  updated_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  version integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    request.id,
    request.project_id,
    project.name,
    request.request_number,
    request.requested_by,
    platform.procurement_requester_name(request.requested_by),
    request.purpose,
    request.priority,
    request.required_date,
    request.status::text,
    request.estimated_total,
    request.currency,
    request.current_approver_role,
    request.created_at,
    request.updated_at,
    request.submitted_at,
    request.approved_at,
    request.version
  from procurement.purchase_requests as request
  join projects.projects as project
    on project.id = request.project_id
    and project.company_id = request.company_id
  where request.id = purchase_request_id
    and request.company_id = platform.current_company_id()
    and platform.procurement_has_permission('Procurement.View');
$$;

create or replace function public.list_purchase_request_items(purchase_request_id uuid)
returns table (
  id uuid,
  description text,
  quantity numeric,
  unit text,
  estimated_unit_price numeric,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select item.id, item.description, item.quantity, item.unit, item.estimated_unit_price, item.created_at
  from procurement.purchase_request_items as item
  where item.purchase_request_id = purchase_request_id
  order by item.created_at, item.id;
$$;

create or replace function public.list_purchase_request_decisions(purchase_request_id uuid)
returns table (
  id uuid,
  stage text,
  decision text,
  decided_by uuid,
  decided_by_name text,
  comment text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    decision.id,
    decision.stage,
    decision.decision,
    decision.decided_by,
    platform.procurement_requester_name(decision.decided_by),
    decision.comment,
    decision.created_at
  from procurement.approval_decisions as decision
  where decision.purchase_request_id = purchase_request_id
    and decision.company_id = platform.current_company_id()
  order by decision.created_at, decision.id;
$$;

create or replace function public.get_procurement_approval_settings()
returns table (
  executive_approval_threshold numeric,
  currency text,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select setting.executive_approval_threshold, setting.currency, setting.updated_at
  from procurement.approval_settings as setting
  where setting.company_id = platform.current_company_id();
$$;

create or replace function public.list_pending_approvals()
returns table (
  id uuid,
  project_id uuid,
  project_name text,
  request_number text,
  requested_by uuid,
  requester_name text,
  purpose text,
  priority text,
  required_date date,
  status text,
  estimated_total numeric,
  currency text,
  created_at timestamptz,
  version integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    request.id,
    request.project_id,
    project.name,
    request.request_number,
    request.requested_by,
    platform.procurement_requester_name(request.requested_by),
    request.purpose,
    request.priority,
    request.required_date,
    request.status::text,
    request.estimated_total,
    request.currency,
    request.created_at,
    request.version
  from procurement.purchase_requests as request
  join projects.projects as project
    on project.id = request.project_id
    and project.company_id = request.company_id
  where request.company_id = platform.current_company_id()
    and request.requested_by <> (select auth.uid())
    and (
      (request.status = 'technical_review' and platform.procurement_has_permission('Procurement.TechnicalApprove'))
      or (request.status = 'financial_review' and platform.procurement_has_permission('Procurement.FinancialApprove'))
      or (request.status = 'executive_review' and platform.procurement_has_permission('Procurement.ExecutiveApprove'))
    )
  order by request.created_at, request.id;
$$;

create or replace function public.list_purchase_request_audit(purchase_request_id uuid)
returns table (
  action text,
  user_id uuid,
  metadata jsonb,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from platform.list_purchase_request_audit(purchase_request_id);
$$;

revoke all on function platform.current_procurement_role() from public, anon;
revoke all on function platform.procurement_permissions() from public, anon;
revoke all on function platform.procurement_has_permission(text) from public, anon;
revoke all on function platform.require_procurement_permission(text) from public, anon;
revoke all on function platform.can_read_purchase_request(uuid) from public, anon;
revoke all on function platform.procurement_requester_name(uuid) from public, anon;
revoke all on function platform.calculate_purchase_request_total(uuid) from public, anon;
revoke all on function platform.create_purchase_request(uuid, text, text, date, text, jsonb) from public, anon;
revoke all on function platform.update_purchase_request(uuid, integer, uuid, text, text, date, text) from public, anon;
revoke all on function platform.add_purchase_request_item(uuid, integer, text, numeric, text, numeric) from public, anon;
revoke all on function platform.update_purchase_request_item(uuid, uuid, integer, text, numeric, text, numeric) from public, anon;
revoke all on function platform.remove_purchase_request_item(uuid, uuid, integer) from public, anon;
revoke all on function platform.submit_purchase_request(uuid, integer) from public, anon;
revoke all on function platform.approve_technical_review(uuid, integer, text) from public, anon;
revoke all on function platform.approve_financial_review(uuid, integer, text) from public, anon;
revoke all on function platform.approve_executive_review(uuid, integer, text) from public, anon;
revoke all on function platform.decide_purchase_request(uuid, integer, text, text) from public, anon;
revoke all on function platform.cancel_purchase_request(uuid, integer) from public, anon;
revoke all on function platform.update_procurement_approval_settings(numeric, text) from public, anon;
revoke all on function platform.list_purchase_request_audit(uuid) from public, anon;

grant execute on function platform.current_procurement_role() to authenticated;
grant execute on function platform.procurement_permissions() to authenticated;
grant execute on function platform.procurement_has_permission(text) to authenticated;
grant execute on function platform.require_procurement_permission(text) to authenticated;
grant execute on function platform.can_read_purchase_request(uuid) to authenticated;
grant execute on function platform.procurement_requester_name(uuid) to authenticated;
grant execute on function platform.calculate_purchase_request_total(uuid) to authenticated;
grant execute on function platform.create_purchase_request(uuid, text, text, date, text, jsonb) to authenticated;
grant execute on function platform.update_purchase_request(uuid, integer, uuid, text, text, date, text) to authenticated;
grant execute on function platform.add_purchase_request_item(uuid, integer, text, numeric, text, numeric) to authenticated;
grant execute on function platform.update_purchase_request_item(uuid, uuid, integer, text, numeric, text, numeric) to authenticated;
grant execute on function platform.remove_purchase_request_item(uuid, uuid, integer) to authenticated;
grant execute on function platform.submit_purchase_request(uuid, integer) to authenticated;
grant execute on function platform.approve_technical_review(uuid, integer, text) to authenticated;
grant execute on function platform.approve_financial_review(uuid, integer, text) to authenticated;
grant execute on function platform.approve_executive_review(uuid, integer, text) to authenticated;
grant execute on function platform.decide_purchase_request(uuid, integer, text, text) to authenticated;
grant execute on function platform.cancel_purchase_request(uuid, integer) to authenticated;
grant execute on function platform.update_procurement_approval_settings(numeric, text) to authenticated;
grant execute on function platform.list_purchase_request_audit(uuid) to authenticated;

revoke all on function public.get_procurement_permissions() from public, anon;
revoke all on function public.create_purchase_request(uuid, text, text, date, text, jsonb) from public, anon;
revoke all on function public.update_purchase_request(uuid, integer, uuid, text, text, date, text) from public, anon;
revoke all on function public.add_purchase_request_item(uuid, integer, text, numeric, text, numeric) from public, anon;
revoke all on function public.update_purchase_request_item(uuid, uuid, integer, text, numeric, text, numeric) from public, anon;
revoke all on function public.remove_purchase_request_item(uuid, uuid, integer) from public, anon;
revoke all on function public.submit_purchase_request(uuid, integer) from public, anon;
revoke all on function public.approve_technical_review(uuid, integer, text) from public, anon;
revoke all on function public.approve_financial_review(uuid, integer, text) from public, anon;
revoke all on function public.approve_executive_review(uuid, integer, text) from public, anon;
revoke all on function public.return_purchase_request(uuid, integer, text) from public, anon;
revoke all on function public.reject_purchase_request(uuid, integer, text) from public, anon;
revoke all on function public.cancel_purchase_request(uuid, integer) from public, anon;
revoke all on function public.update_procurement_approval_settings(numeric, text) from public, anon;
revoke all on function public.list_purchase_requests(text, uuid, text) from public, anon;
revoke all on function public.get_purchase_request(uuid) from public, anon;
revoke all on function public.list_purchase_request_items(uuid) from public, anon;
revoke all on function public.list_purchase_request_decisions(uuid) from public, anon;
revoke all on function public.get_procurement_approval_settings() from public, anon;
revoke all on function public.list_pending_approvals() from public, anon;
revoke all on function public.list_purchase_request_audit(uuid) from public, anon;

grant execute on function public.get_procurement_permissions() to authenticated;
grant execute on function public.create_purchase_request(uuid, text, text, date, text, jsonb) to authenticated;
grant execute on function public.update_purchase_request(uuid, integer, uuid, text, text, date, text) to authenticated;
grant execute on function public.add_purchase_request_item(uuid, integer, text, numeric, text, numeric) to authenticated;
grant execute on function public.update_purchase_request_item(uuid, uuid, integer, text, numeric, text, numeric) to authenticated;
grant execute on function public.remove_purchase_request_item(uuid, uuid, integer) to authenticated;
grant execute on function public.submit_purchase_request(uuid, integer) to authenticated;
grant execute on function public.approve_technical_review(uuid, integer, text) to authenticated;
grant execute on function public.approve_financial_review(uuid, integer, text) to authenticated;
grant execute on function public.approve_executive_review(uuid, integer, text) to authenticated;
grant execute on function public.return_purchase_request(uuid, integer, text) to authenticated;
grant execute on function public.reject_purchase_request(uuid, integer, text) to authenticated;
grant execute on function public.cancel_purchase_request(uuid, integer) to authenticated;
grant execute on function public.update_procurement_approval_settings(numeric, text) to authenticated;
grant execute on function public.list_purchase_requests(text, uuid, text) to authenticated;
grant execute on function public.get_purchase_request(uuid) to authenticated;
grant execute on function public.list_purchase_request_items(uuid) to authenticated;
grant execute on function public.list_purchase_request_decisions(uuid) to authenticated;
grant execute on function public.get_procurement_approval_settings() to authenticated;
grant execute on function public.list_pending_approvals() to authenticated;
grant execute on function public.list_purchase_request_audit(uuid) to authenticated;
