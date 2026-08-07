\set ON_ERROR_STOP on

begin;

DO $$
DECLARE
  internal_security_definer_count integer;
  public_security_invoker_count integer;
BEGIN
  SELECT count(*)
  INTO internal_security_definer_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'platform'
    AND p.proname IN (
      'current_company_id',
      'create_project',
      'update_project',
      'transition_project'
    )
    AND p.prosecdef
    AND EXISTS (
      SELECT 1
      FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS setting
      WHERE setting LIKE 'search_path=%'
    );

  IF internal_security_definer_count <> 4 THEN
    RAISE EXCEPTION 'projects internal functions are not hardened SECURITY DEFINER functions';
  END IF;

  SELECT count(*)
  INTO public_security_invoker_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'create_project',
      'update_project',
      'activate_project',
      'suspend_project',
      'close_project',
      'get_project',
      'list_projects'
    )
    AND NOT p.prosecdef
    AND EXISTS (
      SELECT 1
      FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS setting
      WHERE setting LIKE 'search_path=%'
    );

  IF public_security_invoker_count <> 7 THEN
    RAISE EXCEPTION 'projects Data API wrappers are not SECURITY INVOKER';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'public.create_project(text,text,text,text,date,date)',
    'EXECUTE'
  ) OR NOT has_function_privilege(
    'authenticated',
    'public.list_projects()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated cannot execute projects API';
  END IF;

  IF has_function_privilege(
    'anon',
    'public.create_project(text,text,text,text,date,date)',
    'EXECUTE'
  ) OR has_function_privilege(
    'anon',
    'public.list_projects()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anon can execute projects API';
  END IF;

  IF has_table_privilege('authenticated', 'projects.projects', 'INSERT')
    OR has_table_privilege('authenticated', 'projects.projects', 'UPDATE')
    OR has_table_privilege('authenticated', 'projects.projects', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated received direct project write access';
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
    '11000000-0000-0000-0000-00000000000a',
    'authenticated',
    'authenticated',
    'atlas-projects-a@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Projects User A"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '11000000-0000-0000-0000-00000000000b',
    'authenticated',
    'authenticated',
    'atlas-projects-b@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Projects User B"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

INSERT INTO identity.companies (id, name, tax_number, created_by)
VALUES
  (
    '21000000-0000-0000-0000-00000000000a',
    'Projects Company A',
    null,
    '11000000-0000-0000-0000-00000000000a'
  ),
  (
    '21000000-0000-0000-0000-00000000000b',
    'Projects Company B',
    null,
    '11000000-0000-0000-0000-00000000000b'
  );

INSERT INTO identity.memberships (company_id, user_id, role, status)
VALUES
  (
    '21000000-0000-0000-0000-00000000000a',
    '11000000-0000-0000-0000-00000000000a',
    'administrator',
    'active'
  ),
  (
    '21000000-0000-0000-0000-00000000000b',
    '11000000-0000-0000-0000-00000000000b',
    'administrator',
    'active'
  );

-- User A creates the first project. company_id is never an argument.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '11000000-0000-0000-0000-00000000000a',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-0000-0000-00000000000a","role":"authenticated"}',
  true
);

select public.create_project(
  'A-001',
  'Edifício Atlas',
  'Cliente A',
  'Luanda',
  '2026-08-10'::date,
  '2026-12-20'::date
);

reset role;

DO $$
DECLARE
  project_id uuid;
BEGIN
  SELECT project.id
  INTO project_id
  FROM projects.projects AS project
  WHERE project.company_id = '21000000-0000-0000-0000-00000000000a'::uuid
    AND project.code = 'A-001';

  IF project_id IS NULL THEN
    RAISE EXCEPTION 'project creation failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM projects.projects AS project
    WHERE project.id = project_id
      AND project.status = 'draft'
      AND project.version = 1
      AND project.created_by = '11000000-0000-0000-0000-00000000000a'::uuid
  ) THEN
    RAISE EXCEPTION 'created project does not start as draft version 1';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM audit.entries AS entry
    WHERE entry.company_id = '21000000-0000-0000-0000-00000000000a'::uuid
      AND entry.user_id = '11000000-0000-0000-0000-00000000000a'::uuid
      AND entry.action = 'project.created'
      AND entry.module = 'projects'
      AND entry.resource_id = project_id
      AND entry.metadata ->> 'status' = 'draft'
  ) THEN
    RAISE EXCEPTION 'project creation audit was not created';
  END IF;
