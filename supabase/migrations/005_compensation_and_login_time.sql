-- Add compensation mode and web login time tracking

-- Fixed salary for general staff, hourly for home workers.
alter table public.profiles
add column if not exists pay_mode text not null default 'fixed'
check (pay_mode in ('fixed', 'hourly'));

-- Track the time the employee first opened/logged into the website for that day.
alter table public.daily_attendance
add column if not exists web_login_time time;

