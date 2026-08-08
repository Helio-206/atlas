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
  if v_request.status in (
    'approved',
    'supplier_selected',
    'ordered',
    'partially_received',
    'received',
    'rejected',
    'cancelled'
  ) then
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
