\set ON_ERROR_STOP on

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000','61000000-0000-0000-0000-000000000001','authenticated','authenticated','sourcing-officer-a@example.invalid','',now(),'{}'::jsonb,'{"full_name":"Sourcing Officer A"}'::jsonb,now(),now(),'','','',''),
  ('00000000-0000-0000-0000-000000000000','61000000-0000-0000-0000-000000000002','authenticated','authenticated','sourcing-officer-b@example.invalid','',now(),'{}'::jsonb,'{"full_name":"Sourcing Officer B"}'::jsonb,now(),now(),'','','','');

insert into identity.companies (id, name, tax_number, created_by)
values
  ('62000000-0000-0000-0000-000000000001','Sourcing Company A',null,'61000000-0000-0000-0000-000000000001'),
  ('62000000-0000-0000-0000-000000000002','Sourcing Company B',null,'61000000-0000-0000-0000-000000000002');

insert into identity.memberships (company_id, user_id, role, status)
values
  ('62000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','procurement_officer','active'),
  ('62000000-0000-0000-0000-000000000002','61000000-0000-0000-0000-000000000002','procurement_officer','active');

insert into projects.projects (id, company_id, code, name, status, created_by)
values
  ('63000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000001','SRC-A','Sourcing Project A','active','61000000-0000-0000-0000-000000000001'),
  ('63000000-0000-0000-0000-000000000002','62000000-0000-0000-0000-000000000002','SRC-B','Sourcing Project B','active','61000000-0000-0000-0000-000000000002');

insert into procurement.purchase_requests (
  id, company_id, project_id, request_number, requested_by, purpose, priority,
  required_date, status, estimated_total, currency, version, approved_at
) values
  ('64000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','SRC-PR-A1','61000000-0000-0000-0000-000000000001','Approved sourcing request','normal','2026-10-01','approved',300000,'AOA',1,now()),
  ('64000000-0000-0000-0000-000000000002','62000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','SRC-PR-A2','61000000-0000-0000-0000-000000000001','Draft sourcing request','normal','2026-10-01','draft',100000,'AOA',1,null),
  ('64000000-0000-0000-0000-000000000003','62000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','SRC-PR-A3','61000000-0000-0000-0000-000000000001','Second approved request','normal','2026-10-01','approved',100000,'AOA',1,now()),
  ('64000000-0000-0000-0000-000000000004','62000000-0000-0000-0000-000000000002','63000000-0000-0000-0000-000000000002','SRC-PR-B1','61000000-0000-0000-0000-000000000002','Company B request','normal','2026-10-01','approved',100000,'AOA',1,now());

insert into procurement.purchase_request_items (
  id, purchase_request_id, description, quantity, unit, estimated_unit_price
) values
  ('65000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001','Cimento',2,'saco',100000),
  ('65000000-0000-0000-0000-000000000002','64000000-0000-0000-0000-000000000001','Areia',2,'m3',50000),
  ('65000000-0000-0000-0000-000000000003','64000000-0000-0000-0000-000000000002','Item draft',1,'un',100000),
  ('65000000-0000-0000-0000-000000000004','64000000-0000-0000-0000-000000000003','Item second PR',1,'un',100000),
  ('65000000-0000-0000-0000-000000000005','64000000-0000-0000-0000-000000000004','Item company B',1,'un',100000);

-- Cross-tenant supplier exists but is intentionally invisible to Company A commands.
insert into procurement.suppliers (
  id, company_id, name, tax_number, status, created_by
) values (
  '66000000-0000-0000-0000-000000000099','62000000-0000-0000-0000-000000000002',
  'Supplier Company B','B-TAX-1','active','61000000-0000-0000-0000-000000000002'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"61000000-0000-0000-0000-000000000001","role":"authenticated"}',true);