END
$$;

-- Duplicate code is rejected inside the same company.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '11000000-0000-0000-0000-00000000000a',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

DO $$
BEGIN
  BEGIN
    PERFORM public.create_project('A-001', 'Duplicate Project', null, null, null, null);
    RAISE EXCEPTION 'duplicate project code was accepted';
  EXCEPTION
    WHEN unique_violation THEN
      IF SQLERRM <> 'duplicate_project_code' THEN
        RAISE;
      END IF;
  END;
END
$$;

-- Invalid dates fail before a project is written.
DO $$
BEGIN
  BEGIN
    PERFORM public.create_project(
      'A-BAD-DATE',
      'Invalid Date Project',
      null,
      null,
      '2026-09-10'::date,
      '2026-09-01'::date
    );
    RAISE EXCEPTION 'invalid project dates were accepted';
  EXCEPTION
    WHEN invalid_parameter_value THEN
      IF SQLERRM <> 'invalid_project_dates' THEN
        RAISE;
      END IF;
  END;
END
$$;

-- A separate draft proves invalid state transitions.
select public.create_project(
  'A-DRAFT',
  'Draft Transition Test',
  null,
  null,
  null,
  null
);

DO $$
DECLARE
  draft_id uuid;
BEGIN
  SELECT project.id
  INTO draft_id
  FROM projects.projects AS project
  WHERE project.code = 'A-DRAFT';

  BEGIN
    PERFORM public.suspend_project(draft_id, 1);
    RAISE EXCEPTION 'draft project was suspended';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM <> 'invalid_project_transition' THEN
        RAISE;
      END IF;
  END;
END
$$;

-- Valid activation increments the optimistic version.
DO $$
DECLARE
  project_id uuid;
  resulting_version integer;
BEGIN
  SELECT project.id
  INTO project_id
  FROM projects.projects AS project
  WHERE project.code = 'A-001';

  resulting_version := public.activate_project(project_id, 1);

  IF resulting_version <> 2 THEN
    RAISE EXCEPTION 'activation did not increment version to 2';
  END IF;
END
$$;

-- A stale writer loses even when its payload would otherwise be valid.
DO $$
DECLARE
  project_id uuid;
BEGIN
  SELECT project.id
  INTO project_id
  FROM projects.projects AS project
  WHERE project.code = 'A-001';

  BEGIN
    PERFORM public.update_project(
      project_id,
      1,
      'A-001',
      'Stale Update',
      null,
      null,
      null,
      null
    );
    RAISE EXCEPTION 'stale project update was accepted';
  EXCEPTION
    WHEN serialization_failure THEN
      IF SQLERRM <> 'project_version_conflict' THEN
        RAISE;
      END IF;
  END;
END
$$;

-- Correct-version edit succeeds and keeps the current state.
DO $$
DECLARE
  project_id uuid;
  resulting_version integer;
BEGIN
  SELECT project.id
  INTO project_id
  FROM projects.projects AS project
  WHERE project.code = 'A-001';

  resulting_version := public.update_project(
    project_id,
    2,
    'A-001',
    'Edifício Atlas Revisto',
    'Cliente A',
    'Luanda',
    '2026-08-10'::date,
    '2026-12-20'::date
  );

  IF resulting_version <> 3 THEN
    RAISE EXCEPTION 'valid update did not increment version';
  END IF;
END
$$;

-- Only draft projects may be activated.
DO $$
DECLARE
  project_id uuid;
BEGIN
  SELECT project.id
  INTO project_id
  FROM projects.projects AS project
  WHERE project.code = 'A-001';

  BEGIN
    PERFORM public.activate_project(project_id, 3);
    RAISE EXCEPTION 'active project was activated again';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM <> 'invalid_project_transition' THEN
        RAISE;
      END IF;
  END;
END
$$;

-- Complete the supported lifecycle and prove audit on every state command.
DO $$
DECLARE
  project_id uuid;
BEGIN
  SELECT project.id
  INTO project_id
  FROM projects.projects AS project
  WHERE project.code = 'A-001';

  IF public.suspend_project(project_id, 3) <> 4 THEN
    RAISE EXCEPTION 'suspension did not increment version';
  END IF;

  IF public.close_project(project_id, 4) <> 5 THEN
    RAISE EXCEPTION 'close did not increment version';
  END IF;
