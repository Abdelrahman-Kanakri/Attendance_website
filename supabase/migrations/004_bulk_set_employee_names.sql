-- Bulk set employee names by email.
-- Edit the VALUES list and re-run this script whenever needed.

begin;

with desired_names(email, full_name) as (
  values
    ('employee1@company.com', 'Employee One')
    -- Add more rows:
    -- ,('employee2@company.com', 'Employee Two')
    -- ,('employee3@company.com', 'Employee Three')
), cleaned as (
  select
    lower(trim(email)) as email,
    trim(full_name) as full_name
  from desired_names
  where nullif(trim(full_name), '') is not null
)
update public.profiles p
set full_name = c.full_name
from cleaned c
where lower(p.email) = c.email;

-- Keep denormalized names in historical tables in sync with profiles.
update public.daily_attendance a
set employee_name = p.full_name
from public.profiles p
where a.employee_id = p.id;

update public.leave_log l
set employee_name = p.full_name
from public.profiles p
where l.employee_id = p.id;

update public.salary s
set employee_name = p.full_name
from public.profiles p
where s.employee_id = p.id;

commit;
