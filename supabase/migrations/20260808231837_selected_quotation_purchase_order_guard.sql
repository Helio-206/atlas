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
  if v_quotation.status <> 'accepted' then
    raise exception using errcode='P0001', message='accepted_quotation_required';
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
