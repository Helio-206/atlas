\set ON_ERROR_STOP on

begin;

DO $$
DECLARE
  function_is_security_definer boolean;
  function_has_search_path boolean;
BEGIN
  SELECT
    p.prosecdef,
    EXISTS (
      SELECT 1
      FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS setting
      WHERE setting LIKE 'search_path=%'
    )
  INTO function_is_security_definer, function_has_search_path
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'identity'
    AND p.proname = 'ensure_user_profile';

  IF NOT function_is_security_definer THEN
    RAISE EXCEPTION 'identity.ensure_user_profile must be SECURITY DEFINER';
  END IF;

  IF NOT function_has_search_path THEN
    RAISE EXCEPTION 'identity.ensure_user_profile must define search_path';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'identity.ensure_user_profile()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated can execute internal profile trigger function';
  END IF;

  IF has_function_privilege(
    'anon',
    'identity.ensure_user_profile()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anon can execute internal profile trigger function';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
      AND tgname = 'on_auth_user_created_profile'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'auth.users profile trigger is missing';
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
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-0000-0000-0000000000c1',
  'authenticated',
  'authenticated',
  'profile-trigger@example.invalid',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Perfil Automático"}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
);

DO $$
DECLARE
  profile_name text;
BEGIN
  SELECT full_name
  INTO profile_name
  FROM identity.profiles
  WHERE id = '10000000-0000-0000-0000-0000000000c1'::uuid;

  IF profile_name <> 'Perfil Automático' THEN
    RAISE EXCEPTION 'profile trigger produced unexpected full_name: %', profile_name;
  END IF;
END
$$;

rollback;
