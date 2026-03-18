# SKILL.md — HR Portal (Full-Stack Agent Guide)

## 1. Overview

Build a clean, production-ready **HR Portal** web application. The app handles:
- Employee authentication (email + password)
- Daily attendance tracking (check-in / check-out)
- Leave request submission and approval workflow
- Salary records viewing
- An admin dashboard with key HR metrics

---

## 2. Recommended Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + TypeScript | Fast dev server, type safety |
| Styling | Tailwind CSS + shadcn/ui | Clean, consistent components fast |
| Backend / DB | **Supabase** | Auth + PostgreSQL + REST API + RLS — zero backend code needed |
| Auth | Supabase Auth (email/password) | Built-in, secure, no custom JWT logic |
| State | React Context + TanStack Query | Auth state global, server data cached |
| Routing | React Router v6 | Standard SPA routing |
| Forms | React Hook Form + Zod | Validation with schema |
| Charts | Recharts | Lightweight for HR dashboards |

> **Why Supabase over a custom backend?**
> It eliminates writing an Express/FastAPI backend entirely. You get a hosted PostgreSQL database, auto-generated REST/GraphQL APIs, Row-Level Security (so employees can only see their own data), real-time updates, and a built-in admin dashboard — all for free on the starter tier. This is the right choice for an HR portal at this scale.

---

## 3. Project Structure

```
hr-portal/
├── src/
│   ├── components/
│   │   ├── ui/                  # shadcn/ui primitives (Button, Input, Badge…)
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Topbar.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   ├── attendance/
│   │   │   ├── AttendanceForm.tsx
│   │   │   └── AttendanceTable.tsx
│   │   ├── leave/
│   │   │   ├── LeaveRequestForm.tsx
│   │   │   └── LeaveTable.tsx
│   │   ├── salary/
│   │   │   └── SalaryCard.tsx
│   │   └── dashboard/
│   │       └── StatsGrid.tsx
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── AttendancePage.tsx
│   │   ├── LeavePage.tsx
│   │   ├── SalaryPage.tsx
│   │   └── AdminPage.tsx        # admin only
│   ├── lib/
│   │   ├── supabase.ts          # Supabase client singleton
│   │   └── utils.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useAttendance.ts
│   │   ├── useLeave.ts
│   │   └── useSalary.ts
│   ├── context/
│   │   └── AuthContext.tsx
│   ├── types/
│   │   └── index.ts             # All TypeScript types
│   └── App.tsx
├── .env.local                   # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
└── package.json
```

---

## 4. Supabase Database Schema

### Table: `profiles`
Extends `auth.users`. Created automatically on user signup via a trigger.

```sql
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null,
  email        text unique not null,
  role         text not null default 'employee',  -- 'employee' | 'admin' | 'manager'
  department   text,
  position     text,
  created_at   timestamptz default now()
);
```

### Table: `salary`
```sql
create table public.salary (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid references public.profiles(id) on delete cascade,
  employee_name  text not null,
  salary         numeric(12, 2) not null,
  currency       text default 'JOD',
  effective_date date default current_date,
  created_at     timestamptz default now()
);
```

### Table: `leave_log`
```sql
create table public.leave_log (
  id                      uuid primary key default gen_random_uuid(),
  request_id              serial unique,
  employee_id             uuid references public.profiles(id) on delete cascade,
  employee_name           text not null,
  date                    date not null,
  leave_type              text not null,   -- 'Annual Leave' | 'Sick Leave' | 'Unpaid'
  reason                  text,
  status                  text default 'Pending',  -- 'Pending' | 'Approved' | 'Rejected'
  duration_days           integer not null default 1,
  annual_leave_balance    integer default 14,
  sick_leave_balance      integer default 14,
  annual_leave_used       integer default 0,
  sick_leave_used         integer default 0,
  annual_leave_remaining  integer generated always as (annual_leave_balance - annual_leave_used) stored,
  sick_leave_remaining    integer generated always as (sick_leave_balance - sick_leave_used) stored,
  created_at              timestamptz default now()
);
```

### Table: `daily_attendance`
```sql
create table public.daily_attendance (
  id               uuid primary key default gen_random_uuid(),
  record_id        serial unique,
  employee_id      uuid references public.profiles(id) on delete cascade,
  employee_name    text not null,
  date             date not null default current_date,
  check_in         time,
  check_out        time,
  worked_hours     numeric(4,2),
  net_hours_worked numeric(4,2),
  total_late_time  numeric(4,2) default 0,
  job_description  text,
  work_location    text default 'Office',  -- 'Office' | 'Remote' | 'Field'
  management_note  text,
  leave_log_id     uuid references public.leave_log(id),
  created_by       uuid references public.profiles(id),
  created_at       timestamptz default now(),
  constraint unique_employee_date unique (employee_id, date)
);
```

---

## 5. Row-Level Security (RLS) Policies

Enable RLS on all tables. Apply these policies:

