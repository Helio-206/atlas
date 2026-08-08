alter type procurement.purchase_request_status add value if not exists 'ordered';
alter type procurement.purchase_request_status add value if not exists 'partially_received';
alter type procurement.purchase_request_status add value if not exists 'received';

create table procurement.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references identity.companies(id),
  purchase_request_id uuid not null,
  supplier_id uuid not null,
  quotation_id uuid not null,
  order_number text not null,
  currency text not null,
  subtotal numeric(18,2) not null,
  tax_amount numeric(18,2) not null,
  total numeric(18,2) not null,
  status text not null default 'draft',
  issued_by uuid not null references auth.users(id),
  issued_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint purchase_orders_id_company_unique unique (id, company_id),
  constraint purchase_orders_company_number_unique unique (company_id, order_number),
  constraint purchase_orders_request_company_fk foreign key (purchase_request_id, company_id)
    references procurement.purchase_requests(id, company_id),
  constraint purchase_orders_supplier_company_fk foreign key (supplier_id, company_id)
    references procurement.suppliers(id, company_id),
  constraint purchase_orders_quotation_identity_fk
    foreign key (quotation_id, purchase_request_id, supplier_id, company_id)
    references procurement.quotations(id, purchase_request_id, supplier_id, company_id),
  constraint purchase_orders_currency_check check (currency in ('AOA','USD','EUR')),
  constraint purchase_orders_subtotal_check check (subtotal >= 0),
  constraint purchase_orders_tax_check check (tax_amount >= 0),
  constraint purchase_orders_total_check check (total >= 0),
  constraint purchase_orders_status_check
    check (status in ('draft','issued','partially_received','received','cancelled')),
  constraint purchase_orders_version_check check (version >= 1)
);

create unique index purchase_orders_one_active_per_request_idx
  on procurement.purchase_orders (purchase_request_id)
  where status <> 'cancelled';
create index purchase_orders_company_status_idx
  on procurement.purchase_orders (company_id, status, created_at desc);
create index purchase_orders_supplier_idx
  on procurement.purchase_orders (supplier_id, created_at desc);

create table procurement.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references procurement.purchase_orders(id),
  purchase_request_item_id uuid not null references procurement.purchase_request_items(id),
  description text not null,
  quantity numeric(18,4) not null,
  unit text not null,
  unit_price numeric(18,2) not null,
  total numeric(18,2) generated always as ((quantity * unit_price)::numeric(18,2)) stored,
  created_at timestamptz not null default now(),
  constraint purchase_order_items_id_order_unique unique (id, purchase_order_id),
  constraint purchase_order_items_request_item_unique unique (purchase_order_id, purchase_request_item_id),
  constraint purchase_order_items_description_check check (char_length(btrim(description)) between 1 and 500),
  constraint purchase_order_items_quantity_check check (quantity > 0),
  constraint purchase_order_items_unit_check check (char_length(btrim(unit)) between 1 and 40),
  constraint purchase_order_items_price_check check (unit_price >= 0)
);
create index purchase_order_items_order_idx
  on procurement.purchase_order_items (purchase_order_id, created_at);

create table procurement.goods_receipts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references identity.companies(id),
  purchase_order_id uuid not null,
  receipt_number text not null,
  received_by uuid not null references auth.users(id),
  received_at timestamptz not null default now(),
  notes text,
  status text not null,
  created_at timestamptz not null default now(),
  constraint goods_receipts_id_company_unique unique (id, company_id),
  constraint goods_receipts_company_number_unique unique (company_id, receipt_number),
  constraint goods_receipts_order_company_fk foreign key (purchase_order_id, company_id)
    references procurement.purchase_orders(id, company_id),
  constraint goods_receipts_notes_check check (notes is null or char_length(notes) <= 2000),
  constraint goods_receipts_status_check check (status in ('partial','complete'))
);
create index goods_receipts_order_received_idx
  on procurement.goods_receipts (purchase_order_id, received_at, id);
create index goods_receipts_company_received_idx
  on procurement.goods_receipts (company_id, received_at desc);

create table procurement.goods_receipt_items (
  id uuid primary key default gen_random_uuid(),
  goods_receipt_id uuid not null references procurement.goods_receipts(id),
  purchase_order_item_id uuid not null references procurement.purchase_order_items(id),
  quantity_received numeric(18,4) not null,
  created_at timestamptz not null default now(),
  constraint goods_receipt_items_receipt_order_item_unique unique (goods_receipt_id, purchase_order_item_id),
  constraint goods_receipt_items_quantity_check check (quantity_received > 0)
);
create index goods_receipt_items_receipt_idx
  on procurement.goods_receipt_items (goods_receipt_id, created_at);