select set_config('atlas.test.supplier_a', public.create_supplier('Supplier A','AOA-001','a@example.invalid','111','Luanda')::text, true);
select set_config('atlas.test.supplier_b', public.create_supplier('Supplier B','AOA-002','b@example.invalid','222','Luanda')::text, true);

DO $$
BEGIN
  IF (SELECT count(*) FROM public.list_suppliers(null,null)) <> 2 THEN
    RAISE EXCEPTION 'supplier creation/list failed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM audit.entries
    WHERE action='SupplierCreated' AND resource_id=current_setting('atlas.test.supplier_a')::uuid
  ) THEN RAISE EXCEPTION 'SupplierCreated audit missing'; END IF;
END
$$;

DO $$
BEGIN
  BEGIN
    PERFORM public.create_supplier('Duplicate NIF','AOA-001',null,null,null);
    RAISE EXCEPTION 'duplicate supplier tax number accepted';
  EXCEPTION WHEN unique_violation THEN
    IF SQLERRM <> 'supplier_tax_number_exists' THEN RAISE; END IF;
  END;
END
$$;

DO $$
DECLARE supplier_id uuid := current_setting('atlas.test.supplier_a')::uuid;
BEGIN
  IF public.update_supplier(supplier_id,1,'Supplier A Updated','AOA-001','a2@example.invalid','111','Luanda') <> 2 THEN
    RAISE EXCEPTION 'supplier update did not increment version';
  END IF;
  BEGIN
    PERFORM public.update_supplier(supplier_id,1,'Stale update','AOA-001',null,null,null);
    RAISE EXCEPTION 'stale supplier update accepted';
  EXCEPTION WHEN serialization_failure THEN
    IF SQLERRM <> 'supplier_version_conflict' THEN RAISE; END IF;
  END;
END
$$;

DO $$
BEGIN
  BEGIN
    PERFORM public.create_quotation(
      '64000000-0000-0000-0000-000000000002',
      current_setting('atlas.test.supplier_a')::uuid,
      'Q-DRAFT','AOA',0,null,3,null,null,
      '[{"purchaseRequestItemId":"65000000-0000-0000-0000-000000000003","quantity":1,"unitPrice":100000}]'::jsonb
    );
    RAISE EXCEPTION 'quotation for non-approved PR accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'approved_purchase_request_required' THEN RAISE; END IF;
  END;
END
$$;

DO $$
BEGIN
  BEGIN
    PERFORM public.create_quotation(
      '64000000-0000-0000-0000-000000000001',
      '66000000-0000-0000-0000-000000000099',
      'Q-CROSS','AOA',0,null,3,null,null,
      '[{"purchaseRequestItemId":"65000000-0000-0000-0000-000000000001","quantity":1,"unitPrice":100000}]'::jsonb
    );
    RAISE EXCEPTION 'cross-tenant supplier quotation accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'supplier_not_found' THEN RAISE; END IF;
  END;
END
$$;

DO $$
BEGIN
  BEGIN
    PERFORM public.create_quotation(
      '64000000-0000-0000-0000-000000000001',
      current_setting('atlas.test.supplier_a')::uuid,
      'Q-BAD-QTY','AOA',0,null,3,null,null,
      '[{"purchaseRequestItemId":"65000000-0000-0000-0000-000000000001","quantity":0,"unitPrice":100000}]'::jsonb
    );
    RAISE EXCEPTION 'invalid quotation quantity accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM <> 'invalid_quotation_item_quantity' THEN RAISE; END IF;
  END;
END
$$;

select set_config(
  'atlas.test.quote_a',
  public.create_quotation(
    '64000000-0000-0000-0000-000000000001',
    current_setting('atlas.test.supplier_a')::uuid,
    'Q-A','AOA',5000,'2026-12-01',5,'30 dias',null,
    '[{"purchaseRequestItemId":"65000000-0000-0000-0000-000000000001","quantity":2,"unitPrice":90000},{"purchaseRequestItemId":"65000000-0000-0000-0000-000000000002","quantity":2,"unitPrice":40000}]'::jsonb
  )::text,
  true
);

