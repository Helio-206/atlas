create table procurement.suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references identity.companies(id),
  name text not null,
  tax_number text,
  email text,
  phone text,
  address text,
  status text not null default 'active',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint suppliers_id_company_unique unique (id, company_id),
  constraint suppliers_name_check check (char_length(btrim(name)) between 1 and 200),
  constraint suppliers_tax_number_check check (tax_number is null or char_length(tax_number) <= 64),
  constraint suppliers_email_check check (email is null or char_length(email) <= 320),
  constraint suppliers_phone_check check (phone is null or char_length(phone) <= 80),
  constraint suppliers_address_check check (address is null or char_length(address) <= 1000),
  constraint suppliers_status_check check (status in ('active', 'inactive', 'blocked')),
  constraint suppliers_version_check check (version >= 1)
);

create unique index suppliers_company_tax_number_unique
  on procurement.suppliers (company_id, tax_number)
  where tax_number is not null;
create index suppliers_company_status_name_idx
  on procurement.suppliers (company_id, status, name);

create table procurement.quotations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references identity.companies(id),
  purchase_request_id uuid not null,
  supplier_id uuid not null,
  quotation_number text,
  currency text not null,
  subtotal numeric(18,2) not null default 0,
  tax_amount numeric(18,2) not null default 0,
  total numeric(18,2) not null default 0,
  valid_until date,
  delivery_days integer,
  payment_terms text,
  notes text,
  status text not null default 'draft',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint quotations_id_company_unique unique (id, company_id),
  constraint quotations_identity_unique unique (id, purchase_request_id, supplier_id, company_id),
  constraint quotations_request_company_fk foreign key (purchase_request_id, company_id)
    references procurement.purchase_requests(id, company_id),
  constraint quotations_supplier_company_fk foreign key (supplier_id, company_id)
    references procurement.suppliers(id, company_id),
  constraint quotations_currency_check check (currency in ('AOA','USD','EUR')),
  constraint quotations_subtotal_check check (subtotal >= 0),
  constraint quotations_tax_check check (tax_amount >= 0),
  constraint quotations_total_check check (total >= 0),
  constraint quotations_delivery_check check (delivery_days is null or delivery_days >= 0),
  constraint quotations_number_check check (quotation_number is null or char_length(quotation_number) <= 120),
  constraint quotations_payment_terms_check check (payment_terms is null or char_length(payment_terms) <= 1000),
  constraint quotations_notes_check check (notes is null or char_length(notes) <= 2000),
  constraint quotations_status_check check (status in ('draft','submitted','accepted','rejected','expired')),
  constraint quotations_version_check check (version >= 1)
);
create index quotations_request_created_idx on procurement.quotations (purchase_request_id, created_at);
create index quotations_company_status_idx on procurement.quotations (company_id, status, created_at desc);
create index quotations_supplier_idx on procurement.quotations (supplier_id, created_at desc);

create table procurement.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references procurement.quotations(id) on delete cascade,
  purchase_request_item_id uuid not null references procurement.purchase_request_items(id),
  description text not null,
  quantity numeric(18,4) not null,
  unit text not null,
  unit_price numeric(18,2) not null,
  total numeric(18,2) generated always as ((quantity * unit_price)::numeric(18,2)) stored,
  created_at timestamptz not null default now(),
  constraint quotation_items_quote_request_item_unique unique (quotation_id, purchase_request_item_id),
  constraint quotation_items_description_check check (char_length(btrim(description)) between 1 and 500),
  constraint quotation_items_quantity_check check (quantity > 0),
  constraint quotation_items_unit_check check (char_length(btrim(unit)) between 1 and 40),
  constraint quotation_items_price_check check (unit_price >= 0)
);
create index quotation_items_quote_idx on procurement.quotation_items (quotation_id, created_at);

create table procurement.supplier_selections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references identity.companies(id),
  purchase_request_id uuid not null,
  quotation_id uuid not null,
  supplier_id uuid not null,
  selected_by uuid not null references auth.users(id),
  justification text not null,
  selected_at timestamptz not null default now(),
  constraint supplier_selections_request_unique unique (purchase_request_id),
  constraint supplier_selections_request_company_fk foreign key (purchase_request_id, company_id)
    references procurement.purchase_requests(id, company_id),
  constraint supplier_selections_supplier_company_fk foreign key (supplier_id, company_id)
    references procurement.suppliers(id, company_id),
  constraint supplier_selections_quotation_identity_fk
    foreign key (quotation_id, purchase_request_id, supplier_id, company_id)
    references procurement.quotations(id, purchase_request_id, supplier_id, company_id),
  constraint supplier_selections_justification_check check (char_length(btrim(justification)) between 1 and 2000)
);
create index supplier_selections_company_selected_idx on procurement.supplier_selections (company_id, selected_at desc);

create or replace function platform.procurement_permissions()
returns text[] language plpgsql stable security definer set search_path = '' as $$
declare v_role text := platform.current_procurement_role();
begin
  case v_role
    when 'administrator' then return array[
      'Procurement.View','Procurement.Create','Procurement.EditOwn','Procurement.Submit',
      'Procurement.TechnicalApprove','Procurement.FinancialApprove','Procurement.ExecutiveApprove','Procurement.Cancel',
      'Procurement.SupplierView','Procurement.SupplierManage','Procurement.QuotationView','Procurement.QuotationManage','Procurement.SupplierSelect'
    ]::text[];
    when 'requester' then return array[
      'Procurement.View','Procurement.Create','Procurement.EditOwn','Procurement.Submit','Procurement.Cancel',
      'Procurement.SupplierView','Procurement.QuotationView'
    ]::text[];
    when 'technical_reviewer' then return array['Procurement.View','Procurement.TechnicalApprove','Procurement.SupplierView','Procurement.QuotationView']::text[];
    when 'financial_approver' then return array['Procurement.View','Procurement.FinancialApprove','Procurement.SupplierView','Procurement.QuotationView']::text[];
    when 'executive_approver' then return array['Procurement.View','Procurement.ExecutiveApprove','Procurement.SupplierView','Procurement.QuotationView']::text[];
    when 'procurement_officer' then return array[
      'Procurement.View','Procurement.SupplierView','Procurement.SupplierManage','Procurement.QuotationView','Procurement.QuotationManage','Procurement.SupplierSelect'
    ]::text[];
    else return array[]::text[];
  end case;
