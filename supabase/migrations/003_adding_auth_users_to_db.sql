insert into public.profiles (id, full_name, email, role, is_active)
select
  u.id,
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), 'Employee') as full_name,
  u.email,
  'employee' as role,
  true as is_active
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
  and u.email is not null;
