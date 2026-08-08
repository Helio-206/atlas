\set ON_ERROR_STOP on
begin;

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token)
values('00000000-0000-0000-0000-000000000000','81000000-0000-4000-8000-000000000001','authenticated','authenticated','fulfillment@example.invalid','',now(),'{}','{"full_name":"Fulfillment Officer"}',now(),now(),'','','','');
insert into identity.companies(id,name,tax_number,created_by) values('82000000-0000-4000-8000-000000000001','Fulfillment Company',null,'81000000-0000-4000-8000-000000000001');
insert into identity.memberships(company_id,user_id,role,status) values('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','procurement_officer','active');
insert into projects.projects(id,company_id,code,name,status,created_by) values('83000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','FUL-A','Fulfillment Project','active','81000000-0000-4000-8000-000000000001');
insert into procurement.purchase_requests(id,company_id,project_id,request_number,requested_by,purpose,priority,required_date,status,estimated_total,currency,version,approved_at) values
('84000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','FUL-PR-1','81000000-0000-4000-8000-000000000001','Main fulfillment flow','high','2026-11-20','approved',2100,'AOA',1,now()),
('84000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','FUL-PR-2','81000000-0000-4000-8000-000000000001','Invalid PO status','normal','2026-11-20','approved',100,'AOA',1,now());
insert into procurement.purchase_request_items(id,purchase_request_id,description,quantity,unit,estimated_unit_price) values
('85000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001','Cement',100,'bag',10),
('85000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000001','Steel',50,'bar',20),
('85000000-0000-4000-8000-000000000003','84000000-0000-4000-8000-000000000002','Invalid item',1,'un',100);

set local role authenticated;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

DO $$ BEGIN
  BEGIN PERFORM public.issue_purchase_order('84000000-0000-4000-8000-000000000002',1); RAISE EXCEPTION 'invalid PR accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'supplier_selected_purchase_request_required' THEN RAISE; END IF; END;
END $$;

select set_config('atlas.f.supplier',public.create_supplier('Fulfillment Supplier','FUL-TAX-1',null,null,'Luanda')::text,true);
select set_config('atlas.f.quote',public.create_quotation('84000000-0000-4000-8000-000000000001',current_setting('atlas.f.supplier')::uuid,'FUL-Q-1','AOA',100,'2026-12-31',5,'30 days',null,'[{"purchaseRequestItemId":"85000000-0000-4000-8000-000000000001","quantity":100,"unitPrice":10},{"purchaseRequestItemId":"85000000-0000-4000-8000-000000000002","quantity":50,"unitPrice":20}]')::text,true);
select public.submit_quotation(current_setting('atlas.f.quote')::uuid,1);
select public.select_supplier('84000000-0000-4000-8000-000000000001',current_setting('atlas.f.quote')::uuid,1,2,'Selected for fulfillment');
select set_config('atlas.f.po',public.issue_purchase_order('84000000-0000-4000-8000-000000000001',2)::text,true);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.get_purchase_order(current_setting('atlas.f.po')::uuid) po
    WHERE po.supplier_id=current_setting('atlas.f.supplier')::uuid
      AND po.quotation_id=current_setting('atlas.f.quote')::uuid
      AND po.status='issued' AND po.version=1 AND po.subtotal=2000 AND po.tax_amount=100 AND po.total=2100
      AND po.order_number ~ '^PO-[0-9]{4}-[0-9]{6}$'
  ) THEN RAISE EXCEPTION 'PO header snapshot invalid'; END IF;
  IF (SELECT count(*) FROM public.list_purchase_order_items(current_setting('atlas.f.po')::uuid)) <> 2 THEN RAISE EXCEPTION 'PO item snapshot invalid'; END IF;
  IF NOT EXISTS(SELECT 1 FROM procurement.purchase_requests WHERE id='84000000-0000-4000-8000-000000000001' AND status='ordered' AND version=3) THEN RAISE EXCEPTION 'PR ordered transition failed'; END IF;
END $$;

reset role;
update procurement.quotation_items set description='Changed source',unit_price=999
where quotation_id=current_setting('atlas.f.quote')::uuid and purchase_request_item_id='85000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.list_purchase_order_items(current_setting('atlas.f.po')::uuid) i WHERE i.purchase_request_item_id='85000000-0000-4000-8000-000000000001' AND i.description='Cement' AND i.unit_price=10 AND i.total=1000) THEN RAISE EXCEPTION 'PO snapshot mutated with quotation'; END IF;
END $$;
select set_config('atlas.f.cement',(select id::text from public.list_purchase_order_items(current_setting('atlas.f.po')::uuid) where purchase_request_item_id='85000000-0000-4000-8000-000000000001'),true);
select set_config('atlas.f.steel',(select id::text from public.list_purchase_order_items(current_setting('atlas.f.po')::uuid) where purchase_request_item_id='85000000-0000-4000-8000-000000000002'),true);