end; $$;

create or replace function platform.can_read_quotation(p_quotation_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from procurement.quotations q
    where q.id = p_quotation_id and identity.is_company_member(q.company_id)
  ) and platform.procurement_has_permission('Procurement.QuotationView');
$$;
revoke all on function platform.can_read_quotation(uuid) from public, anon;
grant execute on function platform.can_read_quotation(uuid) to authenticated;

create or replace function platform.calculate_quotation_totals(p_quotation_id uuid)
returns table(subtotal numeric,total numeric)
language plpgsql security definer set search_path = '' as $$
declare v_subtotal numeric(18,2); v_tax numeric(18,2);
begin
  select coalesce(sum(i.total),0)::numeric(18,2) into v_subtotal
  from procurement.quotation_items i where i.quotation_id = p_quotation_id;
  select q.tax_amount into v_tax from procurement.quotations q where q.id = p_quotation_id;
  if not found then raise exception using errcode='P0001',message='quotation_not_found'; end if;
  return query select v_subtotal,(v_subtotal+v_tax)::numeric(18,2);
end; $$;
revoke all on function platform.calculate_quotation_totals(uuid) from public, anon, authenticated;

create or replace function platform.apply_quotation_totals(p_quotation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_subtotal numeric; v_total numeric;
begin
  select t.subtotal,t.total into v_subtotal,v_total from platform.calculate_quotation_totals(p_quotation_id) t;
  update procurement.quotations set subtotal=v_subtotal,total=v_total where id=p_quotation_id;
end; $$;
revoke all on function platform.apply_quotation_totals(uuid) from public, anon, authenticated;

create or replace function platform.create_supplier(p_name text,p_tax_number text default null,p_email text default null,p_phone text default null,p_address text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_company uuid; v_user uuid:=auth.uid(); v_id uuid; v_tax text:=nullif(btrim(p_tax_number),'');
begin
  perform platform.require_procurement_permission('Procurement.SupplierManage');
  v_company:=platform.current_company_id();
  if nullif(btrim(p_name),'') is null or char_length(btrim(p_name))>200 then raise exception using errcode='22023',message='invalid_supplier_name'; end if;
  begin
    insert into procurement.suppliers(company_id,name,tax_number,email,phone,address,created_by)
    values(v_company,btrim(p_name),v_tax,nullif(btrim(p_email),''),nullif(btrim(p_phone),''),nullif(btrim(p_address),''),v_user)
    returning id into v_id;
  exception when unique_violation then raise exception using errcode='23505',message='supplier_tax_number_exists'; end;
  insert into audit.entries(company_id,user_id,action,module,resource_type,resource_id,metadata)
  values(v_company,v_user,'SupplierCreated','procurement','supplier',v_id,jsonb_build_object('status','active'));
  return v_id;
end; $$;

create or replace function platform.update_supplier(p_supplier_id uuid,p_expected_version integer,p_name text,p_tax_number text default null,p_email text default null,p_phone text default null,p_address text default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_company uuid; v_user uuid:=auth.uid(); v_current integer; v_new integer; v_tax text:=nullif(btrim(p_tax_number),'');
begin
  perform platform.require_procurement_permission('Procurement.SupplierManage'); v_company:=platform.current_company_id();
  select version into v_current from procurement.suppliers where id=p_supplier_id and company_id=v_company for update;
  if not found then raise exception using errcode='P0001',message='supplier_not_found'; end if;
  if v_current<>p_expected_version then raise exception using errcode='40001',message='supplier_version_conflict'; end if;
  if nullif(btrim(p_name),'') is null or char_length(btrim(p_name))>200 then raise exception using errcode='22023',message='invalid_supplier_name'; end if;
  begin
    update procurement.suppliers s set name=btrim(p_name),tax_number=v_tax,email=nullif(btrim(p_email),''),phone=nullif(btrim(p_phone),''),address=nullif(btrim(p_address),''),updated_at=now(),version=s.version+1
    where s.id=p_supplier_id and s.version=p_expected_version returning s.version into v_new;
  exception when unique_violation then raise exception using errcode='23505',message='supplier_tax_number_exists'; end;
  insert into audit.entries(company_id,user_id,action,module,resource_type,resource_id,metadata)
  values(v_company,v_user,'SupplierUpdated','procurement','supplier',p_supplier_id,jsonb_build_object('version',v_new));
  return v_new;
end; $$;

create or replace function platform.set_supplier_status(p_supplier_id uuid,p_expected_version integer,p_status text)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_company uuid; v_user uuid:=auth.uid(); v_current integer; v_new integer; v_action text;
begin
  perform platform.require_procurement_permission('Procurement.SupplierManage'); v_company:=platform.current_company_id();
  if p_status not in ('active','inactive','blocked') then raise exception using errcode='22023',message='invalid_supplier_status'; end if;
  select version into v_current from procurement.suppliers where id=p_supplier_id and company_id=v_company for update;
  if not found then raise exception using errcode='P0001',message='supplier_not_found'; end if;
  if v_current<>p_expected_version then raise exception using errcode='40001',message='supplier_version_conflict'; end if;
  update procurement.suppliers s set status=p_status,updated_at=now(),version=s.version+1
  where s.id=p_supplier_id and s.version=p_expected_version returning s.version into v_new;
  v_action:=case when p_status='blocked' then 'SupplierBlocked' else 'SupplierUpdated' end;
  insert into audit.entries(company_id,user_id,action,module,resource_type,resource_id,metadata)
  values(v_company,v_user,v_action,'procurement','supplier',p_supplier_id,jsonb_build_object('status',p_status,'version',v_new));
  return v_new;
end; $$;

create or replace function platform.create_quotation(
  p_purchase_request_id uuid,p_supplier_id uuid,p_quotation_number text,p_currency text,p_tax_amount numeric default 0,
  p_valid_until date default null,p_delivery_days integer default null,p_payment_terms text default null,p_notes text default null,p_items jsonb default '[]'::jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_company uuid; v_user uuid:=auth.uid(); v_quote uuid; v_item jsonb; v_pr_item procurement.purchase_request_items%rowtype; v_qty numeric; v_price numeric;
begin
  perform platform.require_procurement_permission('Procurement.QuotationManage'); v_company:=platform.current_company_id();
  if not exists(select 1 from procurement.purchase_requests r where r.id=p_purchase_request_id and r.company_id=v_company and r.status='approved') then raise exception using errcode='P0001',message='approved_purchase_request_required'; end if;
  if not exists(select 1 from procurement.suppliers s where s.id=p_supplier_id and s.company_id=v_company) then raise exception using errcode='P0001',message='supplier_not_found'; end if;
  if exists(select 1 from procurement.suppliers s where s.id=p_supplier_id and s.company_id=v_company and s.status='blocked') then raise exception using errcode='P0001',message='supplier_blocked'; end if;
  if p_currency not in ('AOA','USD','EUR') then raise exception using errcode='22023',message='invalid_quotation_currency'; end if;
  if p_tax_amount is null or p_tax_amount<0 then raise exception using errcode='22023',message='invalid_quotation_tax_amount'; end if;
  if p_delivery_days is not null and p_delivery_days<0 then raise exception using errcode='22023',message='invalid_delivery_days'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception using errcode='22023',message='invalid_quotation_items'; end if;
  insert into procurement.quotations(company_id,purchase_request_id,supplier_id,quotation_number,currency,tax_amount,total,valid_until,delivery_days,payment_terms,notes,created_by)
  values(v_company,p_purchase_request_id,p_supplier_id,nullif(btrim(p_quotation_number),''),p_currency,p_tax_amount,p_tax_amount,p_valid_until,p_delivery_days,nullif(btrim(p_payment_terms),''),nullif(btrim(p_notes),''),v_user)
  returning id into v_quote;
  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_pr_item from procurement.purchase_request_items i where i.id=(v_item->>'purchaseRequestItemId')::uuid and i.purchase_request_id=p_purchase_request_id;
    if not found then raise exception using errcode='P0001',message='purchase_request_item_not_found'; end if;
    v_qty:=(v_item->>'quantity')::numeric; v_price:=(v_item->>'unitPrice')::numeric;
    if v_qty is null or v_qty<=0 then raise exception using errcode='22023',message='invalid_quotation_item_quantity'; end if;
    if v_price is null or v_price<0 then raise exception using errcode='22023',message='invalid_quotation_item_unit_price'; end if;
    insert into procurement.quotation_items(quotation_id,purchase_request_item_id,description,quantity,unit,unit_price)
    values(v_quote,v_pr_item.id,coalesce(nullif(btrim(v_item->>'description'),''),v_pr_item.description),v_qty,coalesce(nullif(btrim(v_item->>'unit'),''),v_pr_item.unit),v_price);
  end loop;
  perform platform.apply_quotation_totals(v_quote);
  insert into audit.entries(company_id,user_id,action,module,resource_type,resource_id,metadata)
  values(v_company,v_user,'QuotationCreated','procurement','quotation',v_quote,jsonb_build_object('purchase_request_id',p_purchase_request_id,'supplier_id',p_supplier_id));
  return v_quote;
end; $$;

create or replace function platform.update_quotation(
  p_quotation_id uuid,p_expected_version integer,p_supplier_id uuid,p_quotation_number text,p_currency text,p_tax_amount numeric,
  p_valid_until date,p_delivery_days integer,p_payment_terms text,p_notes text
) returns integer language plpgsql security definer set search_path = '' as $$
declare v_company uuid; v_user uuid:=auth.uid(); v_q procurement.quotations%rowtype; v_new integer;
begin
  perform platform.require_procurement_permission('Procurement.QuotationManage'); v_company:=platform.current_company_id();
  select * into v_q from procurement.quotations q where q.id=p_quotation_id and q.company_id=v_company for update;
  if not found then raise exception using errcode='P0001',message='quotation_not_found'; end if;
  if v_q.version<>p_expected_version then raise exception using errcode='40001',message='quotation_version_conflict'; end if;
  if v_q.status<>'draft' then raise exception using errcode='P0001',message='quotation_not_editable'; end if;
  if not exists(select 1 from procurement.purchase_requests r where r.id=v_q.purchase_request_id and r.company_id=v_company and r.status='approved') then raise exception using errcode='P0001',message='approved_purchase_request_required'; end if;
  if not exists(select 1 from procurement.suppliers s where s.id=p_supplier_id and s.company_id=v_company) then raise exception using errcode='P0001',message='supplier_not_found'; end if;
  if exists(select 1 from procurement.suppliers s where s.id=p_supplier_id and s.company_id=v_company and s.status='blocked') then raise exception using errcode='P0001',message='supplier_blocked'; end if;
  if p_currency not in ('AOA','USD','EUR') then raise exception using errcode='22023',message='invalid_quotation_currency'; end if;
  if p_tax_amount is null or p_tax_amount<0 then raise exception using errcode='22023',message='invalid_quotation_tax_amount'; end if;
  if p_delivery_days is not null and p_delivery_days<0 then raise exception using errcode='22023',message='invalid_delivery_days'; end if;
  update procurement.quotations q set supplier_id=p_supplier_id,quotation_number=nullif(btrim(p_quotation_number),''),currency=p_currency,tax_amount=p_tax_amount,valid_until=p_valid_until,delivery_days=p_delivery_days,payment_terms=nullif(btrim(p_payment_terms),''),notes=nullif(btrim(p_notes),''),updated_at=now(),version=q.version+1
  where q.id=p_quotation_id and q.version=p_expected_version returning q.version into v_new;
  perform platform.apply_quotation_totals(p_quotation_id);
  insert into audit.entries(company_id,user_id,action,module,resource_type,resource_id,metadata)
  values(v_company,v_user,'QuotationUpdated','procurement','quotation',p_quotation_id,jsonb_build_object('change','fields','version',v_new));
  return v_new;
end; $$;

create or replace function platform.add_quotation_item(p_quotation_id uuid,p_expected_version integer,p_purchase_request_item_id uuid,p_description text,p_quantity numeric,p_unit text,p_unit_price numeric)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_company uuid; v_user uuid:=auth.uid(); v_q procurement.quotations%rowtype; v_new integer;
begin
  perform platform.require_procurement_permission('Procurement.QuotationManage'); v_company:=platform.current_company_id();
  select * into v_q from procurement.quotations q where q.id=p_quotation_id and q.company_id=v_company for update;
  if not found then raise exception using errcode='P0001',message='quotation_not_found'; end if;
  if v_q.version<>p_expected_version then raise exception using errcode='40001',message='quotation_version_conflict'; end if;
  if v_q.status<>'draft' then raise exception using errcode='P0001',message='quotation_not_editable'; end if;
  if not exists(select 1 from procurement.purchase_requests r where r.id=v_q.purchase_request_id and r.company_id=v_company and r.status='approved') then raise exception using errcode='P0001',message='approved_purchase_request_required'; end if;
  if exists(select 1 from procurement.suppliers s where s.id=v_q.supplier_id and s.company_id=v_company and s.status='blocked') then raise exception using errcode='P0001',message='supplier_blocked'; end if;
  if not exists(select 1 from procurement.purchase_request_items i where i.id=p_purchase_request_item_id and i.purchase_request_id=v_q.purchase_request_id) then raise exception using errcode='P0001',message='purchase_request_item_not_found'; end if;
  if nullif(btrim(p_description),'') is null then raise exception using errcode='22023',message='invalid_quotation_item_description'; end if;
  if nullif(btrim(p_unit),'') is null then raise exception using errcode='22023',message='invalid_quotation_item_unit'; end if;
  if p_quantity is null or p_quantity<=0 then raise exception using errcode='22023',message='invalid_quotation_item_quantity'; end if;
  if p_unit_price is null or p_unit_price<0 then raise exception using errcode='22023',message='invalid_quotation_item_unit_price'; end if;
  insert into procurement.quotation_items(quotation_id,purchase_request_item_id,description,quantity,unit,unit_price)
  values(p_quotation_id,p_purchase_request_item_id,btrim(p_description),p_quantity,btrim(p_unit),p_unit_price);
  perform platform.apply_quotation_totals(p_quotation_id);
  update procurement.quotations q set updated_at=now(),version=q.version+1 where q.id=p_quotation_id and q.version=p_expected_version returning q.version into v_new;
  insert into audit.entries(company_id,user_id,action,module,resource_type,resource_id,metadata)
  values(v_company,v_user,'QuotationUpdated','procurement','quotation',p_quotation_id,jsonb_build_object('change','item_added','version',v_new));
  return v_new;
end; $$;

create or replace function platform.update_quotation_item(p_quotation_id uuid,p_item_id uuid,p_expected_version integer,p_description text,p_quantity numeric,p_unit text,p_unit_price numeric)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_company uuid; v_user uuid:=auth.uid(); v_q procurement.quotations%rowtype; v_new integer;
begin
  perform platform.require_procurement_permission('Procurement.QuotationManage'); v_company:=platform.current_company_id();
  select * into v_q from procurement.quotations q where q.id=p_quotation_id and q.company_id=v_company for update;
  if not found then raise exception using errcode='P0001',message='quotation_not_found'; end if;
  if v_q.version<>p_expected_version then raise exception using errcode='40001',message='quotation_version_conflict'; end if;
  if v_q.status<>'draft' then raise exception using errcode='P0001',message='quotation_not_editable'; end if;
  if not exists(select 1 from procurement.purchase_requests r where r.id=v_q.purchase_request_id and r.company_id=v_company and r.status='approved') then raise exception using errcode='P0001',message='approved_purchase_request_required'; end if;
  if exists(select 1 from procurement.suppliers s where s.id=v_q.supplier_id and s.company_id=v_company and s.status='blocked') then raise exception using errcode='P0001',message='supplier_blocked'; end if;
  if nullif(btrim(p_description),'') is null or nullif(btrim(p_unit),'') is null then raise exception using errcode='22023',message='invalid_quotation_item'; end if;
  if p_quantity is null or p_quantity<=0 then raise exception using errcode='22023',message='invalid_quotation_item_quantity'; end if;
  if p_unit_price is null or p_unit_price<0 then raise exception using errcode='22023',message='invalid_quotation_item_unit_price'; end if;
  update procurement.quotation_items i set description=btrim(p_description),quantity=p_quantity,unit=btrim(p_unit),unit_price=p_unit_price where i.id=p_item_id and i.quotation_id=p_quotation_id;
  if not found then raise exception using errcode='P0001',message='quotation_item_not_found'; end if;
  perform platform.apply_quotation_totals(p_quotation_id);
  update procurement.quotations q set updated_at=now(),version=q.version+1 where q.id=p_quotation_id and q.version=p_expected_version returning q.version into v_new;
  insert into audit.entries(company_id,user_id,action,module,resource_type,resource_id,metadata)
  values(v_company,v_user,'QuotationUpdated','procurement','quotation',p_quotation_id,jsonb_build_object('change','item_updated','version',v_new));
  return v_new;
end; $$;

create or replace function platform.remove_quotation_item(p_quotation_id uuid,p_item_id uuid,p_expected_version integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_company uuid; v_user uuid:=auth.uid(); v_q procurement.quotations%rowtype; v_new integer;
begin
  perform platform.require_procurement_permission('Procurement.QuotationManage'); v_company:=platform.current_company_id();
  select * into v_q from procurement.quotations q where q.id=p_quotation_id and q.company_id=v_company for update;
  if not found then raise exception using errcode='P0001',message='quotation_not_found'; end if;
  if v_q.version<>p_expected_version then raise exception using errcode='40001',message='quotation_version_conflict'; end if;
  if v_q.status<>'draft' then raise exception using errcode='P0001',message='quotation_not_editable'; end if;
  if not exists(select 1 from procurement.purchase_requests r where r.id=v_q.purchase_request_id and r.company_id=v_company and r.status='approved') then raise exception using errcode='P0001',message='approved_purchase_request_required'; end if;
  if exists(select 1 from procurement.suppliers s where s.id=v_q.supplier_id and s.company_id=v_company and s.status='blocked') then raise exception using errcode='P0001',message='supplier_blocked'; end if;
  delete from procurement.quotation_items i where i.id=p_item_id and i.quotation_id=p_quotation_id;
  if not found then raise exception using errcode='P0001',message='quotation_item_not_found'; end if;
  perform platform.apply_quotation_totals(p_quotation_id);
  update procurement.quotations q set updated_at=now(),version=q.version+1 where q.id=p_quotation_id and q.version=p_expected_version returning q.version into v_new;
  insert into audit.entries(company_id,user_id,action,module,resource_type,resource_id,metadata)
  values(v_company,v_user,'QuotationUpdated','procurement','quotation',p_quotation_id,jsonb_build_object('change','item_removed','version',v_new));
  return v_new;
end; $$;

create or replace function platform.submit_quotation(p_quotation_id uuid,p_expected_version integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_company uuid; v_user uuid:=auth.uid(); v_q procurement.quotations%rowtype; v_new integer;
begin
  perform platform.require_procurement_permission('Procurement.QuotationManage'); v_company:=platform.current_company_id();
  select * into v_q from procurement.quotations q where q.id=p_quotation_id and q.company_id=v_company for update;
  if not found then raise exception using errcode='P0001',message='quotation_not_found'; end if;
  if v_q.version<>p_expected_version then raise exception using errcode='40001',message='quotation_version_conflict'; end if;
  if v_q.status<>'draft' then raise exception using errcode='P0001',message='quotation_not_submittable'; end if;
  if not exists(select 1 from procurement.purchase_requests r where r.id=v_q.purchase_request_id and r.company_id=v_company and r.status='approved') then raise exception using errcode='P0001',message='approved_purchase_request_required'; end if;
  if exists(select 1 from procurement.suppliers s where s.id=v_q.supplier_id and s.company_id=v_company and s.status='blocked') then raise exception using errcode='P0001',message='supplier_blocked'; end if;
  if not exists(select 1 from procurement.quotation_items i where i.quotation_id=p_quotation_id) then raise exception using errcode='P0001',message='quotation_items_required'; end if;
  perform platform.apply_quotation_totals(p_quotation_id);
  update procurement.quotations q set status='submitted',updated_at=now(),version=q.version+1 where q.id=p_quotation_id and q.version=p_expected_version returning q.version into v_new;
  insert into audit.entries(company_id,user_id,action,module,resource_type,resource_id,metadata)
  values(v_company,v_user,'QuotationSubmitted','procurement','quotation',p_quotation_id,jsonb_build_object('purchase_request_id',v_q.purchase_request_id,'version',v_new));
  return v_new;
end; $$;

create or replace function platform.select_supplier(p_purchase_request_id uuid,p_quotation_id uuid,p_expected_request_version integer,p_expected_quotation_version integer,p_justification text)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_company uuid; v_user uuid:=auth.uid(); v_r procurement.purchase_requests%rowtype; v_q procurement.quotations%rowtype; v_supplier_status text; v_new integer; v_selection uuid;
begin
  perform platform.require_procurement_permission('Procurement.SupplierSelect'); v_company:=platform.current_company_id();
  select * into v_r from procurement.purchase_requests r where r.id=p_purchase_request_id and r.company_id=v_company for update;
  if not found then raise exception using errcode='P0001',message='purchase_request_not_found'; end if;
  if v_r.version<>p_expected_request_version then raise exception using errcode='40001',message='purchase_request_version_conflict'; end if;
  if v_r.status<>'approved' then raise exception using errcode='P0001',message='approved_purchase_request_required'; end if;
  if nullif(btrim(p_justification),'') is null then raise exception using errcode='22023',message='supplier_selection_justification_required'; end if;
  select * into v_q from procurement.quotations q where q.id=p_quotation_id and q.purchase_request_id=p_purchase_request_id and q.company_id=v_company for update;
  if not found then raise exception using errcode='P0001',message='quotation_not_found'; end if;
  if v_q.version<>p_expected_quotation_version then raise exception using errcode='40001',message='quotation_version_conflict'; end if;
  if v_q.status<>'submitted' then raise exception using errcode='P0001',message='submitted_quotation_required'; end if;
  select status into v_supplier_status from procurement.suppliers s where s.id=v_q.supplier_id and s.company_id=v_company;
  if not found then raise exception using errcode='P0001',message='supplier_not_found'; end if;
  if v_supplier_status='blocked' then raise exception using errcode='P0001',message='supplier_blocked'; end if;
  if exists(select 1 from procurement.supplier_selections s where s.purchase_request_id=p_purchase_request_id) then raise exception using errcode='P0001',message='supplier_already_selected'; end if;
  insert into procurement.supplier_selections(company_id,purchase_request_id,quotation_id,supplier_id,selected_by,justification)
  values(v_company,p_purchase_request_id,p_quotation_id,v_q.supplier_id,v_user,btrim(p_justification)) returning id into v_selection;
  update procurement.quotations q set status='accepted',updated_at=now(),version=q.version+1 where q.id=p_quotation_id and q.version=p_expected_quotation_version;
  update procurement.purchase_requests r set status='supplier_selected',current_approver_role=null,updated_at=now(),version=r.version+1
  where r.id=p_purchase_request_id and r.version=p_expected_request_version returning r.version into v_new;
  insert into audit.entries(company_id,user_id,action,module,resource_type,resource_id,metadata)
  values(v_company,v_user,'SupplierSelected','procurement','purchase_request',p_purchase_request_id,
    jsonb_build_object('selection_id',v_selection,'quotation_id',p_quotation_id,'supplier_id',v_q.supplier_id,'version',v_new));
  return v_new;
end; $$;

create or replace function platform.list_suppliers(p_status_filter text default null,p_search_filter text default null)
returns table(id uuid,name text,tax_number text,email text,phone text,address text,status text,created_at timestamptz,updated_at timestamptz,version integer)
language plpgsql stable security definer set search_path = '' as $$
declare v_company uuid;
begin
  perform platform.require_procurement_permission('Procurement.SupplierView'); v_company:=platform.current_company_id();
  return query select s.id,s.name,s.tax_number,s.email,s.phone,s.address,s.status,s.created_at,s.updated_at,s.version
  from procurement.suppliers s where s.company_id=v_company and (p_status_filter is null or s.status=p_status_filter)
    and (p_search_filter is null or s.name ilike '%'||p_search_filter||'%' or coalesce(s.tax_number,'') ilike '%'||p_search_filter||'%') order by s.name,s.id;
end; $$;

create or replace function platform.get_supplier(p_supplier_id uuid)
returns table(id uuid,name text,tax_number text,email text,phone text,address text,status text,created_by uuid,created_at timestamptz,updated_at timestamptz,version integer)
language plpgsql stable security definer set search_path = '' as $$
declare v_company uuid;
begin
  perform platform.require_procurement_permission('Procurement.SupplierView'); v_company:=platform.current_company_id();
  return query select s.id,s.name,s.tax_number,s.email,s.phone,s.address,s.status,s.created_by,s.created_at,s.updated_at,s.version from procurement.suppliers s where s.id=p_supplier_id and s.company_id=v_company;
end; $$;

create or replace function platform.list_purchase_request_quotations(p_purchase_request_id uuid)
returns table(id uuid,supplier_id uuid,supplier_name text,supplier_status text,quotation_number text,currency text,subtotal numeric,tax_amount numeric,total numeric,valid_until date,delivery_days integer,payment_terms text,notes text,status text,coverage_count bigint,request_item_count bigint,coverage_percent numeric,created_at timestamptz,updated_at timestamptz,version integer)
language plpgsql stable security definer set search_path = '' as $$
declare v_company uuid;
begin
  perform platform.require_procurement_permission('Procurement.QuotationView'); v_company:=platform.current_company_id();
  if not exists(select 1 from procurement.purchase_requests r where r.id=p_purchase_request_id and r.company_id=v_company) then raise exception using errcode='P0001',message='purchase_request_not_found'; end if;
  return query
  select q.id,q.supplier_id,s.name,s.status,q.quotation_number,q.currency,q.subtotal,q.tax_amount,q.total,q.valid_until,q.delivery_days,q.payment_terms,q.notes,q.status,
    count(distinct qi.purchase_request_item_id),count(distinct pri.id),
    case when count(distinct pri.id)=0 then 0 else round((count(distinct qi.purchase_request_item_id)::numeric/count(distinct pri.id)::numeric)*100,2) end,
    q.created_at,q.updated_at,q.version
  from procurement.quotations q join procurement.suppliers s on s.id=q.supplier_id
  left join procurement.quotation_items qi on qi.quotation_id=q.id
  left join procurement.purchase_request_items pri on pri.purchase_request_id=q.purchase_request_id
  where q.purchase_request_id=p_purchase_request_id and q.company_id=v_company
  group by q.id,s.name,s.status order by q.created_at,q.id;
end; $$;

create or replace function platform.get_quotation(p_quotation_id uuid)
returns table(id uuid,purchase_request_id uuid,supplier_id uuid,supplier_name text,supplier_status text,quotation_number text,currency text,subtotal numeric,tax_amount numeric,total numeric,valid_until date,delivery_days integer,payment_terms text,notes text,status text,created_by uuid,created_at timestamptz,updated_at timestamptz,version integer)
language plpgsql stable security definer set search_path = '' as $$
declare v_company uuid;
begin
  perform platform.require_procurement_permission('Procurement.QuotationView'); v_company:=platform.current_company_id();
  return query select q.id,q.purchase_request_id,q.supplier_id,s.name,s.status,q.quotation_number,q.currency,q.subtotal,q.tax_amount,q.total,q.valid_until,q.delivery_days,q.payment_terms,q.notes,q.status,q.created_by,q.created_at,q.updated_at,q.version
  from procurement.quotations q join procurement.suppliers s on s.id=q.supplier_id where q.id=p_quotation_id and q.company_id=v_company;
end; $$;

create or replace function platform.list_quotation_items(p_quotation_id uuid)
returns table(id uuid,purchase_request_item_id uuid,description text,quantity numeric,unit text,unit_price numeric,total numeric,created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_company uuid;
begin
  perform platform.require_procurement_permission('Procurement.QuotationView'); v_company:=platform.current_company_id();
  if not exists(select 1 from procurement.quotations q where q.id=p_quotation_id and q.company_id=v_company) then raise exception using errcode='P0001',message='quotation_not_found'; end if;
  return query select i.id,i.purchase_request_item_id,i.description,i.quantity,i.unit,i.unit_price,i.total,i.created_at from procurement.quotation_items i where i.quotation_id=p_quotation_id order by i.created_at,i.id;
end; $$;

create or replace function platform.get_supplier_selection(p_purchase_request_id uuid)
returns table(id uuid,quotation_id uuid,supplier_id uuid,supplier_name text,quotation_number text,currency text,total numeric,justification text,selected_by uuid,selected_by_name text,selected_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_company uuid;
begin
  perform platform.require_procurement_permission('Procurement.QuotationView'); v_company:=platform.current_company_id();
  return query select ss.id,ss.quotation_id,ss.supplier_id,s.name,q.quotation_number,q.currency,q.total,ss.justification,ss.selected_by,p.full_name,ss.selected_at
  from procurement.supplier_selections ss join procurement.suppliers s on s.id=ss.supplier_id join procurement.quotations q on q.id=ss.quotation_id left join identity.profiles p on p.id=ss.selected_by
  where ss.purchase_request_id=p_purchase_request_id and ss.company_id=v_company;
end; $$;

create or replace function platform.cancel_purchase_request(p_purchase_request_id uuid,p_expected_version integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_company uuid; v_role text; v_r procurement.purchase_requests%rowtype; v_new integer;
begin
  perform platform.require_procurement_permission('Procurement.Cancel'); v_company:=platform.current_company_id(); v_role:=platform.current_procurement_role();
  select * into v_r from procurement.purchase_requests r where r.id=p_purchase_request_id and r.company_id=v_company for update;
  if not found then raise exception using errcode='P0001',message='purchase_request_not_found'; end if;
  if v_r.version<>p_expected_version then raise exception using errcode='40001',message='purchase_request_version_conflict'; end if;
  if v_r.requested_by<>v_user and v_role<>'administrator' then raise exception using errcode='42501',message='purchase_request_cancel_forbidden'; end if;
  if v_r.status in ('approved','supplier_selected','rejected','cancelled') then raise exception using errcode='P0001',message='purchase_request_not_cancellable'; end if;
  update procurement.purchase_requests r set status='cancelled',current_approver_role=null,updated_at=now(),version=r.version+1 where r.id=p_purchase_request_id and r.version=p_expected_version returning r.version into v_new;
  insert into audit.entries(company_id,user_id,action,module,resource_type,resource_id,metadata)
  values(v_company,v_user,'PurchaseRequestCancelled','procurement','purchase_request',p_purchase_request_id,jsonb_build_object('from_status',v_r.status,'to_status','cancelled','version',v_new));
  return v_new;
end; $$;

alter table procurement.suppliers enable row level security;
alter table procurement.quotations enable row level security;
alter table procurement.quotation_items enable row level security;
alter table procurement.supplier_selections enable row level security;
revoke all on procurement.suppliers,procurement.quotations,procurement.quotation_items,procurement.supplier_selections from anon;
grant select on procurement.suppliers,procurement.quotations,procurement.quotation_items,procurement.supplier_selections to authenticated;
revoke insert,update,delete,truncate,references,trigger on procurement.suppliers,procurement.quotations,procurement.quotation_items,procurement.supplier_selections from authenticated;

create policy suppliers_select_company on procurement.suppliers for select to authenticated
using(identity.is_company_member(company_id) and platform.procurement_has_permission('Procurement.SupplierView'));
create policy quotations_select_company on procurement.quotations for select to authenticated
using(identity.is_company_member(company_id) and platform.procurement_has_permission('Procurement.QuotationView'));
create policy quotation_items_select_company on procurement.quotation_items for select to authenticated
using(platform.can_read_quotation(quotation_id));
create policy supplier_selections_select_company on procurement.supplier_selections for select to authenticated
using(identity.is_company_member(company_id) and platform.procurement_has_permission('Procurement.QuotationView'));

create or replace function public.create_supplier(name text,tax_number text default null,email text default null,phone text default null,address text default null)
returns uuid language sql security invoker set search_path='' as $$select platform.create_supplier(name,tax_number,email,phone,address);$$;
create or replace function public.update_supplier(supplier_id uuid,expected_version integer,name text,tax_number text default null,email text default null,phone text default null,address text default null)
returns integer language sql security invoker set search_path='' as $$select platform.update_supplier(supplier_id,expected_version,name,tax_number,email,phone,address);$$;
create or replace function public.activate_supplier(supplier_id uuid,expected_version integer) returns integer language sql security invoker set search_path='' as $$select platform.set_supplier_status(supplier_id,expected_version,'active');$$;
create or replace function public.deactivate_supplier(supplier_id uuid,expected_version integer) returns integer language sql security invoker set search_path='' as $$select platform.set_supplier_status(supplier_id,expected_version,'inactive');$$;
create or replace function public.block_supplier(supplier_id uuid,expected_version integer) returns integer language sql security invoker set search_path='' as $$select platform.set_supplier_status(supplier_id,expected_version,'blocked');$$;
create or replace function public.list_suppliers(status_filter text default null,search_filter text default null)
returns table(id uuid,name text,tax_number text,email text,phone text,address text,status text,created_at timestamptz,updated_at timestamptz,version integer)
language sql stable security invoker set search_path='' as $$select * from platform.list_suppliers(status_filter,search_filter);$$;
create or replace function public.get_supplier(supplier_id uuid)
returns table(id uuid,name text,tax_number text,email text,phone text,address text,status text,created_by uuid,created_at timestamptz,updated_at timestamptz,version integer)
language sql stable security invoker set search_path='' as $$select * from platform.get_supplier(supplier_id);$$;

create or replace function public.create_quotation(purchase_request_id uuid,supplier_id uuid,quotation_number text,currency text,tax_amount numeric default 0,valid_until date default null,delivery_days integer default null,payment_terms text default null,notes text default null,items jsonb default '[]'::jsonb)
returns uuid language sql security invoker set search_path='' as $$select platform.create_quotation(purchase_request_id,supplier_id,quotation_number,currency,tax_amount,valid_until,delivery_days,payment_terms,notes,items);$$;
create or replace function public.update_quotation(quotation_id uuid,expected_version integer,supplier_id uuid,quotation_number text,currency text,tax_amount numeric,valid_until date,delivery_days integer,payment_terms text,notes text)
returns integer language sql security invoker set search_path='' as $$select platform.update_quotation(quotation_id,expected_version,supplier_id,quotation_number,currency,tax_amount,valid_until,delivery_days,payment_terms,notes);$$;
create or replace function public.add_quotation_item(quotation_id uuid,expected_version integer,purchase_request_item_id uuid,description text,quantity numeric,unit text,unit_price numeric)
returns integer language sql security invoker set search_path='' as $$select platform.add_quotation_item(quotation_id,expected_version,purchase_request_item_id,description,quantity,unit,unit_price);$$;
create or replace function public.update_quotation_item(quotation_id uuid,item_id uuid,expected_version integer,description text,quantity numeric,unit text,unit_price numeric)
returns integer language sql security invoker set search_path='' as $$select platform.update_quotation_item(quotation_id,item_id,expected_version,description,quantity,unit,unit_price);$$;
create or replace function public.remove_quotation_item(quotation_id uuid,item_id uuid,expected_version integer)
returns integer language sql security invoker set search_path='' as $$select platform.remove_quotation_item(quotation_id,item_id,expected_version);$$;
create or replace function public.submit_quotation(quotation_id uuid,expected_version integer)
returns integer language sql security invoker set search_path='' as $$select platform.submit_quotation(quotation_id,expected_version);$$;
create or replace function public.list_purchase_request_quotations(purchase_request_id uuid)
returns table(id uuid,supplier_id uuid,supplier_name text,supplier_status text,quotation_number text,currency text,subtotal numeric,tax_amount numeric,total numeric,valid_until date,delivery_days integer,payment_terms text,notes text,status text,coverage_count bigint,request_item_count bigint,coverage_percent numeric,created_at timestamptz,updated_at timestamptz,version integer)
language sql stable security invoker set search_path='' as $$select * from platform.list_purchase_request_quotations(purchase_request_id);$$;
create or replace function public.get_quotation(quotation_id uuid)
returns table(id uuid,purchase_request_id uuid,supplier_id uuid,supplier_name text,supplier_status text,quotation_number text,currency text,subtotal numeric,tax_amount numeric,total numeric,valid_until date,delivery_days integer,payment_terms text,notes text,status text,created_by uuid,created_at timestamptz,updated_at timestamptz,version integer)
language sql stable security invoker set search_path='' as $$select * from platform.get_quotation(quotation_id);$$;
create or replace function public.list_quotation_items(quotation_id uuid)
returns table(id uuid,purchase_request_item_id uuid,description text,quantity numeric,unit text,unit_price numeric,total numeric,created_at timestamptz)
language sql stable security invoker set search_path='' as $$select * from platform.list_quotation_items(quotation_id);$$;
create or replace function public.get_supplier_selection(purchase_request_id uuid)
returns table(id uuid,quotation_id uuid,supplier_id uuid,supplier_name text,quotation_number text,currency text,total numeric,justification text,selected_by uuid,selected_by_name text,selected_at timestamptz)
language sql stable security invoker set search_path='' as $$select * from platform.get_supplier_selection(purchase_request_id);$$;
create or replace function public.select_supplier(purchase_request_id uuid,quotation_id uuid,expected_request_version integer,expected_quotation_version integer,justification text)
returns integer language sql security invoker set search_path='' as $$select platform.select_supplier(purchase_request_id,quotation_id,expected_request_version,expected_quotation_version,justification);$$;

revoke all on function platform.create_supplier(text,text,text,text,text),platform.update_supplier(uuid,integer,text,text,text,text,text),platform.set_supplier_status(uuid,integer,text),platform.create_quotation(uuid,uuid,text,text,numeric,date,integer,text,text,jsonb),platform.update_quotation(uuid,integer,uuid,text,text,numeric,date,integer,text,text),platform.add_quotation_item(uuid,integer,uuid,text,numeric,text,numeric),platform.update_quotation_item(uuid,uuid,integer,text,numeric,text,numeric),platform.remove_quotation_item(uuid,uuid,integer),platform.submit_quotation(uuid,integer),platform.select_supplier(uuid,uuid,integer,integer,text),platform.list_suppliers(text,text),platform.get_supplier(uuid),platform.list_purchase_request_quotations(uuid),platform.get_quotation(uuid),platform.list_quotation_items(uuid),platform.get_supplier_selection(uuid) from public,anon;
grant execute on function platform.create_supplier(text,text,text,text,text),platform.update_supplier(uuid,integer,text,text,text,text,text),platform.set_supplier_status(uuid,integer,text),platform.create_quotation(uuid,uuid,text,text,numeric,date,integer,text,text,jsonb),platform.update_quotation(uuid,integer,uuid,text,text,numeric,date,integer,text,text),platform.add_quotation_item(uuid,integer,uuid,text,numeric,text,numeric),platform.update_quotation_item(uuid,uuid,integer,text,numeric,text,numeric),platform.remove_quotation_item(uuid,uuid,integer),platform.submit_quotation(uuid,integer),platform.select_supplier(uuid,uuid,integer,integer,text),platform.list_suppliers(text,text),platform.get_supplier(uuid),platform.list_purchase_request_quotations(uuid),platform.get_quotation(uuid),platform.list_quotation_items(uuid),platform.get_supplier_selection(uuid) to authenticated;

revoke all on function public.create_supplier(text,text,text,text,text),public.update_supplier(uuid,integer,text,text,text,text,text),public.activate_supplier(uuid,integer),public.deactivate_supplier(uuid,integer),public.block_supplier(uuid,integer),public.list_suppliers(text,text),public.get_supplier(uuid),public.create_quotation(uuid,uuid,text,text,numeric,date,integer,text,text,jsonb),public.update_quotation(uuid,integer,uuid,text,text,numeric,date,integer,text,text),public.add_quotation_item(uuid,integer,uuid,text,numeric,text,numeric),public.update_quotation_item(uuid,uuid,integer,text,numeric,text,numeric),public.remove_quotation_item(uuid,uuid,integer),public.submit_quotation(uuid,integer),public.list_purchase_request_quotations(uuid),public.get_quotation(uuid),public.list_quotation_items(uuid),public.get_supplier_selection(uuid),public.select_supplier(uuid,uuid,integer,integer,text) from public,anon;
grant execute on function public.create_supplier(text,text,text,text,text),public.update_supplier(uuid,integer,text,text,text,text,text),public.activate_supplier(uuid,integer),public.deactivate_supplier(uuid,integer),public.block_supplier(uuid,integer),public.list_suppliers(text,text),public.get_supplier(uuid),public.create_quotation(uuid,uuid,text,text,numeric,date,integer,text,text,jsonb),public.update_quotation(uuid,integer,uuid,text,text,numeric,date,integer,text,text),public.add_quotation_item(uuid,integer,uuid,text,numeric,text,numeric),public.update_quotation_item(uuid,uuid,integer,text,numeric,text,numeric),public.remove_quotation_item(uuid,uuid,integer),public.submit_quotation(uuid,integer),public.list_purchase_request_quotations(uuid),public.get_quotation(uuid),public.list_quotation_items(uuid),public.get_supplier_selection(uuid),public.select_supplier(uuid,uuid,integer,integer,text) to authenticated;