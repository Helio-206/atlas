-- Keep the requester-name helper usable by public read wrappers, but never
-- allow it to resolve a profile outside a company shared with the caller.
create or replace function platform.procurement_requester_name(p_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if not exists (
    select 1
    from identity.memberships as caller_membership
    join identity.memberships as target_membership
      on target_membership.company_id = caller_membership.company_id
    where caller_membership.user_id = v_user_id
      and caller_membership.status = 'active'
      and target_membership.user_id = p_user_id
      and target_membership.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'profile_access_forbidden';
  end if;

  return (
    select profile.full_name
    from identity.profiles as profile
    where profile.id = p_user_id
  );
end;
$$;

-- This helper is only an implementation detail of privileged mutation
-- functions; authenticated callers must not invoke it directly.
revoke execute on function platform.calculate_purchase_request_total(uuid)
  from authenticated;

drop policy if exists approval_settings_select_company
  on procurement.approval_settings;

create policy approval_settings_select_company
on procurement.approval_settings
for select
to authenticated
using (
  identity.is_company_member(company_id)
  and platform.procurement_has_permission('Procurement.View')
);
