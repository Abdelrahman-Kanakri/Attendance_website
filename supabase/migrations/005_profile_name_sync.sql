-- Keep employee display names consistent across HR tables.
-- 1) Normalize profile full_name on insert/update.
-- 2) When profile.full_name changes, sync denormalized employee_name columns.

create or replace function public.normalize_profile_full_name()
returns trigger
language plpgsql
as $$
begin
  new.full_name := coalesce(nullif(trim(new.full_name), ''), 'Employee');
  return new;
end;
$$;

drop trigger if exists profiles_normalize_name on public.profiles;
create trigger profiles_normalize_name
before insert or update on public.profiles
for each row execute procedure public.normalize_profile_full_name();

create or replace function public.sync_profile_name_to_related_tables()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.full_name is distinct from old.full_name then
    update public.daily_attendance
    set employee_name = new.full_name
    where employee_id = new.id;

    update public.leave_log
    set employee_name = new.full_name
    where employee_id = new.id;

    update public.salary
    set employee_name = new.full_name
    where employee_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_sync_name_after_update on public.profiles;
create trigger profiles_sync_name_after_update
after update of full_name on public.profiles
for each row execute procedure public.sync_profile_name_to_related_tables();

-- One-time sync for existing data.
update public.daily_attendance a
set employee_name = p.full_name
from public.profiles p
where a.employee_id = p.id
  and a.employee_name is distinct from p.full_name;

update public.leave_log l
set employee_name = p.full_name
from public.profiles p
where l.employee_id = p.id
  and l.employee_name is distinct from p.full_name;

update public.salary s
set employee_name = p.full_name
from public.profiles p
where s.employee_id = p.id
  and s.employee_name is distinct from p.full_name;
