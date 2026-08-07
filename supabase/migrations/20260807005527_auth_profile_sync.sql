create or replace function identity.ensure_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_full_name text;
begin
  resolved_full_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Utilizador'
  );

  insert into identity.profiles (id, full_name)
  values (new.id, resolved_full_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function identity.ensure_user_profile() from public;
revoke all on function identity.ensure_user_profile() from anon;
revoke all on function identity.ensure_user_profile() from authenticated;

drop trigger if exists on_auth_user_created_profile on auth.users;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row
execute function identity.ensure_user_profile();

insert into identity.profiles (id, full_name)
select
  users.id,
  coalesce(
    nullif(btrim(users.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
    'Utilizador'
  )
from auth.users as users
on conflict (id) do nothing;
