-- Fixed salary rewards (bonuses/adjustments) for fixed-mode employees

create table if not exists public.salary_rewards (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12, 2) not null check (amount <> 0),
  currency text not null default 'JOD',
  reward_date date not null default current_date,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create index if not exists salary_rewards_employee_id_idx on public.salary_rewards(employee_id);
create index if not exists salary_rewards_reward_date_idx on public.salary_rewards(reward_date);

alter table public.salary_rewards enable row level security;

drop policy if exists own_salary_rewards on public.salary_rewards;
create policy own_salary_rewards on public.salary_rewards
for select
using (employee_id = auth.uid());

drop policy if exists admin_salary_rewards on public.salary_rewards;
create policy admin_salary_rewards on public.salary_rewards
for all
using (
  exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  )
);

notify pgrst, 'reload schema';