```sql
-- Profiles: users see their own, admins see all
alter table public.profiles enable row level security;
create policy "self_read" on public.profiles for select using (auth.uid() = id);
create policy "admin_all" on public.profiles for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Attendance: employees see own, admins/managers see all
alter table public.daily_attendance enable row level security;
create policy "own_attendance" on public.daily_attendance for select using (employee_id = auth.uid());
create policy "admin_manager_attendance" on public.daily_attendance for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','manager'))
);
create policy "employee_insert" on public.daily_attendance for insert with check (employee_id = auth.uid());

-- Leave: same pattern
alter table public.leave_log enable row level security;
create policy "own_leave" on public.leave_log for select using (employee_id = auth.uid());
create policy "admin_manager_leave" on public.leave_log for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','manager'))
);
create policy "employee_insert_leave" on public.leave_log for insert with check (employee_id = auth.uid());

-- Salary: employees see own only
alter table public.salary enable row level security;
create policy "own_salary" on public.salary for select using (employee_id = auth.uid());
create policy "admin_salary" on public.salary for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
```

---

## 6. Auth Flow

1. **Login Page** (`/login`)
   - Email + Password form
   - Call `supabase.auth.signInWithPassword({ email, password })`
   - On success → redirect to `/dashboard`
   - Show error inline (never use `alert()`)

2. **Auto-signup trigger** — Create a `handle_new_user` function + trigger in Supabase that inserts into `profiles` on `auth.users` insert.

3. **ProtectedRoute** component — wraps all authenticated pages, checks `AuthContext`, redirects to `/login` if no session.

4. **Role-based rendering** — Admin-only pages (Admin panel, approve/reject leaves) are hidden from employees via role check from `AuthContext`.

---

## 7. Pages & Features

### `/login`
- Centered card layout
- Logo / HR Portal heading
- Email input, password input, Sign In button
- "Forgot password?" link → Supabase magic link or password reset email
- No registration page (admin creates employees via Supabase dashboard or an admin invite page)

### `/dashboard`
- Stats cards: Total Employees, Present Today, On Leave Today, Pending Leave Requests
- Weekly attendance bar chart (Recharts)
- Recent leave requests table (last 5)
- Quick-action buttons: "Log Attendance", "Request Leave"

### `/attendance`
- **Employee view**: Submit today's check-in/check-out form (pre-fills today's date, employee name from profile)
- Fields: Date, Check In (time picker), Check Out (time picker), Work Location, Job Description
- Worked hours auto-calculated: `check_out - check_in`
- Table below showing their own attendance history
- **Admin/Manager view**: Full table of all employees, with management_note editable inline

### `/leave`
- **Employee view**:
  - Leave balance summary card (Annual: X/14 used, Sick: X/14 used)
  - Submit leave request form: Leave Type, Date, Duration, Reason
  - Table of their own leave history with status badge (Pending / Approved / Rejected)
- **Admin/Manager view**:
  - Full requests table with Approve / Reject action buttons
  - Clicking Approve updates `status = 'Approved'` and increments `annual_leave_used` or `sick_leave_used`

### `/salary`
- **Employee view**: Single card showing their current salary + currency
- **Admin view**: Full table of all employees with salaries, editable

### `/admin` (admin role only)
- Employee list with invite/deactivate actions
- Role assignment (employee / manager / admin)
- System-wide stats

---

## 8. Key Components to Build

### `<AttendanceForm />`
```tsx
// Fields: date (default today), check_in (time), check_out (time),
// work_location (select), job_description (textarea)
// On submit: upsert to daily_attendance
// Auto-compute worked_hours = diff(check_out, check_in)
```

### `<LeaveRequestForm />`
```tsx
// Fields: leave_type (select: Annual/Sick/Unpaid), date (date picker),
// duration_days (number, min 1), reason (textarea)
// Validate: duration <= remaining balance for that type
// On submit: insert to leave_log with status = 'Pending'
```

### `<StatusBadge status />`
```tsx
// Pending → yellow, Approved → green, Rejected → red
// Use Tailwind classes, no external badge lib needed
```

### `<ProtectedRoute role? />`
```tsx
// If no session → redirect /login
// If role prop given and user.role !== role → redirect /dashboard (403)
```

---

## 9. Environment Variables

```env
VITE_SUPABASE_URL=https://xyzxyz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Never expose the `service_role` key on the frontend.

---

## 10. Styling Guidelines

- Use **Tailwind CSS** throughout. No inline styles.
- Color palette: neutral grays for background, `indigo-600` as primary brand color
- Sidebar: dark (`gray-900`), text white
- Cards: white background, `shadow-sm`, `rounded-xl`, `p-6`
- Tables: striped rows (`even:bg-gray-50`), hover highlight
- All forms use consistent label → input → error-message structure
- Mobile responsive: sidebar collapses to hamburger on `md:` breakpoint

---

## 11. Setup Commands

```bash
npm create vite@latest hr-portal -- --template react-ts
cd hr-portal
npm install
npm install @supabase/supabase-js @tanstack/react-query react-router-dom
npm install react-hook-form @hookform/resolvers zod
npm install recharts
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
# install shadcn/ui
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input card badge table dialog select textarea
```

---

## 12. Agent Rules

- **Never hardcode user IDs or emails** — always read from `supabase.auth.getUser()`
- **Always handle loading and error states** for every query
- **Never use `alert()`** — use toast notifications (shadcn `Toaster`) or inline error messages
- **All timestamps stored as UTC** in Supabase, displayed in local timezone
- **Worked hours** are always computed client-side from check_in / check_out, never manually entered
- **Leave balance deduction** happens server-side via a Supabase database function/trigger, not in frontend logic
- Generate a complete, runnable project — no placeholder `// TODO` comments
- The app must work end-to-end with real Supabase credentials