create index goods_receipt_items_order_item_idx
  on procurement.goods_receipt_items (purchase_order_item_id, created_at);

create table platform.procurement_document_sequences (
  company_id uuid not null references identity.companies(id),
  document_type text not null,
  document_year integer not null,
  last_value bigint not null default 0,
  primary key (company_id, document_type, document_year),
  constraint procurement_document_sequences_type_check check (document_type in ('PO','GR')),
  constraint procurement_document_sequences_year_check check (document_year between 2000 and 9999),
  constraint procurement_document_sequences_value_check check (last_value >= 0)
);
revoke all on table platform.procurement_document_sequences from public, anon, authenticated;

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
        'Procurement.View','Procurement.Create','Procurement.EditOwn','Procurement.Submit',
        'Procurement.TechnicalApprove','Procurement.FinancialApprove','Procurement.ExecutiveApprove','Procurement.Cancel',
        'Procurement.SupplierView','Procurement.SupplierManage','Procurement.QuotationView','Procurement.QuotationManage','Procurement.SupplierSelect',
        'Procurement.PurchaseOrderView','Procurement.PurchaseOrderIssue','Procurement.GoodsReceiptView','Procurement.GoodsReceiptCreate'
      ]::text[];
    when 'requester' then
      return array[
        'Procurement.View','Procurement.Create','Procurement.EditOwn','Procurement.Submit','Procurement.Cancel',
        'Procurement.SupplierView','Procurement.QuotationView',
        'Procurement.PurchaseOrderView','Procurement.GoodsReceiptView'
      ]::text[];
    when 'technical_reviewer' then
      return array[
        'Procurement.View','Procurement.TechnicalApprove','Procurement.SupplierView','Procurement.QuotationView',
        'Procurement.PurchaseOrderView','Procurement.GoodsReceiptView'
      ]::text[];
    when 'financial_approver' then
      return array[
        'Procurement.View','Procurement.FinancialApprove','Procurement.SupplierView','Procurement.QuotationView',
        'Procurement.PurchaseOrderView','Procurement.GoodsReceiptView'
      ]::text[];
    when 'executive_approver' then
      return array[
        'Procurement.View','Procurement.ExecutiveApprove','Procurement.SupplierView','Procurement.QuotationView',
        'Procurement.PurchaseOrderView','Procurement.GoodsReceiptView'
      ]::text[];
    when 'procurement_officer' then
      return array[
        'Procurement.View','Procurement.SupplierView','Procurement.SupplierManage','Procurement.QuotationView','Procurement.QuotationManage','Procurement.SupplierSelect',
        'Procurement.PurchaseOrderView','Procurement.PurchaseOrderIssue','Procurement.GoodsReceiptView','Procurement.GoodsReceiptCreate'
      ]::text[];
    else
      return array[]::text[];
  end case;
end;
$$;

