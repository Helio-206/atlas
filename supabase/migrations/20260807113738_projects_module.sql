alter table projects.projects
  add constraint projects_code_not_blank_check
    check (char_length(btrim(code)) between 1 and 64),
  add constraint projects_name_not_blank_check
    check (char_length(btrim(name)) between 2 and 160);

create index projects_company_created_at_idx
  on projects.projects (company_id, created_at desc);

-- The tenant is intentionally derived from the authenticated session. Until a
-- tenant-switching flow exists, Atlas requires exactly one active membership.
create or replace function platform.current_company_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_active_count integer;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authentication_required';
  end if;

  select count(*)
  into v_active_count
  from identity.memberships as membership
  where membership.user_id = v_user_id
    and membership.status = 'active';

  if v_active_count = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'active_membership_required';
  end if;

  if v_active_count > 1 then
    raise exception using
      errcode = 'P0001',
      message = 'tenant_context_ambiguous';
  end if;

  select membership.company_id
  into v_company_id
  from identity.memberships as membership
  where membership.user_id = v_user_id
    and membership.status = 'active'
  limit 1;

  return v_company_id;
end;
$$;

create or replace function platform.create_project(
  p_code text,
  p_name text,
  p_client_name text default null,
  p_location text default null,
  p_start_date date default null,
  p_end_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_project_id uuid;
  v_code text := btrim(p_code);
  v_name text := btrim(p_name);
  v_client_name text := nullif(btrim(p_client_name), '');
  v_location text := nullif(btrim(p_location), '');
  v_constraint_name text;
begin
  v_company_id := platform.current_company_id();

  if char_length(v_code) < 1 or char_length(v_code) > 64 then
    raise exception using errcode = '22023', message = 'invalid_project_code';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 160 then
    raise exception using errcode = '22023', message = 'invalid_project_name';
  end if;

  if p_end_date is not null
    and p_start_date is not null
    and p_end_date < p_start_date then
    raise exception using errcode = '22023', message = 'invalid_project_dates';
  end if;

  insert into projects.projects (
    company_id,
    code,
    name,
    client_name,
    location,
    start_date,
    end_date,
    status,
    created_by,
    version
  ) values (
    v_company_id,
    v_code,
    v_name,
    v_client_name,
    v_location,
    p_start_date,
    p_end_date,
    'draft',
    v_user_id,
    1
  )
  returning id into v_project_id;

  insert into audit.entries (
    company_id,
    user_id,
    action,
    module,
    resource_type,
    resource_id,
    metadata
  ) values (
    v_company_id,
    v_user_id,
    'project.created',
    'projects',
    'project',
    v_project_id,
    jsonb_build_object(
      'code', v_code,
      'status', 'draft',
      'version', 1
    )
  );

  return v_project_id;
exception
  when unique_violation then
    get stacked diagnostics v_constraint_name = constraint_name;

    if v_constraint_name = 'projects_company_code_unique' then
      raise exception using
        errcode = '23505',
        message = 'duplicate_project_code';
    end if;

    raise;
end;
$$;

create or replace function platform.update_project(
  p_project_id uuid,
  p_expected_version integer,
  p_code text,
  p_name text,
  p_client_name text default null,
  p_location text default null,
  p_start_date date default null,
  p_end_date date default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_status text;
  v_current_version integer;
  v_new_version integer;
  v_code text := btrim(p_code);
  v_name text := btrim(p_name);
  v_client_name text := nullif(btrim(p_client_name), '');
  v_location text := nullif(btrim(p_location), '');
  v_constraint_name text;
begin
  v_company_id := platform.current_company_id();

  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'invalid_project_version';
  end if;

  if char_length(v_code) < 1 or char_length(v_code) > 64 then
    raise exception using errcode = '22023', message = 'invalid_project_code';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 160 then
    raise exception using errcode = '22023', message = 'invalid_project_name';
  end if;

  if p_end_date is not null
    and p_start_date is not null
    and p_end_date < p_start_date then
    raise exception using errcode = '22023', message = 'invalid_project_dates';
  end if;

  select project.status, project.version
  into v_status, v_current_version
  from projects.projects as project
  where project.id = p_project_id
    and project.company_id = v_company_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'project_not_found';
  end if;

  if v_current_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'project_version_conflict';
  end if;

  if v_status in ('closed', 'cancelled') then
    raise exception using errcode = 'P0001', message = 'project_not_editable';
  end if;

  update projects.projects as project
  set code = v_code,
      name = v_name,
      client_name = v_client_name,
      location = v_location,
      start_date = p_start_date,
      end_date = p_end_date,
      updated_at = now(),
      version = project.version + 1
  where project.id = p_project_id
    and project.company_id = v_company_id
    and project.version = p_expected_version
  returning project.version into v_new_version;

  if not found then
    raise exception using errcode = '40001', message = 'project_version_conflict';
  end if;

  return v_new_version;
exception
  when unique_violation then
    get stacked diagnostics v_constraint_name = constraint_name;

    if v_constraint_name = 'projects_company_code_unique' then
      raise exception using
        errcode = '23505',
        message = 'duplicate_project_code';
    end if;

    raise;
end;
$$;

create or replace function platform.transition_project(
  p_project_id uuid,
  p_expected_version integer,
  p_transition text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_status text;
  v_target_status text;
  v_audit_action text;
  v_current_version integer;
  v_new_version integer;
begin
  v_company_id := platform.current_company_id();

  if p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'invalid_project_version';
  end if;

  select project.status, project.version
  into v_status, v_current_version
  from projects.projects as project
  where project.id = p_project_id
    and project.company_id = v_company_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'project_not_found';
  end if;

  if v_current_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'project_version_conflict';
  end if;

  case p_transition
    when 'activate' then
      if v_status <> 'draft' then
        raise exception using errcode = 'P0001', message = 'invalid_project_transition';
      end if;
      v_target_status := 'active';
      v_audit_action := 'project.activated';
    when 'suspend' then
      if v_status <> 'active' then
        raise exception using errcode = 'P0001', message = 'invalid_project_transition';
      end if;
      v_target_status := 'suspended';
      v_audit_action := 'project.suspended';
    when 'close' then
      if v_status not in ('active', 'suspended') then
        raise exception using errcode = 'P0001', message = 'invalid_project_transition';
      end if;
      v_target_status := 'closed';
      v_audit_action := 'project.closed';
    else
      raise exception using errcode = '22023', message = 'invalid_project_transition_command';
  end case;

  update projects.projects as project
  set status = v_target_status,
      updated_at = now(),
      version = project.version + 1
  where project.id = p_project_id
    and project.company_id = v_company_id
    and project.version = p_expected_version
  returning project.version into v_new_version;

  if not found then
    raise exception using errcode = '40001', message = 'project_version_conflict';
  end if;

  insert into audit.entries (
    company_id,
    user_id,
    action,
    module,
    resource_type,
    resource_id,
    metadata
  ) values (
    v_company_id,
    v_user_id,
    v_audit_action,
    'projects',
    'project',
    p_project_id,
    jsonb_build_object(
      'from_status', v_status,
      'to_status', v_target_status,
      'from_version', p_expected_version,
      'to_version', v_new_version
    )
  );

  return v_new_version;
end;
$$;

-- Public Data API functions are SECURITY INVOKER. Privileged writes stay in
-- the unexposed platform schema, while reads still execute under RLS.
create or replace function public.create_project(
  code text,
  name text,
  client_name text default null,
  location text default null,
  start_date date default null,
  end_date date default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select platform.create_project(
    code,
    name,
    client_name,
    location,
    start_date,
    end_date
  );
$$;

create or replace function public.update_project(
  project_id uuid,
  expected_version integer,
  code text,
  name text,
  client_name text default null,
  location text default null,
  start_date date default null,
  end_date date default null
)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select platform.update_project(
    project_id,
    expected_version,
    code,
    name,
    client_name,
    location,
    start_date,
    end_date
  );
$$;

create or replace function public.activate_project(
  project_id uuid,
  expected_version integer
)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select platform.transition_project(project_id, expected_version, 'activate');
$$;

create or replace function public.suspend_project(
  project_id uuid,
  expected_version integer
)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select platform.transition_project(project_id, expected_version, 'suspend');
$$;

create or replace function public.close_project(
  project_id uuid,
  expected_version integer
)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select platform.transition_project(project_id, expected_version, 'close');
$$;

create or replace function public.get_project(project_id uuid)
returns setof projects.projects
language sql
stable
security invoker
set search_path = ''
as $$
  select project.*
  from projects.projects as project
  where project.id = project_id
    and project.company_id = platform.current_company_id();
$$;

create or replace function public.list_projects()
returns setof projects.projects
language sql
stable
security invoker
set search_path = ''
as $$
  select project.*
  from projects.projects as project
  where project.company_id = platform.current_company_id()
  order by project.created_at desc, project.id;
$$;

grant usage on schema platform to authenticated;

revoke all on function platform.current_company_id() from public, anon;
revoke all on function platform.create_project(text, text, text, text, date, date) from public, anon;
revoke all on function platform.update_project(uuid, integer, text, text, text, text, date, date) from public, anon;
revoke all on function platform.transition_project(uuid, integer, text) from public, anon;

grant execute on function platform.current_company_id() to authenticated;
grant execute on function platform.create_project(text, text, text, text, date, date) to authenticated;
grant execute on function platform.update_project(uuid, integer, text, text, text, text, date, date) to authenticated;
grant execute on function platform.transition_project(uuid, integer, text) to authenticated;

revoke all on function public.create_project(text, text, text, text, date, date) from public, anon;
revoke all on function public.update_project(uuid, integer, text, text, text, text, date, date) from public, anon;
revoke all on function public.activate_project(uuid, integer) from public, anon;
revoke all on function public.suspend_project(uuid, integer) from public, anon;
revoke all on function public.close_project(uuid, integer) from public, anon;
revoke all on function public.get_project(uuid) from public, anon;
revoke all on function public.list_projects() from public, anon;

grant execute on function public.create_project(text, text, text, text, date, date) to authenticated;
grant execute on function public.update_project(uuid, integer, text, text, text, text, date, date) to authenticated;
grant execute on function public.activate_project(uuid, integer) to authenticated;
grant execute on function public.suspend_project(uuid, integer) to authenticated;
grant execute on function public.close_project(uuid, integer) to authenticated;
grant execute on function public.get_project(uuid) to authenticated;
grant execute on function public.list_projects() to authenticated;

revoke insert, update, delete, truncate, references, trigger
  on projects.projects from authenticated;
