-- =====================================================
-- HR Portal - Full Schema (single-run)
-- Tables: profiles, daily_attendance, leave_log, salary,
--         pay_rates, payroll_rewards, leave_settings
-- RLS: enabled + policies
-- Triggers: auth->profiles, leave approval balance, leave_settings sync, bootstrap leave_settings
-- =====================================================

-- Extensions
create extension if not exists pgcrypto;

-- =====================================================
-- Core tables
-- =====================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text unique not null,
  role text not null default 'employee' check (role in ('employee', 'admin', 'manager')),
  department text,
  position text,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists public.salary (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.profiles(id) on delete cascade,
  employee_name text not null,
  salary numeric(12, 2) not null,
  currency text default 'JOD',
  effective_date date default current_date,
  created_at timestamptz default now()
);

create table if not exists public.leave_log (
  id uuid primary key default gen_random_uuid(),
  request_id serial unique,
  employee_id uuid references public.profiles(id) on delete cascade,
  employee_name text not null,
  date date not null,
  leave_type text not null check (leave_type in ('Annual Leave', 'Sick Leave', 'Unpaid')),
  reason text,
  status text default 'Pending' check (status in ('Pending', 'Approved', 'Rejected')),
  duration_days integer not null default 1 check (duration_days > 0),
  annual_leave_balance integer default 14,
  sick_leave_balance integer default 14,
  annual_leave_used integer default 0,
  sick_leave_used integer default 0,
  annual_leave_remaining integer generated always as (annual_leave_balance - annual_leave_used) stored,
  sick_leave_remaining integer generated always as (sick_leave_balance - sick_leave_used) stored,
  created_at timestamptz default now()
);