DO $$ BEGIN
  BEGIN PERFORM public.record_goods_receipt(current_setting('atlas.f.po')::uuid,1,null,'[]'); RAISE EXCEPTION 'empty receipt accepted';
  EXCEPTION WHEN invalid_parameter_value THEN IF SQLERRM <> 'goods_receipt_items_required' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_goods_receipt(current_setting('atlas.f.po')::uuid,1,null,jsonb_build_array(jsonb_build_object('purchaseOrderItemId',current_setting('atlas.f.cement'),'quantityReceived',0))); RAISE EXCEPTION 'zero receipt accepted';
  EXCEPTION WHEN invalid_parameter_value THEN IF SQLERRM <> 'invalid_goods_receipt_quantity' THEN RAISE; END IF; END;
END $$;

select set_config('atlas.f.gr1',public.record_goods_receipt(current_setting('atlas.f.po')::uuid,1,'Partial',jsonb_build_array(jsonb_build_object('purchaseOrderItemId',current_setting('atlas.f.cement'),'quantityReceived',80),jsonb_build_object('purchaseOrderItemId',current_setting('atlas.f.steel'),'quantityReceived',50)))::text,true);
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.get_goods_receipt(current_setting('atlas.f.gr1')::uuid) gr WHERE gr.status='partial' AND gr.receipt_number ~ '^GR-[0-9]{4}-[0-9]{6}$') THEN RAISE EXCEPTION 'partial GR invalid'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.get_purchase_order(current_setting('atlas.f.po')::uuid) po WHERE po.status='partially_received' AND po.version=2) THEN RAISE EXCEPTION 'PO partial transition failed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM procurement.purchase_requests WHERE id='84000000-0000-4000-8000-000000000001' AND status='partially_received' AND version=4) THEN RAISE EXCEPTION 'PR partial transition failed'; END IF;
END $$;

DO $$ DECLARE before_count bigint; BEGIN
  SELECT count(*) INTO before_count FROM public.list_goods_receipts(current_setting('atlas.f.po')::uuid);
  BEGIN PERFORM public.record_goods_receipt(current_setting('atlas.f.po')::uuid,2,'Over',jsonb_build_array(jsonb_build_object('purchaseOrderItemId',current_setting('atlas.f.cement'),'quantityReceived',21))); RAISE EXCEPTION 'over receipt accepted';
  EXCEPTION WHEN invalid_parameter_value THEN IF SQLERRM <> 'goods_receipt_over_quantity' THEN RAISE; END IF; END;
  IF (SELECT count(*) FROM public.list_goods_receipts(current_setting('atlas.f.po')::uuid)) <> before_count THEN RAISE EXCEPTION 'over receipt left data'; END IF;
END $$;

select set_config('atlas.f.gr2',public.record_goods_receipt(current_setting('atlas.f.po')::uuid,2,'Final',jsonb_build_array(jsonb_build_object('purchaseOrderItemId',current_setting('atlas.f.cement'),'quantityReceived',20)))::text,true);
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.get_goods_receipt(current_setting('atlas.f.gr2')::uuid) WHERE status='complete') THEN RAISE EXCEPTION 'complete GR invalid'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.get_purchase_order(current_setting('atlas.f.po')::uuid) WHERE status='received' AND version=3) THEN RAISE EXCEPTION 'PO received transition failed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM procurement.purchase_requests WHERE id='84000000-0000-4000-8000-000000000001' AND status='received' AND version=5) THEN RAISE EXCEPTION 'PR received transition failed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.get_purchase_order_receipt_status(current_setting('atlas.f.po')::uuid) WHERE item_count=2 AND fully_received_item_count=2 AND receipt_count=2 AND progress_percent=100) THEN RAISE EXCEPTION 'receipt progress invalid'; END IF;
  BEGIN PERFORM public.record_goods_receipt(current_setting('atlas.f.po')::uuid,3,null,jsonb_build_array(jsonb_build_object('purchaseOrderItemId',current_setting('atlas.f.cement'),'quantityReceived',1))); RAISE EXCEPTION 'closed PO receipt accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'purchase_order_not_receivable' THEN RAISE; END IF; END;
END $$;

reset role;
DO $$ BEGIN
  IF (SELECT count(*) FROM audit.entries e WHERE e.company_id='82000000-0000-4000-8000-000000000001' AND (e.resource_id=current_setting('atlas.f.po')::uuid OR e.metadata->>'purchaseOrderId'=current_setting('atlas.f.po')) AND e.action in ('PurchaseOrderIssued','GoodsReceiptRecorded','PurchaseOrderPartiallyReceived','PurchaseOrderReceived','PurchaseRequestPartiallyReceived','PurchaseRequestReceived')) <> 7 THEN RAISE EXCEPTION 'fulfillment audit incomplete'; END IF;
END $$;
rollback;
