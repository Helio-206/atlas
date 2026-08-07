\set ON_ERROR_STOP on

begin;

DO $$
DECLARE
  rls_table_count integer;
  select_policy_count integer;
  function_is_security_definer boolean;
  function_has_explicit_search_path boolean;
  function_uses_auth_uid boolean;
BEGIN
  SELECT count(*)
  INTO rls_table_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r'
    AND c.relrowsecurity
    AND (n.nspname, c.relname) IN (
      ('identity', 'profiles'),
      ('identity', 'companies'),
      ('identity', 'memberships'),
      ('projects', 'projects'),
      ('audit', 'entries'),
      ('platform', 'outbox_messages')
    );

  IF rls_table_count <> 6 THEN
    RAISE EXCEPTION 'RLS enabled on % required tables, expected 6', rls_table_count;
  END IF;

  SELECT count(*)
  INTO select_policy_count
  FROM pg_policies
  WHERE (schemaname, tablename, policyname) IN (
    ('identity', 'profiles', 'profiles_select_own'),
    ('identity', 'memberships', 'memberships_select_own'),
    ('identity', 'companies', 'companies_select_active_members'),
    ('projects', 'projects', 'projects_select_active_company_members')
  )
    AND cmd = 'SELECT'
    AND roles = ARRAY['authenticated']::name[];

  IF select_policy_count <> 4 THEN
    RAISE EXCEPTION 'found % expected authenticated SELECT policies, expected 4', select_policy_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname IN ('identity', 'projects', 'audit', 'platform')
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  ) THEN
    RAISE EXCEPTION 'write policy found before write authorization model is defined';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'identity'
      AND tablename = 'profiles'
      AND policyname = 'profiles_select_own'
      AND qual LIKE '%auth.uid()%'
  ) THEN
    RAISE EXCEPTION 'profiles policy does not bind access to auth.uid()';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'identity'
      AND tablename = 'memberships'
      AND policyname = 'memberships_select_own'
      AND qual LIKE '%auth.uid()%'
  ) THEN
    RAISE EXCEPTION 'memberships policy does not bind access to auth.uid()';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'identity'
      AND tablename = 'companies'
      AND policyname = 'companies_select_active_members'
      AND qual LIKE '%is_company_member%'
  ) THEN
    RAISE EXCEPTION 'companies policy does not use membership authorization';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'projects'
      AND tablename = 'projects'
      AND policyname = 'projects_select_active_company_members'
      AND qual LIKE '%is_company_member%'
  ) THEN
    RAISE EXCEPTION 'projects policy does not use membership authorization';
  END IF;

  SELECT
    p.prosecdef,
    EXISTS (
      SELECT 1
      FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS setting
      WHERE setting LIKE 'search_path=%'
    ),
    position('auth.uid()' in pg_get_functiondef(p.oid)) > 0
  INTO
    function_is_security_definer,
    function_has_explicit_search_path,
    function_uses_auth_uid
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'identity'
    AND p.proname = 'is_company_member'
    AND pg_get_function_identity_arguments(p.oid) = 'p_company_id uuid';

  IF NOT function_is_security_definer THEN
    RAISE EXCEPTION 'identity.is_company_member is not SECURITY DEFINER';
  END IF;

  IF NOT function_has_explicit_search_path THEN
    RAISE EXCEPTION 'identity.is_company_member does not define search_path explicitly';
  END IF;

  IF NOT function_uses_auth_uid THEN
    RAISE EXCEPTION 'identity.is_company_member does not use auth.uid()';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'identity.is_company_member(uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated cannot execute identity.is_company_member';
  END IF;

  IF has_function_privilege(
    'anon',
    'identity.is_company_member(uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anon can execute identity.is_company_member';
  END IF;

  IF has_table_privilege('anon', 'projects.projects', 'SELECT') THEN
    RAISE EXCEPTION 'anon has direct SELECT privilege on projects.projects';
  END IF;

  IF NOT has_table_privilege('authenticated', 'projects.projects', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated lacks SELECT privilege on projects.projects';
  END IF;

  IF has_table_privilege('authenticated', 'projects.projects', 'INSERT')
    OR has_table_privilege('authenticated', 'projects.projects', 'UPDATE')
    OR has_table_privilege('authenticated', 'projects.projects', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated has project write privileges before write policies exist';
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
    '10000000-0000-0000-0000-00000000000a',
    'authenticated',
    'authenticated',
    'atlas-rls-user-a@example.invalid',
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
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-00000000000b',
    'authenticated',
    'authenticated',
    'atlas-rls-user-b@example.invalid',
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
VALUES
  ('10000000-0000-0000-0000-00000000000a', 'User A'),
  ('10000000-0000-0000-0000-00000000000b', 'User B')
ON CONFLICT (id) DO UPDATE
SET full_name = EXCLUDED.full_name;

INSERT INTO identity.companies (id, name, tax_number, created_by)
VALUES
  (
    '20000000-0000-0000-0000-00000000000a',
    'Company A',
    'RLS-COMPANY-A',
    '10000000-0000-0000-0000-00000000000a'
  ),
  (
    '20000000-0000-0000-0000-00000000000b',
    'Company B',
    'RLS-COMPANY-B',
    '10000000-0000-0000-0000-00000000000b'
  );

INSERT INTO identity.memberships (id, company_id, user_id, role, status)
VALUES
  (
    '30000000-0000-0000-0000-00000000000a',
    '20000000-0000-0000-0000-00000000000a',
    '10000000-0000-0000-0000-00000000000a',
    'owner',
    'active'
  ),
  (
    '30000000-0000-0000-0000-00000000000b',
    '20000000-0000-0000-0000-00000000000b',
    '10000000-0000-0000-0000-00000000000b',
    'owner',
    'active'
  );

INSERT INTO projects.projects (
  id,
  company_id,
  code,
  name,
  status,
  created_by
) VALUES
  (
    '40000000-0000-0000-0000-00000000000a',
    '20000000-0000-0000-0000-00000000000a',
    'PROJECT-A',
    'Project A',
    'active',
    '10000000-0000-0000-0000-00000000000a'
  ),
  (
    '40000000-0000-0000-0000-00000000000b',
    '20000000-0000-0000-0000-00000000000b',
    'PROJECT-B',
    'Project B',
    'active',
    '10000000-0000-0000-0000-00000000000b'
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-00000000000a',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-00000000000a","role":"authenticated"}',
  true
);

DO $$
DECLARE
  visible_count integer;
BEGIN
  IF (select auth.uid()) <> '10000000-0000-0000-0000-00000000000a'::uuid THEN
    RAISE EXCEPTION 'auth.uid() was not set to User A';
  END IF;

  IF NOT identity.is_company_member(
    '20000000-0000-0000-0000-00000000000a'::uuid
  ) THEN
    RAISE EXCEPTION 'User A is not recognized as active member of Company A';
  END IF;

  IF identity.is_company_member(
    '20000000-0000-0000-0000-00000000000b'::uuid
  ) THEN
    RAISE EXCEPTION 'User A is incorrectly recognized as member of Company B';
  END IF;

  SELECT count(*) INTO visible_count FROM identity.profiles;
  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'User A can see % profiles, expected 1', visible_count;
  END IF;

  SELECT count(*) INTO visible_count FROM identity.memberships;
  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'User A can see % memberships, expected 1', visible_count;
  END IF;

  SELECT count(*) INTO visible_count FROM identity.companies;
  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'User A can see % companies, expected 1', visible_count;
  END IF;

  SELECT count(*) INTO visible_count
  FROM projects.projects
  WHERE id = '40000000-0000-0000-0000-00000000000a'::uuid;
  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'User A cannot read Project A';
  END IF;

  SELECT count(*) INTO visible_count
  FROM projects.projects
  WHERE id = '40000000-0000-0000-0000-00000000000b'::uuid;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'User A can read Project B';
  END IF;

  SELECT count(*) INTO visible_count
  FROM projects.projects
  WHERE company_id = '20000000-0000-0000-0000-00000000000b'::uuid;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'client-supplied Company B id bypassed RLS for User A';
  END IF;
END
$$;

reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-00000000000b',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-00000000000b","role":"authenticated"}',
  true
);

DO $$
DECLARE
  visible_count integer;
BEGIN
  IF (select auth.uid()) <> '10000000-0000-0000-0000-00000000000b'::uuid THEN
    RAISE EXCEPTION 'auth.uid() was not set to User B';
  END IF;

  IF NOT identity.is_company_member(
    '20000000-0000-0000-0000-00000000000b'::uuid
  ) THEN
    RAISE EXCEPTION 'User B is not recognized as active member of Company B';
  END IF;

  IF identity.is_company_member(
    '20000000-0000-0000-0000-00000000000a'::uuid
  ) THEN
    RAISE EXCEPTION 'User B is incorrectly recognized as member of Company A';
  END IF;

  SELECT count(*) INTO visible_count
  FROM projects.projects
  WHERE id = '40000000-0000-0000-0000-00000000000b'::uuid;
  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'User B cannot read Project B';
  END IF;

  SELECT count(*) INTO visible_count
  FROM projects.projects
  WHERE id = '40000000-0000-0000-0000-00000000000a'::uuid;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'User B can read Project A';
  END IF;
END
$$;

reset role;

DO $$
BEGIN
  IF has_schema_privilege('anon', 'projects', 'USAGE') THEN
    RAISE EXCEPTION 'anon has USAGE on projects schema';
  END IF;

  IF has_table_privilege('anon', 'projects.projects', 'SELECT') THEN
    RAISE EXCEPTION 'anon can read projects.projects';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'projects'
      AND tablename = 'projects'
      AND 'anon'::name = ANY(roles)
  ) THEN
    RAISE EXCEPTION 'an anonymous project policy exists';
  END IF;
END
$$;

rollback;
