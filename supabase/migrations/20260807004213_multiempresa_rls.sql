create or replace function identity.is_company_member(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from identity.memberships as membership
    where membership.company_id = p_company_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  );
$$;

revoke all on function identity.is_company_member(uuid) from public;
revoke all on function identity.is_company_member(uuid) from anon;
grant execute on function identity.is_company_member(uuid) to authenticated;

alter table identity.profiles enable row level security;
alter table identity.companies enable row level security;
alter table identity.memberships enable row level security;
alter table projects.projects enable row level security;
alter table audit.entries enable row level security;
alter table platform.outbox_messages enable row level security;

revoke all on schema identity, projects, audit, platform from anon;
revoke all on identity.profiles from anon;
revoke all on identity.companies from anon;
revoke all on identity.memberships from anon;
revoke all on projects.projects from anon;
revoke all on audit.entries from anon;
revoke all on platform.outbox_messages from anon;

grant usage on schema identity, projects to authenticated;
grant select on identity.profiles to authenticated;
grant select on identity.companies to authenticated;
grant select on identity.memberships to authenticated;
grant select on projects.projects to authenticated;

revoke insert, update, delete, truncate, references, trigger
  on identity.profiles from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on identity.companies from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on identity.memberships from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on projects.projects from authenticated;

create policy profiles_select_own
on identity.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy memberships_select_own
on identity.memberships
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy companies_select_active_members
on identity.companies
for select
to authenticated
using (identity.is_company_member(id));

create policy projects_select_active_company_members
on projects.projects
for select
to authenticated
using (identity.is_company_member(company_id));
