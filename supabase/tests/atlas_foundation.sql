\set ON_ERROR_STOP on

begin;

DO $$
BEGIN
  IF to_regnamespace('identity') IS NULL THEN
    RAISE EXCEPTION 'missing schema identity';
  END IF;
  IF to_regnamespace('projects') IS NULL THEN
    RAISE EXCEPTION 'missing schema projects';
  END IF;
  IF to_regnamespace('audit') IS NULL THEN
    RAISE EXCEPTION 'missing schema audit';
  END IF;
  IF to_regnamespace('platform') IS NULL THEN
    RAISE EXCEPTION 'missing schema platform';
  END IF;

  IF to_regclass('identity.profiles') IS NULL THEN
    RAISE EXCEPTION 'missing table identity.profiles';
  END IF;
  IF to_regclass('identity.companies') IS NULL THEN
    RAISE EXCEPTION 'missing table identity.companies';
  END IF;
  IF to_regclass('identity.memberships') IS NULL THEN
    RAISE EXCEPTION 'missing table identity.memberships';
  END IF;
  IF to_regclass('projects.projects') IS NULL THEN
    RAISE EXCEPTION 'missing table projects.projects';
  END IF;
  IF to_regclass('audit.entries') IS NULL THEN
    RAISE EXCEPTION 'missing table audit.entries';
  END IF;
  IF to_regclass('platform.outbox_messages') IS NULL THEN
    RAISE EXCEPTION 'missing table platform.outbox_messages';
  END IF;
END
$$;

DO $$
DECLARE
  required_index text;
BEGIN
  FOREACH required_index IN ARRAY ARRAY[
    'identity.memberships_user_status_idx',
    'identity.memberships_company_status_idx',
    'projects.projects_company_status_idx',
    'audit.audit_entries_company_created_at_idx',
    'platform.outbox_messages_unprocessed_idx'
  ]
  LOOP
    IF to_regclass(required_index) IS NULL THEN
      RAISE EXCEPTION 'missing index %', required_index;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'platform'
      AND c.relname = 'outbox_messages_unprocessed_idx'
      AND i.indpred IS NOT NULL
      AND position(
        'processed_at IS NULL' in pg_get_expr(i.indpred, i.indrelid)
      ) > 0
  ) THEN
    RAISE EXCEPTION 'outbox unprocessed index is not partial on processed_at is null';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'identity.memberships'::regclass
      AND conname = 'memberships_company_user_unique'
      AND contype = 'u'
  ) THEN
    RAISE EXCEPTION 'missing memberships company/user unique constraint';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'projects.projects'::regclass
      AND conname = 'projects_company_code_unique'
      AND contype = 'u'
  ) THEN
    RAISE EXCEPTION 'missing projects company/code unique constraint';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'projects.projects'::regclass
      AND conname = 'projects_date_range_check'
      AND contype = 'c'
  ) THEN
    RAISE EXCEPTION 'missing projects date range constraint';
  END IF;
END
$$;

DO $$
DECLARE
  v_user_id uuid := '10000000-0000-0000-0000-000000000001';
  v_company_id uuid := '20000000-0000-0000-0000-000000000001';
  v_second_company_id uuid := '20000000-0000-0000-0000-000000000002';
  v_project_id uuid;
  v_version integer;
BEGIN
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    'atlas-foundation-test@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  INSERT INTO identity.profiles (id, full_name)
  VALUES (v_user_id, 'Atlas Foundation Test');

  INSERT INTO identity.companies (id, name, tax_number, created_by)
  VALUES
    (v_company_id, 'Atlas Test Company', 'TEST-NIF-001', v_user_id),
    (v_second_company_id, 'Atlas Test Company 2', 'TEST-NIF-002', v_user_id);

  INSERT INTO identity.memberships (company_id, user_id, role, status)
  VALUES (v_company_id, v_user_id, 'owner', 'active');

  BEGIN
    INSERT INTO identity.memberships (company_id, user_id, role, status)
    VALUES (v_company_id, v_user_id, 'viewer', 'active');
    RAISE EXCEPTION 'duplicate membership was accepted';
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO identity.memberships (company_id, user_id, role, status)
    VALUES (v_second_company_id, v_user_id, 'viewer', 'invalid');
    RAISE EXCEPTION 'invalid membership status was accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  INSERT INTO projects.projects (
    company_id,
    code,
    name,
    start_date,
    end_date,
    created_by
  ) VALUES (
    v_company_id,
    'ATL-001',
    'Atlas Test Project',
    DATE '2026-08-01',
    DATE '2026-08-31',
    v_user_id
  )
  RETURNING id, version INTO v_project_id, v_version;

  IF v_version <> 1 THEN
    RAISE EXCEPTION 'project version default is %, expected 1', v_version;
  END IF;

  BEGIN
    INSERT INTO projects.projects (company_id, code, name, created_by)
    VALUES (v_company_id, 'ATL-001', 'Duplicate Code', v_user_id);
    RAISE EXCEPTION 'duplicate project code was accepted inside the same company';
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO projects.projects (
      company_id,
      code,
      name,
      start_date,
      end_date,
      created_by
    ) VALUES (
      v_company_id,
      'ATL-002',
      'Invalid Date Range',
      DATE '2026-08-31',
      DATE '2026-08-01',
      v_user_id
    );
    RAISE EXCEPTION 'project end_date earlier than start_date was accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    UPDATE projects.projects
    SET status = 'invalid'
    WHERE id = v_project_id;
    RAISE EXCEPTION 'invalid project status was accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    UPDATE projects.projects
    SET version = 0
    WHERE id = v_project_id;
    RAISE EXCEPTION 'project version below 1 was accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  INSERT INTO audit.entries (
    company_id,
    user_id,
    action,
    module,
    resource_type,
    resource_id,
    correlation_id,
    metadata
  ) VALUES (
    v_company_id,
    v_user_id,
    'created',
    'projects',
    'project',
    v_project_id,
    gen_random_uuid(),
    '{"source":"foundation-test"}'::jsonb
  );

  INSERT INTO platform.outbox_messages (company_id, event_type, payload)
  VALUES (
    v_company_id,
    'project.created',
    jsonb_build_object('project_id', v_project_id)
  );

  BEGIN
    INSERT INTO platform.outbox_messages (company_id, event_type, payload, retry_count)
    VALUES (v_company_id, 'invalid.retry', '{}'::jsonb, -1);
    RAISE EXCEPTION 'negative outbox retry_count was accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
END
$$;

rollback;