select set_config(
  'atlas.test.quote_b',
  public.create_quotation(
    '64000000-0000-0000-0000-000000000001',
    current_setting('atlas.test.supplier_b')::uuid,
    'Q-B','AOA',0,'2026-12-01',2,'Pronto pagamento',null,
    '[{"purchaseRequestItemId":"65000000-0000-0000-0000-000000000001","quantity":2,"unitPrice":80000}]'::jsonb
  )::text,
  true
);

DO $$
DECLARE qa uuid := current_setting('atlas.test.quote_a')::uuid;
DECLARE qb uuid := current_setting('atlas.test.quote_b')::uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM procurement.quotations
    WHERE id=qa AND subtotal=260000 AND tax_amount=5000 AND total=265000 AND version=1
  ) THEN RAISE EXCEPTION 'quotation total derivation failed'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.list_purchase_request_quotations('64000000-0000-0000-0000-000000000001')
    WHERE id=qa AND coverage_count=2 AND request_item_count=2 AND coverage_percent=100
  ) THEN RAISE EXCEPTION 'full quotation coverage failed'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.list_purchase_request_quotations('64000000-0000-0000-0000-000000000001')
    WHERE id=qb AND coverage_count=1 AND request_item_count=2 AND coverage_percent=50
  ) THEN RAISE EXCEPTION 'partial quotation coverage failed'; END IF;
END
$$;

DO $$
DECLARE qa uuid := current_setting('atlas.test.quote_a')::uuid;
DECLARE supplier_a uuid := current_setting('atlas.test.supplier_a')::uuid;
BEGIN
  IF public.update_quotation(qa,1,supplier_a,'Q-A-REV','AOA',10000,'2026-12-15',4,'45 dias','revisto') <> 2 THEN
    RAISE EXCEPTION 'quotation update did not increment version';
  END IF;
  BEGIN
    PERFORM public.update_quotation(qa,1,supplier_a,'STALE','AOA',0,null,1,null,null);
    RAISE EXCEPTION 'stale quotation update accepted';
  EXCEPTION WHEN serialization_failure THEN
    IF SQLERRM <> 'quotation_version_conflict' THEN RAISE; END IF;
  END;
END
$$;

-- Exercise item mutation use cases and derived totals on Quote A.
DO $$
DECLARE qa uuid := current_setting('atlas.test.quote_a')::uuid;
DECLARE item_id uuid;
DECLARE v integer;
BEGIN
  SELECT id INTO item_id FROM procurement.quotation_items WHERE quotation_id=qa ORDER BY created_at LIMIT 1;
  v := public.update_quotation_item(qa,item_id,2,'Cimento premium',2,'saco',95000);
  IF v <> 3 THEN RAISE EXCEPTION 'quotation item update version failed'; END IF;
  IF public.remove_quotation_item(qa,item_id,3) <> 4 THEN RAISE EXCEPTION 'quotation item removal version failed'; END IF;
  IF public.add_quotation_item(qa,4,'65000000-0000-0000-0000-000000000001','Cimento',2,'saco',90000) <> 5 THEN
    RAISE EXCEPTION 'quotation item add version failed';
  END IF;
END
$$;

DO $$
DECLARE qa uuid := current_setting('atlas.test.quote_a')::uuid;
DECLARE qb uuid := current_setting('atlas.test.quote_b')::uuid;
BEGIN
  IF public.submit_quotation(qa,5) <> 6 THEN RAISE EXCEPTION 'Quote A submission failed'; END IF;
  IF public.submit_quotation(qb,1) <> 2 THEN RAISE EXCEPTION 'Quote B submission failed'; END IF;
END
$$;