END
$$;

DO $$
DECLARE
  project_id uuid;
BEGIN
  SELECT project.id
  INTO project_id
  FROM projects.projects AS project
  WHERE project.code = 'A-001';

  BEGIN
    PERFORM public.update_project(
      project_id,
      5,
      'A-001',
      'Closed Project Edit',
      null,
      null,
      null,
      null
    );
    RAISE EXCEPTION 'closed project was edited';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM <> 'project_not_editable' THEN
        RAISE;
      END IF;
  END;
END
$$;

reset role;

DO $$
DECLARE
  project_id uuid;
BEGIN
  SELECT project.id
  INTO project_id
  FROM projects.projects AS project
  WHERE project.company_id = '21000000-0000-0000-0000-00000000000a'::uuid
    AND project.code = 'A-001';

  IF NOT EXISTS (
    SELECT 1
    FROM projects.projects AS project
    WHERE project.id = project_id
      AND project.name = 'Edifício Atlas Revisto'
      AND project.status = 'closed'
      AND project.version = 5
  ) THEN
    RAISE EXCEPTION 'project lifecycle state is incorrect';
  END IF;

  IF (
    SELECT count(*)
    FROM audit.entries AS entry
    WHERE entry.resource_id = project_id
      AND entry.action IN (
        'project.created',
        'project.activated',
        'project.suspended',
        'project.closed'
      )
  ) <> 4 THEN
    RAISE EXCEPTION 'project lifecycle audit trail is incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM projects.projects AS project
    WHERE project.company_id = '21000000-0000-0000-0000-00000000000a'::uuid
      AND project.code = 'A-BAD-DATE'
  ) THEN
    RAISE EXCEPTION 'invalid-date project left a partial record';
  END IF;
END
$$;

-- User B may use the same module without inheriting Company A's tenant.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '11000000-0000-0000-0000-00000000000b',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-0000-0000-00000000000b","role":"authenticated"}',
  true
);

select public.create_project(
  'B-001',
  'Projeto Empresa B',
  null,
  'Benguela',
  null,
  null
);

DO $$
BEGIN
  IF (SELECT count(*) FROM public.list_projects()) <> 1 THEN
    RAISE EXCEPTION 'User B list leaked another company projects';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.list_projects() AS project
    WHERE project.company_id <> '21000000-0000-0000-0000-00000000000b'::uuid
  ) THEN
    RAISE EXCEPTION 'User B list returned the wrong company';
  END IF;
END
$$;

reset role;

-- Store a known foreign UUID as if an attacker learned it through another channel.
select set_config(
  'atlas.test.project_b_id',
  (
    select project.id::text
    from projects.projects as project
    where project.company_id = '21000000-0000-0000-0000-00000000000b'::uuid
      and project.code = 'B-001'
  ),
  true
);

-- User A cannot read or mutate Company B's project even with its UUID.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '11000000-0000-0000-0000-00000000000a',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-0000-0000-00000000000a","role":"authenticated"}',
  true
);

DO $$
DECLARE
  foreign_project_id uuid := current_setting('atlas.test.project_b_id')::uuid;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM projects.projects AS project
    WHERE project.id = foreign_project_id
  ) THEN
    RAISE EXCEPTION 'RLS exposed Company B project to User A';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.get_project(foreign_project_id)
  ) THEN
    RAISE EXCEPTION 'GetProject exposed Company B project to User A';
  END IF;

  BEGIN
    PERFORM public.update_project(
      foreign_project_id,
      1,
      'B-001-HIJACK',
      'Hijacked Project',
      null,
      null,
      null,
      null
    );
    RAISE EXCEPTION 'User A mutated Company B project';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM <> 'project_not_found' THEN
        RAISE;
      END IF;
  END;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.list_projects() AS project
    WHERE project.company_id <> '21000000-0000-0000-0000-00000000000a'::uuid
  ) THEN
    RAISE EXCEPTION 'ListProjects leaked a foreign tenant';
  END IF;
END
$$;

reset role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM projects.projects AS project
    WHERE project.company_id = '21000000-0000-0000-0000-00000000000b'::uuid
      AND project.code = 'B-001'
      AND project.name = 'Projeto Empresa B'
      AND project.version = 1
  ) THEN
    RAISE EXCEPTION 'foreign-company mutation changed Company B project';
  END IF;
END
$$;

rollback;
