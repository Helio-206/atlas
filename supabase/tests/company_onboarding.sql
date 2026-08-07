\set ON_ERROR_STOP on

begin;

DO $$
DECLARE
  function_is_security_definer boolean;
  function_has_explicit_search_path boolean;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'identity'
      AND table_name = 'companies'
      AND column_name = 'tax_number'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'identity.companies.tax_number is still required';
  END IF;

  SELECT
    p.prosecdef,
    EXISTS (
      SELECT 1
      FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS setting
      WHERE setting LIKE 'search_path=%'
    )
  INTO
    function_is_security_definer,
    function_has_explicit_search_path
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'identity'
    AND p.proname = 'create_company'
    AND pg_get_function_identity_arguments(p.oid) =
      'company_name text, company_tax_number text';

  IF NOT function_is_security_definer THEN
    RAISE EXCEPTION 'identity.create_company is not SECURITY DEFINER';
  END IF;

  IF NOT function_has_explicit_search_path THEN
    RAISE EXCEPTION 'identity.create_company does not define search_path';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'identity.create_company(text,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated cannot execute identity.create_company';
  END IF;

  IF has_function_privilege(
    'anon',
    'identity.create_company(text,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anon can execute identity.create_company';
  END IF;

  IF has_table_privilege('authenticated', 'identity.companies', 'INSERT')
    OR has_table_privilege('authenticated', 'identity.memberships', 'INSERT')
    OR has_table_privilege('authenticated', 'audit.entries', 'INSERT') THEN
    RAISE EXCEPTION 'authenticated received direct onboarding table write access';
  END IF;
END
$$;

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
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-0000000000c1',
    'authenticated',
    'authenticated',
    'atlas-onboarding-success@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Onboarding Success"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-0000000000c2',
    'authenticated',
    'authenticated',
    'atlas-onboarding-invalid@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Onboarding Invalid"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-0000000000c3',
    'authenticated',
    'authenticated',
    'atlas-onboarding-rollback@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Onboarding Rollback"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

-- Unauthenticated calls are rejected even though the function is SECURITY DEFINER.
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);

DO $$
BEGIN
  BEGIN
    PERFORM identity.create_company('Anonymous Company', null);
    RAISE EXCEPTION 'unauthenticated company creation was accepted';
  EXCEPTION
    WHEN insufficient_privilege THEN
      IF SQLERRM <> 'authentication_required' THEN
        RAISE;
      END IF;
  END;
END
$$;

-- Successful onboarding.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-0000000000c1',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-0000000000c1","role":"authenticated"}',
  true
);

DO $$
DECLARE
  created_company_id uuid;
BEGIN
  created_company_id := identity.create_company(
    'Atlas Construction',
    null
  );

  IF created_company_id IS NULL THEN
    RAISE EXCEPTION 'create_company returned null';
  END IF;
END
$$;

reset role;

DO $$
DECLARE
  company_id uuid;
BEGIN
  SELECT id
  INTO company_id
  FROM identity.companies
  WHERE created_by = '10000000-0000-0000-0000-0000000000c1'::uuid;

  IF company_id IS NULL THEN
    RAISE EXCEPTION 'company was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM identity.companies
    WHERE id = company_id
      AND name = 'Atlas Construction'
      AND tax_number IS NULL
  ) THEN
    RAISE EXCEPTION 'company fields were not persisted correctly';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM identity.memberships
    WHERE company_id = company_id
      AND user_id = '10000000-0000-0000-0000-0000000000c1'::uuid
      AND role = 'administrator'
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'administrator membership was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM audit.entries
    WHERE company_id = company_id
      AND user_id = '10000000-0000-0000-0000-0000000000c1'::uuid
      AND action = 'company.created'
      AND module = 'identity'
      AND resource_type = 'company'
      AND resource_id = company_id
      AND metadata ->> 'membership_role' = 'administrator'
  ) THEN
    RAISE EXCEPTION 'company creation audit entry was not created';
  END IF;
END
$$;

-- A stale or double-submitted onboarding request cannot create a second company.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-0000000000c1',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

DO $$
BEGIN
  BEGIN
    PERFORM identity.create_company('Duplicate Company', 'DUPLICATE-NIF');
    RAISE EXCEPTION 'duplicate onboarding was accepted';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM <> 'active_membership_exists' THEN
        RAISE;
      END IF;
  END;
END
$$;

reset role;

DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM identity.companies
    WHERE created_by = '10000000-0000-0000-0000-0000000000c1'::uuid
  ) <> 1 THEN
    RAISE EXCEPTION 'duplicate onboarding created an extra company';
  END IF;

  IF (
    SELECT count(*)
    FROM audit.entries
    WHERE user_id = '10000000-0000-0000-0000-0000000000c1'::uuid
      AND action = 'company.created'
  ) <> 1 THEN
    RAISE EXCEPTION 'duplicate onboarding created an extra audit entry';
  END IF;
END
$$;

-- Invalid names fail before any persistent write.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-0000000000c2',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

DO $$
BEGIN
  BEGIN
    PERFORM identity.create_company(' ', null);
    RAISE EXCEPTION 'invalid company name was accepted';
  EXCEPTION
    WHEN invalid_parameter_value THEN
      IF SQLERRM <> 'invalid_company_name' THEN
        RAISE;
      END IF;
  END;
END
$$;

reset role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM identity.companies
    WHERE created_by = '10000000-0000-0000-0000-0000000000c2'::uuid
  ) THEN
    RAISE EXCEPTION 'invalid onboarding created a company';
  END IF;
END
$$;

-- Force the final audit step to fail. PostgreSQL must roll back the company
-- and membership inserted earlier in the same function call.
create function pg_temp.reject_company_onboarding_audit()
returns trigger
language plpgsql
as $$
begin
  if new.action = 'company.created' then
    raise exception using
      errcode = 'P0001',
      message = 'forced_audit_failure';
  end if;

  return new;
end;
$$;

create trigger test_reject_company_onboarding_audit
before insert on audit.entries
for each row
execute function pg_temp.reject_company_onboarding_audit();

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-0000000000c3',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

DO $$
BEGIN
  BEGIN
    PERFORM identity.create_company('Rollback Company', 'ROLLBACK-NIF');
    RAISE EXCEPTION 'forced audit failure did not abort onboarding';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM <> 'forced_audit_failure' THEN
        RAISE;
      END IF;
  END;
END
$$;

reset role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM identity.companies
    WHERE created_by = '10000000-0000-0000-0000-0000000000c3'::uuid
  ) THEN
    RAISE EXCEPTION 'company survived a failed onboarding transaction';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM identity.memberships
    WHERE user_id = '10000000-0000-0000-0000-0000000000c3'::uuid
  ) THEN
    RAISE EXCEPTION 'membership survived a failed onboarding transaction';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM audit.entries
    WHERE user_id = '10000000-0000-0000-0000-0000000000c3'::uuid
      AND action = 'company.created'
  ) THEN
    RAISE EXCEPTION 'audit entry survived a failed onboarding transaction';
  END IF;
END
$$;

rollback;
