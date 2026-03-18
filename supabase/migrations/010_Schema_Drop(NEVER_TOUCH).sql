-- Drops Schema _crypto_aead_det_decrypt

-- =====================================================
-- HR Portal - Full Schema Teardown (single-run)
-- Drops all policies, triggers, functions, and tables
-- in dependency-safe order (children before parents).
-- =====================================================

-- =====================================================
-- 1. RLS Policies
-- =====================================================

-- profiles
drop policy if exists self_read  on public.profiles;
drop policy if exists admin_all  on public.profiles;

-- daily_attendance
drop policy if exists own_attendance            on public.daily_attendance;
drop policy if exists admin_manager_attendance  on public.daily_attendance;
drop policy if exists employee_insert           on public.daily_attendance;
drop policy if exists employee_update           on public.daily_attendance;

-- leave_log
drop policy if exists own_leave             on public.leave_log;
drop policy if exists admin_manager_leave   on public.leave_log;
drop policy if exists employee_insert_leave on public.leave_log;

-- salary
drop policy if exists own_salary   on public.salary;
drop policy if exists admin_salary on public.salary;

-- pay_rates
drop policy if exists own_pay_rates   on public.pay_rates;
drop policy if exists admin_pay_rates on public.pay_rates;

-- payroll_rewards
drop policy if exists own_payroll_rewards   on public.payroll_rewards;
drop policy if exists admin_payroll_rewards on public.payroll_rewards;

-- salary_rewards
drop policy if exists own_salary_rewards   on public.salary_rewards;
drop policy if exists admin_salary_rewards on public.salary_rewards;

-- leave_settings
drop policy if exists own_leave_settings   on public.leave_settings;
drop policy if exists admin_leave_settings on public.leave_settings;

-- =====================================================
-- 2. Triggers
-- =====================================================

drop trigger if exists on_auth_user_created               on auth.users;
drop trigger if exists leave_approval_balance_trigger     on public.leave_log;
drop trigger if exists leave_settings_apply_status_trigger on public.leave_log;
drop trigger if exists leave_settings_touch_updated_at    on public.leave_settings;
drop trigger if exists profiles_bootstrap_leave_settings  on public.profiles;

-- =====================================================
-- 3. Functions
-- =====================================================

drop function if exists public.handle_new_user()                    cascade;
drop function if exists public.apply_leave_approval_balance()       cascade;
drop function if exists public.apply_leave_status_to_settings()     cascade;
drop function if exists public.touch_leave_settings_updated_at()    cascade;
drop function if exists public.ensure_leave_settings_row(uuid)      cascade;
drop function if exists public.bootstrap_leave_settings_from_profile() cascade;
drop function if exists public.get_user_role()                      cascade;

-- =====================================================
-- 4. Tables (children before parents)
-- =====================================================

drop table if exists public.salary_rewards   cascade;
drop table if exists public.payroll_rewards  cascade;
drop table if exists public.pay_rates        cascade;
drop table if exists public.leave_settings   cascade;
drop table if exists public.daily_attendance cascade;
drop table if exists public.leave_log        cascade;
drop table if exists public.salary           cascade;
drop table if exists public.profiles         cascade;

-- =====================================================
-- Reload PostgREST schema cache
-- =====================================================

notify pgrst, 'reload schema';