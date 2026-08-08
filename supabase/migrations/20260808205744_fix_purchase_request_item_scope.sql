-- $1 avoids ambiguity with procurement.purchase_request_items.purchase_request_id.
-- The previous unqualified parameter resolved to the column and returned every
-- item visible to the caller instead of only the requested purchase request.
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
  where item.purchase_request_id = $1
  order by item.created_at, item.id;
$$;
