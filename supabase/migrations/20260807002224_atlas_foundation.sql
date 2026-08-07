create schema if not exists identity;
create schema if not exists projects;
create schema if not exists audit;
create schema if not exists platform;

create table identity.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table identity.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tax_number text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table identity.memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references identity.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  status text not null default 'invited',
  created_at timestamptz not null default now(),
  constraint memberships_company_user_unique unique (company_id, user_id),
  constraint memberships_status_check
    check (status in ('invited', 'active', 'suspended'))
);

create table projects.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references identity.companies(id),
  code text not null,
  name text not null,
  client_name text,
  location text,
  start_date date,
  end_date date,
  status text not null default 'draft',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint projects_company_code_unique unique (company_id, code),
  constraint projects_status_check
    check (status in ('draft', 'active', 'suspended', 'closed', 'cancelled')),
  constraint projects_date_range_check
    check (end_date is null or start_date is null or end_date >= start_date),
  constraint projects_version_check check (version >= 1)
);

create table audit.entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references identity.companies(id),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  module text not null,
  resource_type text not null,
  resource_id uuid,
  correlation_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table platform.outbox_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references identity.companies(id),
  event_type text not null,
  payload jsonb not null,
  occurred_at timestamptz not null default now(),
  processed_at timestamptz,
  retry_count integer not null default 0,
  last_error text,
  constraint outbox_messages_retry_count_check check (retry_count >= 0)
);

create index memberships_user_status_idx
  on identity.memberships (user_id, status);

create index memberships_company_status_idx
  on identity.memberships (company_id, status);

create index projects_company_status_idx
  on projects.projects (company_id, status);

create index audit_entries_company_created_at_idx
  on audit.entries (company_id, created_at desc);

create index outbox_messages_unprocessed_idx
  on platform.outbox_messages (occurred_at, id)
  where processed_at is null;
