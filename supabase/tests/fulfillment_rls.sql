\set ON_ERROR_STOP on

begin;

DO $$
BEGIN
  IF has_table_privilege('anon','procurement.purchase_orders','SELECT')
     OR has_table_privilege('anon','procurement.purchase_order_items','SELECT')
     OR has_table_privilege('anon','procurement.goods_receipts','SELECT')
     OR has_table_privilege('anon','procurement.goods_receipt_items','SELECT') THEN
    RAISE EXCEPTION 'anonymous has fulfillment table read privileges';
  END IF;

  IF has_table_privilege('authenticated','procurement.purchase_orders','INSERT,UPDATE,DELETE')
     OR has_table_privilege('authenticated','procurement.purchase_order_items','INSERT,UPDATE,DELETE')
     OR has_table_privilege('authenticated','procurement.goods_receipts','INSERT,UPDATE,DELETE')
     OR has_table_privilege('authenticated','procurement.goods_receipt_items','INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'authenticated has direct fulfillment write privileges';
  END IF;
END
$$;

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
  confirmation_token,email_change,email_change_token_new,recovery_token
) values
  ('00000000-0000-0000-0000-000000000000','91000000-0000-4000-8000-000000000001','authenticated','authenticated','fulfillment-rls-a@example.invalid','',now(),'{}'::jsonb,'{"full_name":"Fulfillment RLS A"}'::jsonb,now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','91000000-0000-4000-8000-000000000002','authenticated','authenticated','fulfillment-rls-b@example.invalid','',now(),'{}'::jsonb,'{"full_name":"Fulfillment RLS B"}'::jsonb,now(),now(),'','','','');

insert into identity.companies(id,name,tax_number,created_by) values
  ('92000000-0000-4000-8000-000000000001','Fulfillment RLS Company A',null,'91000000-0000-4000-8000-000000000001'),
  ('92000000-0000-4000-8000-000000000002','Fulfillment RLS Company B',null,'91000000-0000-4000-8000-000000000002');

insert into identity.memberships(company_id,user_id,role,status) values
  ('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','procurement_officer','active'),
  ('92000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002','procurement_officer','active');

insert into projects.projects(id,company_id,code,name,status,created_by) values
  ('93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','FRLS-A','Fulfillment RLS Project A','active','91000000-0000-4000-8000-000000000001'),
  ('93000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002','FRLS-B','Fulfillment RLS Project B','active','91000000-0000-4000-8000-000000000002');

insert into procurement.purchase_requests(
  id,company_id,project_id,request_number,requested_by,purpose,priority,required_date,status,estimated_total,currency,version,approved_at
) values
  ('94000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','FRLS-PR-A','91000000-0000-4000-8000-000000000001','Fulfillment RLS A','normal','2026-12-01','ordered',100,'AOA',2,now()),
  ('94000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000002','FRLS-PR-B','91000000-0000-4000-8000-000000000002','Fulfillment RLS B','normal','2026-12-01','ordered',100,'AOA',2,now());

insert into procurement.purchase_request_items(id,purchase_request_id,description,quantity,unit,estimated_unit_price) values
  ('95000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','RLS PO A item',10,'un',10),
  ('95000000-0000-4000-8000-000000000002','94000000-0000-4000-8000-000000000002','RLS PO B item',10,'un',10);

insert into procurement.suppliers(id,company_id,name,tax_number,status,created_by) values
  ('96000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','Fulfillment Supplier A','FRLS-A','active','91000000-0000-4000-8000-000000000001'),
  ('96000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002','Fulfillment Supplier B','FRLS-B','active','91000000-0000-4000-8000-000000000002');

insert into procurement.quotations(
  id,company_id,purchase_request_id,supplier_id,quotation_number,currency,subtotal,tax_amount,total,status,created_by
) values
  ('97000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001','FRLS-Q-A','AOA',100,0,100,'submitted','91000000-0000-4000-8000-000000000001'),
  ('97000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002','94000000-0000-4000-8000-000000000002','96000000-0000-4000-8000-000000000002','FRLS-Q-B','AOA',100,0,100,'submitted','91000000-0000-4000-8000-000000000002');

insert into procurement.purchase_orders(
  id,company_id,purchase_request_id,supplier_id,quotation_id,order_number,currency,subtotal,tax_amount,total,status,issued_by,issued_at,version
) values
  ('98000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000001','PO-2026-900001','AOA',100,0,100,'partially_received','91000000-0000-4000-8000-000000000001',now(),2),
  ('98000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002','94000000-0000-4000-8000-000000000002','96000000-0000-4000-8000-000000000002','97000000-0000-4000-8000-000000000002','PO-2026-900002','AOA',100,0,100,'partially_received','91000000-0000-4000-8000-000000000002',now(),2);

insert into procurement.purchase_order_items(id,purchase_order_id,purchase_request_item_id,description,quantity,unit,unit_price) values
  ('99000000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','RLS PO A item',10,'un',10),
  ('99000000-0000-4000-8000-000000000002','98000000-0000-4000-8000-000000000002','95000000-0000-4000-8000-000000000002','RLS PO B item',10,'un',10);

insert into procurement.goods_receipts(id,company_id,purchase_order_id,receipt_number,received_by,received_at,notes,status) values
  ('a1000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000001','GR-2026-900001','91000000-0000-4000-8000-000000000001',now(),null,'partial'),
  ('a1000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002','98000000-0000-4000-8000-000000000002','GR-2026-900002','91000000-0000-4000-8000-000000000002',now(),null,'partial');

insert into procurement.goods_receipt_items(id,goods_receipt_id,purchase_order_item_id,quantity_received) values
  ('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000001',5),
  ('a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002','99000000-0000-4000-8000-000000000002',5);

set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

DO $$
BEGIN
  IF (SELECT count(*) FROM procurement.purchase_orders) <> 1 OR NOT EXISTS(SELECT 1 FROM procurement.purchase_orders WHERE id='98000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Company A purchase order RLS failed';
  END IF;
  IF (SELECT count(*) FROM procurement.purchase_order_items) <> 1 OR NOT EXISTS(SELECT 1 FROM procurement.purchase_order_items WHERE id='99000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Company A purchase order item RLS failed';
  END IF;
  IF (SELECT count(*) FROM procurement.goods_receipts) <> 1 OR NOT EXISTS(SELECT 1 FROM procurement.goods_receipts WHERE id='a1000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Company A goods receipt RLS failed';
  END IF;
  IF (SELECT count(*) FROM procurement.goods_receipt_items) <> 1 OR NOT EXISTS(SELECT 1 FROM procurement.goods_receipt_items WHERE id='a2000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Company A goods receipt item RLS failed';
  END IF;
END
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated"}',true);

DO $$
BEGIN
  IF (SELECT count(*) FROM procurement.purchase_orders) <> 1 OR NOT EXISTS(SELECT 1 FROM procurement.purchase_orders WHERE id='98000000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'Company B purchase order RLS failed';
  END IF;
  IF (SELECT count(*) FROM procurement.purchase_order_items) <> 1 OR NOT EXISTS(SELECT 1 FROM procurement.purchase_order_items WHERE id='99000000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'Company B purchase order item RLS failed';
  END IF;
  IF (SELECT count(*) FROM procurement.goods_receipts) <> 1 OR NOT EXISTS(SELECT 1 FROM procurement.goods_receipts WHERE id='a1000000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'Company B goods receipt RLS failed';
  END IF;
  IF (SELECT count(*) FROM procurement.goods_receipt_items) <> 1 OR NOT EXISTS(SELECT 1 FROM procurement.goods_receipt_items WHERE id='a2000000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'Company B goods receipt item RLS failed';
  END IF;
END
$$;

reset role;
rollback;