create table if not exists public.daily_attendance (
  id uuid primary key default gen_random_uuid(),
  record_id serial unique,
  employee_id uuid references public.profiles(id) on delete cascade,
  employee_name text not null,
  date date not null default current_date,
  check_in time,
  check_out time,
  worked_hours numeric(4, 2),
  net_hours_worked numeric(4, 2),
  total_late_time numeric(4, 2) default 0,
  job_description text,
  work_location text default 'Office' check (work_location in ('Office', 'Remote', 'Field')),
  management_note text,
  leave_log_id uuid references public.leave_log(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  constraint unique_employee_date unique (employee_id, date)
);

-- =====================================================
-- Auth -> profiles bootstrap
-- =====================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- =====================================================
-- Leave balance mutation on leave_log (legacy columns)
-- =====================================================

create or replace function public.apply_leave_approval_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'Approved' and old.status <> 'Approved' then
    if new.leave_type = 'Annual Leave' then
      if (old.annual_leave_used + old.duration_days) > old.annual_leave_balance then
        raise exception 'Insufficient annual leave balance';
      end if;
      new.annual_leave_used := old.annual_leave_used + old.duration_days;
      new.sick_leave_used := old.sick_leave_used;
    elsif new.leave_type = 'Sick Leave' then
      if (old.sick_leave_used + old.duration_days) > old.sick_leave_balance then
        raise exception 'Insufficient sick leave balance';
      end if;
      new.sick_leave_used := old.sick_leave_used + old.duration_days;
      new.annual_leave_used := old.annual_leave_used;
    else
      new.annual_leave_used := old.annual_leave_used;
      new.sick_leave_used := old.sick_leave_used;
    end if;
  elsif old.status = 'Approved' and new.status <> 'Approved' then
    if old.leave_type = 'Annual Leave' then
      new.annual_leave_used := greatest(old.annual_leave_used - old.duration_days, 0);
      new.sick_leave_used := old.sick_leave_used;
    elsif old.leave_type = 'Sick Leave' then
      new.sick_leave_used := greatest(old.sick_leave_used - old.duration_days, 0);
      new.annual_leave_used := old.annual_leave_used;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists leave_approval_balance_trigger on public.leave_log;
create trigger leave_approval_balance_trigger
before update on public.leave_log
for each row execute procedure public.apply_leave_approval_balance();

-- =====================================================
-- Hourly payroll additions
-- =====================================================

create table if not exists public.pay_rates (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  rate_per_hour numeric(12, 2) not null check (rate_per_hour >= 0),
  currency text not null default 'JOD',
  effective_date date not null default current_date,
  created_at timestamptz default now(),
  constraint pay_rates_unique_employee_effective unique (employee_id, effective_date)
);

create index if not exists pay_rates_employee_id_idx on public.pay_rates(employee_id);

create table if not exists public.payroll_rewards (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12, 2) not null check (amount <> 0),
  currency text not null default 'JOD',
  reward_date date not null default current_date,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create index if not exists payroll_rewards_employee_id_idx on public.payroll_rewards(employee_id);
create index if not exists payroll_rewards_reward_date_idx on public.payroll_rewards(reward_date);

-- =====================================================
-- Leave settings (HR-controlled allowances) + bootstrap
-- =====================================================

-- FIX: Explicitly drop the table so the missing column error is resolved cleanly
drop table if exists public.leave_settings cascade;

create table public.leave_settings (
  employee_id uuid primary key references public.profiles(id) on delete cascade,
  annual_allowance integer not null default 14 check (annual_allowance >= 0),
  sick_allowance integer not null default 14 check (sick_allowance >= 0),
  annual_used integer not null default 0 check (annual_used >= 0),
  sick_used integer not null default 0 check (sick_used >= 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function public.touch_leave_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists leave_settings_touch_updated_at on public.leave_settings;
create trigger leave_settings_touch_updated_at
before update on public.leave_settings
for each row execute procedure public.touch_leave_settings_updated_at();

-- Ensure leave_settings exists for an employee_id
create or replace function public.ensure_leave_settings_row(p_employee_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.leave_settings (employee_id)
  values (p_employee_id)
  on conflict (employee_id) do nothing;
end;
$$;

-- Sync used counters on approval/unapproval
create or replace function public.apply_leave_status_to_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta int := 0;
begin
  perform public.ensure_leave_settings_row(new.employee_id);

  if new.status = 'Approved' and old.status <> 'Approved' then
    delta := new.duration_days;
  elsif old.status = 'Approved' and new.status <> 'Approved' then
    delta := -old.duration_days;
  else
    return new;
  end if;

  if coalesce(new.leave_type, '') = 'Annual Leave' then
    update public.leave_settings
    set annual_used = greatest(annual_used + delta, 0)
    where employee_id = new.employee_id;
  elsif coalesce(new.leave_type, '') = 'Sick Leave' then
    update public.leave_settings
    set sick_used = greatest(sick_used + delta, 0)
    where employee_id = new.employee_id;
  end if;

  return new;
end;
$$;

drop trigger if exists leave_settings_apply_status_trigger on public.leave_log;
create trigger leave_settings_apply_status_trigger
after update on public.leave_log
for each row execute procedure public.apply_leave_status_to_settings();

-- Bootstrap leave_settings from profiles
create or replace function public.bootstrap_leave_settings_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.leave_settings (employee_id)
  values (new.id)
  on conflict (employee_id) do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_bootstrap_leave_settings on public.profiles;
create trigger profiles_bootstrap_leave_settings
after insert on public.profiles
for each row execute procedure public.bootstrap_leave_settings_from_profile();

-- Backfill for existing profiles
insert into public.leave_settings (employee_id)
select id from public.profiles
on conflict (employee_id) do nothing;

-- =====================================================
-- RLS enable
-- =====================================================

alter table public.profiles enable row level security;
alter table public.daily_attendance enable row level security;
alter table public.leave_log enable row level security;
alter table public.salary enable row level security;
alter table public.pay_rates enable row level security;
alter table public.payroll_rewards enable row level security;
alter table public.leave_settings enable row level security;

-- =====================================================
-- RLS Helper Functions (Fixes infinite recursion)
-- =====================================================

create or replace function public.get_user_role()
returns text
language sql
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- =====================================================
-- RLS policies
-- (kept consistent with the frontend: admin is privileged; employees are self-only)
-- =====================================================

-- PROFILES
drop policy if exists self_read on public.profiles;
create policy self_read on public.profiles
for select
using (auth.uid() = id);

drop policy if exists admin_all on public.profiles;
create policy admin_all on public.profiles
for all
using (public.get_user_role() = 'admin')
with check (public.get_user_role() = 'admin');

-- DAILY ATTENDANCE
drop policy if exists own_attendance on public.daily_attendance;
create policy own_attendance on public.daily_attendance
for select
using (employee_id = auth.uid());

drop policy if exists admin_manager_attendance on public.daily_attendance;
create policy admin_manager_attendance on public.daily_attendance
for all
using (public.get_user_role() in ('admin', 'manager'))
with check (public.get_user_role() in ('admin', 'manager'));

drop policy if exists employee_insert on public.daily_attendance;
create policy employee_insert on public.daily_attendance
for insert
with check (employee_id = auth.uid());

drop policy if exists employee_update on public.daily_attendance;
create policy employee_update on public.daily_attendance
for update
using (employee_id = auth.uid())
with check (employee_id = auth.uid());

-- LEAVE LOG
drop policy if exists own_leave on public.leave_log;
create policy own_leave on public.leave_log
for select
using (employee_id = auth.uid());

drop policy if exists admin_manager_leave on public.leave_log;
create policy admin_manager_leave on public.leave_log
for all
using (public.get_user_role() in ('admin', 'manager'))
with check (public.get_user_role() in ('admin', 'manager'));

drop policy if exists employee_insert_leave on public.leave_log;
create policy employee_insert_leave on public.leave_log
for insert
with check (employee_id = auth.uid());

-- SALARY (legacy table; optional)
drop policy if exists own_salary on public.salary;
create policy own_salary on public.salary
for select
using (employee_id = auth.uid());

drop policy if exists admin_salary on public.salary;
create policy admin_salary on public.salary
for all
using (public.get_user_role() = 'admin')
with check (public.get_user_role() = 'admin');

-- PAY RATES
drop policy if exists own_pay_rates on public.pay_rates;
create policy own_pay_rates on public.pay_rates
for select
using (employee_id = auth.uid());

drop policy if exists admin_pay_rates on public.pay_rates;
create policy admin_pay_rates on public.pay_rates
for all
using (public.get_user_role() = 'admin')
with check (public.get_user_role() = 'admin');

-- PAYROLL REWARDS
drop policy if exists own_payroll_rewards on public.payroll_rewards;
create policy own_payroll_rewards on public.payroll_rewards
for select
using (employee_id = auth.uid());

drop policy if exists admin_payroll_rewards on public.payroll_rewards;
create policy admin_payroll_rewards on public.payroll_rewards
for all
using (public.get_user_role() = 'admin')
with check (public.get_user_role() = 'admin');

-- LEAVE SETTINGS
drop policy if exists own_leave_settings on public.leave_settings;
create policy own_leave_settings on public.leave_settings
for select
using (employee_id = auth.uid());

drop policy if exists admin_leave_settings on public.leave_settings;
create policy admin_leave_settings on public.leave_settings
for all
using (public.get_user_role() = 'admin')
with check (public.get_user_role() = 'admin');

-- Reload PostgREST schema cache to ensure the API recognizes the dropped/recreated table
notify pgrst, 'reload schema';