create or replace function platform.next_procurement_document_number(p_company_id uuid, p_document_type text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year integer := extract(year from current_date)::integer;
  v_value bigint;
begin
  if p_document_type not in ('PO','GR') then
    raise exception using errcode='22023', message='invalid_procurement_document_type';
  end if;

  insert into platform.procurement_document_sequences(company_id, document_type, document_year, last_value)
  values (p_company_id, p_document_type, v_year, 1)
  on conflict (company_id, document_type, document_year)
  do update set last_value = platform.procurement_document_sequences.last_value + 1
  returning last_value into v_value;

  return format('%s-%s-%s', p_document_type, v_year, lpad(v_value::text, 6, '0'));
end;
$$;
revoke all on function platform.next_procurement_document_number(uuid,text) from public, anon, authenticated;

create or replace function platform.issue_purchase_order(p_purchase_request_id uuid, p_expected_request_version integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_user uuid := auth.uid();
  v_request procurement.purchase_requests%rowtype;
  v_selection procurement.supplier_selections%rowtype;
  v_quotation procurement.quotations%rowtype;
  v_order_id uuid;
  v_order_number text;
  v_item_count integer;
begin
  perform platform.require_procurement_permission('Procurement.PurchaseOrderIssue');
  v_company := platform.current_company_id();

  select request.* into v_request
  from procurement.purchase_requests request
  where request.id = p_purchase_request_id and request.company_id = v_company
  for update;
  if not found then
    raise exception using errcode='P0001', message='purchase_request_not_found';
  end if;
  if v_request.version <> p_expected_request_version then
    raise exception using errcode='40001', message='purchase_request_version_conflict';
  end if;
  if v_request.status <> 'supplier_selected' then
    raise exception using errcode='P0001', message='supplier_selected_purchase_request_required';
  end if;

  select selection.* into v_selection
  from procurement.supplier_selections selection
  where selection.purchase_request_id = p_purchase_request_id
    and selection.company_id = v_company;
  if not found then
    raise exception using errcode='P0001', message='supplier_selection_not_found';
  end if;

  select quotation.* into v_quotation
  from procurement.quotations quotation
  where quotation.id = v_selection.quotation_id
    and quotation.purchase_request_id = p_purchase_request_id
    and quotation.supplier_id = v_selection.supplier_id
    and quotation.company_id = v_company;
  if not found then
    raise exception using errcode='P0001', message='selected_quotation_mismatch';
  end if;
  if v_quotation.status <> 'submitted' then
    raise exception using errcode='P0001', message='submitted_quotation_required';
  end if;
  if exists (
    select 1 from procurement.suppliers supplier
    where supplier.id = v_selection.supplier_id
      and supplier.company_id = v_company
      and supplier.status = 'blocked'
  ) then
    raise exception using errcode='P0001', message='supplier_blocked';
  end if;
  if exists (
    select 1 from procurement.purchase_orders purchase_order
    where purchase_order.purchase_request_id = p_purchase_request_id
      and purchase_order.status <> 'cancelled'
  ) then
    raise exception using errcode='23505', message='purchase_order_already_exists';
  end if;

  v_order_number := platform.next_procurement_document_number(v_company, 'PO');
  insert into procurement.purchase_orders(
    company_id,purchase_request_id,supplier_id,quotation_id,order_number,currency,
    subtotal,tax_amount,total,status,issued_by,issued_at
  ) values (
    v_company,p_purchase_request_id,v_selection.supplier_id,v_selection.quotation_id,v_order_number,v_quotation.currency,
    v_quotation.subtotal,v_quotation.tax_amount,v_quotation.total,'issued',v_user,now()
  ) returning id into v_order_id;

  insert into procurement.purchase_order_items(
    purchase_order_id,purchase_request_item_id,description,quantity,unit,unit_price
  )
  select v_order_id,item.purchase_request_item_id,item.description,item.quantity,item.unit,item.unit_price
  from procurement.quotation_items item
  where item.quotation_id = v_selection.quotation_id
  order by item.created_at,item.id;
  get diagnostics v_item_count = row_count;
  if v_item_count = 0 then
    raise exception using errcode='P0001', message='quotation_items_required';
  end if;

  update procurement.purchase_requests request
  set status='ordered',updated_at=now(),version=request.version+1,current_approver_role=null
  where request.id=p_purchase_request_id and request.company_id=v_company and request.version=p_expected_request_version;
  if not found then
    raise exception using errcode='40001', message='purchase_request_version_conflict';
  end if;

  insert into audit.entries(company_id,user_id,action,module,resource_type,resource_id,metadata)
  values (
    v_company,v_user,'PurchaseOrderIssued','procurement','purchase_order',v_order_id,
    jsonb_build_object(
      'orderNumber',v_order_number,
      'purchaseRequestId',p_purchase_request_id,
      'quotationId',v_selection.quotation_id,
      'supplierId',v_selection.supplier_id,
      'itemCount',v_item_count
    )
  );

  return v_order_id;
exception
  when unique_violation then
    raise exception using errcode='23505', message='purchase_order_already_exists';
end;
$$;

create or replace function platform.record_goods_receipt(
  p_purchase_order_id uuid,
  p_expected_version integer,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_user uuid := auth.uid();
  v_order procurement.purchase_orders%rowtype;
  v_request procurement.purchase_requests%rowtype;
  v_order_item procurement.purchase_order_items%rowtype;
  v_item jsonb;
  v_item_id uuid;
  v_quantity numeric(18,4);
  v_previously_received numeric(18,4);
  v_receipt_id uuid;
  v_receipt_number text;
  v_complete boolean;
  v_receipt_status text;
  v_next_order_status text;
  v_next_request_status procurement.purchase_request_status;
  v_new_order_version integer;
  v_item_count integer := 0;
begin
  perform platform.require_procurement_permission('Procurement.GoodsReceiptCreate');
  v_company := platform.current_company_id();

  select purchase_order.* into v_order
  from procurement.purchase_orders purchase_order
  where purchase_order.id = p_purchase_order_id and purchase_order.company_id = v_company
  for update;
  if not found then
    raise exception using errcode='P0001', message='purchase_order_not_found';
  end if;
  if v_order.version <> p_expected_version then
    raise exception using errcode='40001', message='purchase_order_version_conflict';
  end if;
  if v_order.status not in ('issued','partially_received') then
    raise exception using errcode='P0001', message='purchase_order_not_receivable';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then
    raise exception using errcode='22023', message='goods_receipt_items_required';
  end if;
  if p_notes is not null and char_length(p_notes) > 2000 then
    raise exception using errcode='22023', message='goods_receipt_notes_too_long';
  end if;

  select request.* into v_request
  from procurement.purchase_requests request
  where request.id = v_order.purchase_request_id and request.company_id = v_company
  for update;
  if not found or v_request.status not in ('ordered','partially_received') then
    raise exception using errcode='P0001', message='purchase_request_receipt_state_invalid';
  end if;

  v_receipt_number := platform.next_procurement_document_number(v_company, 'GR');
  insert into procurement.goods_receipts(
    company_id,purchase_order_id,receipt_number,received_by,received_at,notes,status
  ) values (
    v_company,p_purchase_order_id,v_receipt_number,v_user,now(),nullif(btrim(p_notes),''),'partial'
  ) returning id into v_receipt_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_item_id := (v_item->>'purchaseOrderItemId')::uuid;
    v_quantity := (v_item->>'quantityReceived')::numeric;
    if v_quantity is null or v_quantity <= 0 then
      raise exception using errcode='22023', message='invalid_goods_receipt_quantity';
    end if;

    select item.* into v_order_item
    from procurement.purchase_order_items item
    where item.id=v_item_id and item.purchase_order_id=p_purchase_order_id;
    if not found then
      raise exception using errcode='P0001', message='purchase_order_item_not_found';
    end if;

    select coalesce(sum(receipt_item.quantity_received),0)::numeric(18,4)
    into v_previously_received
    from procurement.goods_receipt_items receipt_item
    where receipt_item.purchase_order_item_id=v_item_id;

    if v_quantity > (v_order_item.quantity - v_previously_received) then
      raise exception using errcode='22023', message='goods_receipt_over_quantity';
    end if;

    insert into procurement.goods_receipt_items(goods_receipt_id,purchase_order_item_id,quantity_received)
    values (v_receipt_id,v_item_id,v_quantity);
    v_item_count := v_item_count + 1;
  end loop;

  v_complete := not exists (
    select 1
    from procurement.purchase_order_items item
    where item.purchase_order_id=p_purchase_order_id
      and coalesce((
        select sum(receipt_item.quantity_received)
        from procurement.goods_receipt_items receipt_item
        where receipt_item.purchase_order_item_id=item.id
      ),0) < item.quantity
  );

  v_receipt_status := case when v_complete then 'complete' else 'partial' end;
  v_next_order_status := case when v_complete then 'received' else 'partially_received' end;
  v_next_request_status := case when v_complete then 'received' else 'partially_received' end;

  update procurement.goods_receipts receipt
  set status=v_receipt_status
  where receipt.id=v_receipt_id;

  update procurement.purchase_orders purchase_order
  set status=v_next_order_status,updated_at=now(),version=purchase_order.version+1
  where purchase_order.id=p_purchase_order_id and purchase_order.version=p_expected_version
  returning version into v_new_order_version;
  if not found then
    raise exception using errcode='40001', message='purchase_order_version_conflict';
  end if;

  update procurement.purchase_requests request
  set status=v_next_request_status,updated_at=now(),version=request.version+1
  where request.id=v_order.purchase_request_id and request.company_id=v_company;

  insert into audit.entries(company_id,user_id,action,module,resource_type,resource_id,metadata)
  values (
    v_company,v_user,'GoodsReceiptRecorded','procurement','goods_receipt',v_receipt_id,
    jsonb_build_object(
      'purchaseOrderId',p_purchase_order_id,
      'receiptNumber',v_receipt_number,
      'status',v_receipt_status,
      'itemCount',v_item_count
    )
  );

  insert into audit.entries(company_id,user_id,action,module,resource_type,resource_id,metadata)
  values (
    v_company,v_user,
    case when v_complete then 'PurchaseOrderReceived' else 'PurchaseOrderPartiallyReceived' end,
    'procurement','purchase_order',p_purchase_order_id,
    jsonb_build_object('receiptId',v_receipt_id,'fromStatus',v_order.status,'toStatus',v_next_order_status,'version',v_new_order_version)
  );

  insert into audit.entries(company_id,user_id,action,module,resource_type,resource_id,metadata)
  values (
    v_company,v_user,
    case when v_complete then 'PurchaseRequestReceived' else 'PurchaseRequestPartiallyReceived' end,
    'procurement','purchase_request',v_order.purchase_request_id,
    jsonb_build_object('purchaseOrderId',p_purchase_order_id,'receiptId',v_receipt_id,'fromStatus',v_request.status,'toStatus',v_next_request_status)
  );

  return v_receipt_id;
end;
$$;

create or replace function platform.get_purchase_order(p_purchase_order_id uuid)
returns table(
  id uuid,purchase_request_id uuid,request_number text,project_id uuid,project_name text,
  supplier_id uuid,supplier_name text,quotation_id uuid,quotation_number text,order_number text,
  currency text,subtotal numeric,tax_amount numeric,total numeric,status text,issued_by uuid,
  issued_at timestamptz,created_at timestamptz,updated_at timestamptz,version integer
)
language plpgsql stable security definer set search_path='' as $$
declare v_company uuid;
begin
  perform platform.require_procurement_permission('Procurement.PurchaseOrderView');
  v_company:=platform.current_company_id();
  return query
  select purchase_order.id,purchase_order.purchase_request_id,request.request_number,request.project_id,project.name,
    purchase_order.supplier_id,supplier.name,purchase_order.quotation_id,quotation.quotation_number,purchase_order.order_number,
    purchase_order.currency,purchase_order.subtotal,purchase_order.tax_amount,purchase_order.total,purchase_order.status,
    purchase_order.issued_by,purchase_order.issued_at,purchase_order.created_at,purchase_order.updated_at,purchase_order.version
  from procurement.purchase_orders purchase_order
  join procurement.purchase_requests request on request.id=purchase_order.purchase_request_id and request.company_id=purchase_order.company_id
  join projects.projects project on project.id=request.project_id and project.company_id=purchase_order.company_id
  join procurement.suppliers supplier on supplier.id=purchase_order.supplier_id and supplier.company_id=purchase_order.company_id
  join procurement.quotations quotation on quotation.id=purchase_order.quotation_id and quotation.company_id=purchase_order.company_id
  where purchase_order.id=p_purchase_order_id and purchase_order.company_id=v_company;
end; $$;

create or replace function platform.list_purchase_orders()
returns table(
  id uuid,purchase_request_id uuid,request_number text,project_id uuid,project_name text,
  supplier_id uuid,supplier_name text,quotation_id uuid,quotation_number text,order_number text,
  currency text,subtotal numeric,tax_amount numeric,total numeric,status text,issued_by uuid,
  issued_at timestamptz,created_at timestamptz,updated_at timestamptz,version integer
)
language plpgsql stable security definer set search_path='' as $$
declare v_company uuid;
begin
  perform platform.require_procurement_permission('Procurement.PurchaseOrderView');
  v_company:=platform.current_company_id();
  return query
  select purchase_order.id,purchase_order.purchase_request_id,request.request_number,request.project_id,project.name,
    purchase_order.supplier_id,supplier.name,purchase_order.quotation_id,quotation.quotation_number,purchase_order.order_number,
    purchase_order.currency,purchase_order.subtotal,purchase_order.tax_amount,purchase_order.total,purchase_order.status,
    purchase_order.issued_by,purchase_order.issued_at,purchase_order.created_at,purchase_order.updated_at,purchase_order.version
  from procurement.purchase_orders purchase_order
  join procurement.purchase_requests request on request.id=purchase_order.purchase_request_id and request.company_id=purchase_order.company_id
  join projects.projects project on project.id=request.project_id and project.company_id=purchase_order.company_id
  join procurement.suppliers supplier on supplier.id=purchase_order.supplier_id and supplier.company_id=purchase_order.company_id
  join procurement.quotations quotation on quotation.id=purchase_order.quotation_id and quotation.company_id=purchase_order.company_id
  where purchase_order.company_id=v_company
  order by purchase_order.created_at desc,purchase_order.id desc;
end; $$;

create or replace function platform.get_purchase_order_for_purchase_request(p_purchase_request_id uuid)
returns table(
  id uuid,purchase_request_id uuid,request_number text,project_id uuid,project_name text,
  supplier_id uuid,supplier_name text,quotation_id uuid,quotation_number text,order_number text,
  currency text,subtotal numeric,tax_amount numeric,total numeric,status text,issued_by uuid,
  issued_at timestamptz,created_at timestamptz,updated_at timestamptz,version integer
)
language plpgsql stable security definer set search_path='' as $$
declare v_company uuid;
begin
  perform platform.require_procurement_permission('Procurement.PurchaseOrderView');
  v_company:=platform.current_company_id();
  return query
  select * from platform.get_purchase_order((
    select purchase_order.id from procurement.purchase_orders purchase_order
    where purchase_order.purchase_request_id=p_purchase_request_id
      and purchase_order.company_id=v_company
      and purchase_order.status<>'cancelled'
    order by purchase_order.created_at desc limit 1
  ));
end; $$;

create or replace function platform.list_purchase_order_items(p_purchase_order_id uuid)
returns table(
  id uuid,purchase_request_item_id uuid,description text,quantity numeric,unit text,unit_price numeric,total numeric,
  quantity_received numeric,remaining_quantity numeric,created_at timestamptz
)
language plpgsql stable security definer set search_path='' as $$
declare v_company uuid;
begin
  perform platform.require_procurement_permission('Procurement.PurchaseOrderView');
  v_company:=platform.current_company_id();
  if not exists(select 1 from procurement.purchase_orders purchase_order where purchase_order.id=p_purchase_order_id and purchase_order.company_id=v_company) then
    return;
  end if;
  return query
  select item.id,item.purchase_request_item_id,item.description,item.quantity,item.unit,item.unit_price,item.total,
    coalesce(received.quantity_received,0)::numeric,
    (item.quantity-coalesce(received.quantity_received,0))::numeric,
    item.created_at
  from procurement.purchase_order_items item
  left join lateral (
    select sum(receipt_item.quantity_received) as quantity_received
    from procurement.goods_receipt_items receipt_item
    where receipt_item.purchase_order_item_id=item.id
  ) received on true
  where item.purchase_order_id=p_purchase_order_id
  order by item.created_at,item.id;
end; $$;

create or replace function platform.get_purchase_order_receipt_status(p_purchase_order_id uuid)
returns table(purchase_order_id uuid,status text,item_count bigint,fully_received_item_count bigint,receipt_count bigint,progress_percent numeric)
language plpgsql stable security definer set search_path='' as $$
declare v_company uuid;
begin
  perform platform.require_procurement_permission('Procurement.PurchaseOrderView');
  v_company:=platform.current_company_id();
  return query
  with item_progress as (
    select item.id,item.quantity,
      coalesce((select sum(receipt_item.quantity_received) from procurement.goods_receipt_items receipt_item where receipt_item.purchase_order_item_id=item.id),0) as received
    from procurement.purchase_order_items item
    join procurement.purchase_orders purchase_order on purchase_order.id=item.purchase_order_id
    where item.purchase_order_id=p_purchase_order_id and purchase_order.company_id=v_company
  )
  select purchase_order.id,purchase_order.status,
    count(item_progress.id)::bigint,
    count(item_progress.id) filter (where item_progress.received >= item_progress.quantity)::bigint,
    (select count(*) from procurement.goods_receipts receipt where receipt.purchase_order_id=p_purchase_order_id)::bigint,
    case when count(item_progress.id)=0 then 0 else round((count(item_progress.id) filter (where item_progress.received >= item_progress.quantity))::numeric * 100 / count(item_progress.id),2) end
  from procurement.purchase_orders purchase_order
  left join item_progress on true
  where purchase_order.id=p_purchase_order_id and purchase_order.company_id=v_company
  group by purchase_order.id,purchase_order.status;
end; $$;

create or replace function platform.get_goods_receipt(p_goods_receipt_id uuid)
returns table(id uuid,purchase_order_id uuid,receipt_number text,received_by uuid,received_at timestamptz,notes text,status text,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare v_company uuid;
begin
  perform platform.require_procurement_permission('Procurement.GoodsReceiptView');
  v_company:=platform.current_company_id();
  return query select receipt.id,receipt.purchase_order_id,receipt.receipt_number,receipt.received_by,receipt.received_at,receipt.notes,receipt.status,receipt.created_at
  from procurement.goods_receipts receipt where receipt.id=p_goods_receipt_id and receipt.company_id=v_company;
end; $$;

create or replace function platform.list_goods_receipts(p_purchase_order_id uuid)
returns table(id uuid,purchase_order_id uuid,receipt_number text,received_by uuid,received_at timestamptz,notes text,status text,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare v_company uuid;
begin
  perform platform.require_procurement_permission('Procurement.GoodsReceiptView');
  v_company:=platform.current_company_id();
  return query select receipt.id,receipt.purchase_order_id,receipt.receipt_number,receipt.received_by,receipt.received_at,receipt.notes,receipt.status,receipt.created_at
  from procurement.goods_receipts receipt
  where receipt.purchase_order_id=p_purchase_order_id and receipt.company_id=v_company
  order by receipt.received_at,receipt.id;
end; $$;

create or replace function platform.list_goods_receipt_items(p_goods_receipt_id uuid)
returns table(id uuid,purchase_order_item_id uuid,description text,unit text,quantity_received numeric,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare v_company uuid;
begin
  perform platform.require_procurement_permission('Procurement.GoodsReceiptView');
  v_company:=platform.current_company_id();
  return query
  select receipt_item.id,receipt_item.purchase_order_item_id,order_item.description,order_item.unit,receipt_item.quantity_received,receipt_item.created_at
  from procurement.goods_receipt_items receipt_item
  join procurement.goods_receipts receipt on receipt.id=receipt_item.goods_receipt_id
  join procurement.purchase_order_items order_item on order_item.id=receipt_item.purchase_order_item_id
  where receipt_item.goods_receipt_id=p_goods_receipt_id and receipt.company_id=v_company
  order by receipt_item.created_at,receipt_item.id;
end; $$;

create or replace function platform.list_purchase_order_audit(p_purchase_order_id uuid)
returns table(action text,user_id uuid,metadata jsonb,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare v_company uuid;
begin
  perform platform.require_procurement_permission('Procurement.PurchaseOrderView');
  v_company:=platform.current_company_id();
  if not exists(select 1 from procurement.purchase_orders purchase_order where purchase_order.id=p_purchase_order_id and purchase_order.company_id=v_company) then
    return;
  end if;
  return query
  select entry.action,entry.user_id,entry.metadata,entry.created_at
  from audit.entries entry
  where entry.company_id=v_company
    and (
      entry.resource_id=p_purchase_order_id
      or entry.metadata->>'purchaseOrderId'=p_purchase_order_id::text
    )
  order by entry.created_at,entry.id;
end; $$;

alter table procurement.purchase_orders enable row level security;
alter table procurement.purchase_order_items enable row level security;
alter table procurement.goods_receipts enable row level security;
alter table procurement.goods_receipt_items enable row level security;

create policy purchase_orders_select_company
on procurement.purchase_orders for select to authenticated
using (
  identity.is_company_member(company_id)
  and platform.procurement_has_permission('Procurement.PurchaseOrderView')
);

create policy purchase_order_items_select_company
on procurement.purchase_order_items for select to authenticated
using (
  platform.procurement_has_permission('Procurement.PurchaseOrderView')
  and exists (
    select 1 from procurement.purchase_orders purchase_order
    where purchase_order.id=purchase_order_id
      and identity.is_company_member(purchase_order.company_id)
  )
);

create policy goods_receipts_select_company
on procurement.goods_receipts for select to authenticated
using (
  identity.is_company_member(company_id)
  and platform.procurement_has_permission('Procurement.GoodsReceiptView')
);

create policy goods_receipt_items_select_company
on procurement.goods_receipt_items for select to authenticated
using (
  platform.procurement_has_permission('Procurement.GoodsReceiptView')
  and exists (
    select 1
    from procurement.goods_receipts receipt
    where receipt.id=goods_receipt_id
      and identity.is_company_member(receipt.company_id)
  )
);

revoke all on procurement.purchase_orders,procurement.purchase_order_items,procurement.goods_receipts,procurement.goods_receipt_items from public,anon;
revoke insert,update,delete,truncate,references,trigger on procurement.purchase_orders,procurement.purchase_order_items,procurement.goods_receipts,procurement.goods_receipt_items from authenticated;
grant select on procurement.purchase_orders,procurement.purchase_order_items,procurement.goods_receipts,procurement.goods_receipt_items to authenticated;

create or replace function public.issue_purchase_order(purchase_request_id uuid,expected_request_version integer)
returns uuid language sql security invoker set search_path='' as $$
  select platform.issue_purchase_order($1,$2);
$$;
create or replace function public.get_purchase_order(purchase_order_id uuid)
returns table(
  id uuid,purchase_request_id uuid,request_number text,project_id uuid,project_name text,
  supplier_id uuid,supplier_name text,quotation_id uuid,quotation_number text,order_number text,
  currency text,subtotal numeric,tax_amount numeric,total numeric,status text,issued_by uuid,
  issued_at timestamptz,created_at timestamptz,updated_at timestamptz,version integer
) language sql stable security invoker set search_path='' as $$select * from platform.get_purchase_order($1);$$;
create or replace function public.list_purchase_orders()
returns table(
  id uuid,purchase_request_id uuid,request_number text,project_id uuid,project_name text,
  supplier_id uuid,supplier_name text,quotation_id uuid,quotation_number text,order_number text,
  currency text,subtotal numeric,tax_amount numeric,total numeric,status text,issued_by uuid,
  issued_at timestamptz,created_at timestamptz,updated_at timestamptz,version integer
) language sql stable security invoker set search_path='' as $$select * from platform.list_purchase_orders();$$;
create or replace function public.get_purchase_order_for_purchase_request(purchase_request_id uuid)
returns table(
  id uuid,purchase_request_id uuid,request_number text,project_id uuid,project_name text,
  supplier_id uuid,supplier_name text,quotation_id uuid,quotation_number text,order_number text,
  currency text,subtotal numeric,tax_amount numeric,total numeric,status text,issued_by uuid,
  issued_at timestamptz,created_at timestamptz,updated_at timestamptz,version integer
) language sql stable security invoker set search_path='' as $$select * from platform.get_purchase_order_for_purchase_request($1);$$;
create or replace function public.list_purchase_order_items(purchase_order_id uuid)
returns table(
  id uuid,purchase_request_item_id uuid,description text,quantity numeric,unit text,unit_price numeric,total numeric,
  quantity_received numeric,remaining_quantity numeric,created_at timestamptz
) language sql stable security invoker set search_path='' as $$select * from platform.list_purchase_order_items($1);$$;
create or replace function public.record_goods_receipt(purchase_order_id uuid,expected_version integer,notes text,items jsonb)
returns uuid language sql security invoker set search_path='' as $$select platform.record_goods_receipt($1,$2,$3,$4);$$;
create or replace function public.get_goods_receipt(goods_receipt_id uuid)
returns table(id uuid,purchase_order_id uuid,receipt_number text,received_by uuid,received_at timestamptz,notes text,status text,created_at timestamptz)
language sql stable security invoker set search_path='' as $$select * from platform.get_goods_receipt($1);$$;
create or replace function public.list_goods_receipts(purchase_order_id uuid)
returns table(id uuid,purchase_order_id uuid,receipt_number text,received_by uuid,received_at timestamptz,notes text,status text,created_at timestamptz)
language sql stable security invoker set search_path='' as $$select * from platform.list_goods_receipts($1);$$;
create or replace function public.list_goods_receipt_items(goods_receipt_id uuid)
returns table(id uuid,purchase_order_item_id uuid,description text,unit text,quantity_received numeric,created_at timestamptz)
language sql stable security invoker set search_path='' as $$select * from platform.list_goods_receipt_items($1);$$;
create or replace function public.get_purchase_order_receipt_status(purchase_order_id uuid)
returns table(purchase_order_id uuid,status text,item_count bigint,fully_received_item_count bigint,receipt_count bigint,progress_percent numeric)
language sql stable security invoker set search_path='' as $$select * from platform.get_purchase_order_receipt_status($1);$$;
create or replace function public.list_purchase_order_audit(purchase_order_id uuid)
returns table(action text,user_id uuid,metadata jsonb,created_at timestamptz)
language sql stable security invoker set search_path='' as $$select * from platform.list_purchase_order_audit($1);$$;

revoke all on function
  platform.issue_purchase_order(uuid,integer),
  platform.record_goods_receipt(uuid,integer,text,jsonb),
  platform.get_purchase_order(uuid),
  platform.list_purchase_orders(),
  platform.get_purchase_order_for_purchase_request(uuid),
  platform.list_purchase_order_items(uuid),
  platform.get_purchase_order_receipt_status(uuid),
  platform.get_goods_receipt(uuid),
  platform.list_goods_receipts(uuid),
  platform.list_goods_receipt_items(uuid),
  platform.list_purchase_order_audit(uuid)
from public,anon;
grant execute on function
  platform.issue_purchase_order(uuid,integer),
  platform.record_goods_receipt(uuid,integer,text,jsonb),
  platform.get_purchase_order(uuid),
  platform.list_purchase_orders(),
  platform.get_purchase_order_for_purchase_request(uuid),
  platform.list_purchase_order_items(uuid),
  platform.get_purchase_order_receipt_status(uuid),
  platform.get_goods_receipt(uuid),
  platform.list_goods_receipts(uuid),
  platform.list_goods_receipt_items(uuid),
  platform.list_purchase_order_audit(uuid)
to authenticated;

revoke all on function
  public.issue_purchase_order(uuid,integer),
  public.get_purchase_order(uuid),
  public.list_purchase_orders(),
  public.get_purchase_order_for_purchase_request(uuid),
  public.list_purchase_order_items(uuid),
  public.record_goods_receipt(uuid,integer,text,jsonb),
  public.get_goods_receipt(uuid),
  public.list_goods_receipts(uuid),
  public.list_goods_receipt_items(uuid),
  public.get_purchase_order_receipt_status(uuid),
  public.list_purchase_order_audit(uuid)
from public,anon;
grant execute on function
  public.issue_purchase_order(uuid,integer),
  public.get_purchase_order(uuid),
  public.list_purchase_orders(),
  public.get_purchase_order_for_purchase_request(uuid),
  public.list_purchase_order_items(uuid),
  public.record_goods_receipt(uuid,integer,text,jsonb),
  public.get_goods_receipt(uuid),
  public.list_goods_receipts(uuid),
  public.list_goods_receipt_items(uuid),
  public.get_purchase_order_receipt_status(uuid),
  public.list_purchase_order_audit(uuid)
to authenticated;