-- Block Supplier B after it has submitted a quotation: historical quote stays visible,
-- but it cannot be selected for a new purchase.
DO $$
DECLARE supplier_b uuid := current_setting('atlas.test.supplier_b')::uuid;
BEGIN
  IF public.block_supplier(supplier_b,1) <> 2 THEN RAISE EXCEPTION 'supplier block failed'; END IF;
  BEGIN
    PERFORM public.select_supplier(
      '64000000-0000-0000-0000-000000000001', current_setting('atlas.test.quote_b')::uuid, 1, 2, 'Blocked must fail'
    );
    RAISE EXCEPTION 'blocked supplier was selected';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'supplier_blocked' THEN RAISE; END IF;
  END;
END
$$;

DO $$
BEGIN
  BEGIN
    PERFORM public.select_supplier(
      '64000000-0000-0000-0000-000000000003', current_setting('atlas.test.quote_a')::uuid, 1, 6, 'Wrong PR'
    );
    RAISE EXCEPTION 'quotation from another request was selected';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'quotation_not_found' THEN RAISE; END IF;
  END;
END
$$;

DO $$
BEGIN
  BEGIN
    PERFORM public.select_supplier(
      '64000000-0000-0000-0000-000000000001', current_setting('atlas.test.quote_a')::uuid, 1, 6, '   '
    );
    RAISE EXCEPTION 'blank selection justification accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM <> 'supplier_selection_justification_required' THEN RAISE; END IF;
  END;
END
$$;

DO $$
DECLARE new_version integer;
BEGIN
  new_version := public.select_supplier(
    '64000000-0000-0000-0000-000000000001', current_setting('atlas.test.quote_a')::uuid, 1, 6,
    'Melhor equilíbrio entre preço, cobertura e prazo.'
  );
  IF new_version <> 2 THEN RAISE EXCEPTION 'selection did not increment PR version'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM procurement.purchase_requests
    WHERE id='64000000-0000-0000-0000-000000000001' AND status='supplier_selected' AND version=2
  ) THEN RAISE EXCEPTION 'PR did not transition to supplier_selected'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM procurement.supplier_selections
    WHERE purchase_request_id='64000000-0000-0000-0000-000000000001'
      AND quotation_id=current_setting('atlas.test.quote_a')::uuid
      AND justification='Melhor equilíbrio entre preço, cobertura e prazo.'
  ) THEN RAISE EXCEPTION 'supplier selection was not persisted'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM audit.entries
    WHERE action='SupplierSelected' AND resource_id='64000000-0000-0000-0000-000000000001'
  ) THEN RAISE EXCEPTION 'SupplierSelected audit missing'; END IF;
END
$$;

DO $$
BEGIN
  BEGIN
    PERFORM public.select_supplier(
      '64000000-0000-0000-0000-000000000001', current_setting('atlas.test.quote_a')::uuid, 2, 7, 'Duplicate'
    );
    RAISE EXCEPTION 'duplicate supplier selection accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT IN ('approved_purchase_request_required','supplier_already_selected') THEN RAISE; END IF;
  END;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM audit.entries WHERE action='SupplierUpdated' AND resource_id=current_setting('atlas.test.supplier_a')::uuid) THEN
    RAISE EXCEPTION 'SupplierUpdated audit missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM audit.entries WHERE action='SupplierBlocked' AND resource_id=current_setting('atlas.test.supplier_b')::uuid) THEN
    RAISE EXCEPTION 'SupplierBlocked audit missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM audit.entries WHERE action='QuotationCreated' AND resource_id=current_setting('atlas.test.quote_a')::uuid) THEN
    RAISE EXCEPTION 'QuotationCreated audit missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM audit.entries WHERE action='QuotationUpdated' AND resource_id=current_setting('atlas.test.quote_a')::uuid) THEN
    RAISE EXCEPTION 'QuotationUpdated audit missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM audit.entries WHERE action='QuotationSubmitted' AND resource_id=current_setting('atlas.test.quote_a')::uuid) THEN
    RAISE EXCEPTION 'QuotationSubmitted audit missing';
  END IF;
END
$$;

reset role;
rollback;
