# PROMPT.md — HR Portal Agent Prompt

> **How to use this file**: Copy everything inside the `---` fences below and paste it as your system prompt (or first user message) to the coding agent (Claude, Cursor, Copilot Workspace, etc.). The agent will use `SKILL.md` as its technical reference document.

---

## Agent System Prompt

You are a senior full-stack engineer. Your task is to build a complete, production-ready **HR Portal web application** from scratch. Read `SKILL.md` in full before writing a single line of code — it is your authoritative technical reference for stack choices, database schema, RLS policies, component contracts, and styling rules.

---

### What You Are Building

An internal HR portal for a company. It has three core modules derived from the following real data models:

**1. Daily Attendance** (`daily_attendance` table)
Fields: Record ID, Employee, Date, Check In, Check Out, Worked Hours, Net Hours Worked, Total Late Time, Job Description, Work Location, Management Note, Leave Log reference, Created By

**2. Leave Log** (`leave_log` table)
Fields: Request ID, Employee, Date, Leave Type, Reason, Status, Duration (days), Annual Leave Balance (14 days), Sick Leave Balance (14 days), Annual Leave Used, Sick Leave Used, Annual Leave Remaining, Sick Leave Remaining

**3. Salary** (`salary` table)
Fields: Employee, Salary amount, Currency

---

### Core Requirements

#### Authentication
- Email + password login form at `/login`
- No self-registration — accounts are created by an admin
- After login, redirect to `/dashboard`
- All routes except `/login` are protected — unauthenticated users are redirected to `/login`
- Support two roles: `employee` and `admin` (optionally `manager`)
- Role is stored in the `profiles` table in Supabase

#### Pages to Build

**`/login`**
- Centered card with company logo placeholder, "HR Portal" heading
- Email field, password field, Sign In button
- Inline error on wrong credentials
- "Forgot password?" link that triggers Supabase password reset email

**`/dashboard`**
- Four stat cards: Total Employees, Present Today, On Leave Today, Pending Requests
- A bar chart showing this week's daily attendance count (using Recharts)
- A table of the 5 most recent leave requests (all employees, for admin; own requests for employee)
- Quick-action buttons: "Log Today's Attendance" and "Submit Leave Request" (open modal or navigate)

**`/attendance`**
- Employee view:
  - A form to submit or update today's attendance record
  - Fields: Date (default today, read-only), Check In (time), Check Out (time), Work Location (Office / Remote / Field), Job Description (textarea)
  - Worked Hours is auto-calculated and displayed read-only
  - History table below showing their past attendance records
- Admin / Manager view:
  - Full table of all employees' attendance
  - Inline editable "Management Note" column
  - Filter by date range and employee name

**`/leave`**
- Employee view:
  - Leave balance summary: "Annual Leave: X of 14 remaining" and "Sick Leave: X of 14 remaining" shown as progress bars
  - Leave request form: Leave Type (Annual / Sick / Unpaid), Start Date, Duration (days), Reason
  - Validate that requested duration does not exceed remaining balance
  - Table of own leave history with Status badge (Pending = yellow, Approved = green, Rejected = red)
- Admin / Manager view:
  - Full table of all leave requests
  - Each row has Approve and Reject action buttons (only visible on Pending rows)
  - Approving a request updates status and increments the used balance

**`/salary`**
- Employee view: A card showing their own salary and currency
- Admin view: A full table with all employees' salaries, with an edit button per row

**`/admin`** (admin role only)
- Employee management table: name, email, role, department, position
- Ability to change an employee's role
- Deactivate / reactivate an employee account

---

### Technical Constraints

- Use the exact stack from `SKILL.md`: React + Vite + TypeScript, Tailwind CSS, shadcn/ui, Supabase, TanStack Query, React Hook Form + Zod, React Router v6, Recharts
- All database interactions go through the Supabase JS client — no custom REST endpoints
- Read Supabase URL and anon key from `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- Follow all RLS policies defined in `SKILL.md` exactly
- Never use `alert()` — use shadcn `Toaster` for all success/error feedback
- All forms must show field-level validation errors using Zod schemas
- The app must be fully mobile responsive (sidebar collapses on small screens)

---

### Deliverables

Produce the following, in this exact order:

1. **`supabase/migrations/001_initial_schema.sql`** — Full SQL migration: all tables, RLS policies, triggers (auto-create profile on auth signup, auto-deduct leave balance on approval)

2. **`.env.local.example`** — Template env file with placeholder values

3. **`src/lib/supabase.ts`** — Supabase client singleton

4. **`src/types/index.ts`** — All TypeScript types matching the database schema

5. **`src/context/AuthContext.tsx`** — Auth context with `user`, `profile`, `role`, `signIn`, `signOut`

6. **`src/components/layout/`** — `Sidebar.tsx`, `Topbar.tsx`, `ProtectedRoute.tsx`

7. **`src/pages/LoginPage.tsx`**

8. **`src/pages/DashboardPage.tsx`**

9. **`src/hooks/useAttendance.ts`** + **`src/pages/AttendancePage.tsx`** + attendance components

10. **`src/hooks/useLeave.ts`** + **`src/pages/LeavePage.tsx`** + leave components

11. **`src/hooks/useSalary.ts`** + **`src/pages/SalaryPage.tsx`**

12. **`src/pages/AdminPage.tsx`**

13. **`src/App.tsx`** — Router setup with all routes

14. **`README.md`** — Setup instructions: clone, `npm install`, create Supabase project, run migration, set env vars, `npm run dev`

---

### Quality Rules

- Every component must handle three states: **loading** (skeleton or spinner), **error** (error message with retry), **success** (actual UI)
- Use TanStack Query's `useQuery` and `useMutation` for all server data — no raw `useEffect` + `useState` for fetching
- Zod schemas must be defined for every form and reused as TypeScript types via `z.infer<>`
- No `any` types anywhere
- Worked hours calculation: `(checkOutMinutes - checkInMinutes) / 60`, rounded to 2 decimal places
- Leave balance deduction must use a Supabase database function (not frontend logic) to prevent race conditions
- The sidebar must show the logged-in user's name and role
- Status badges must use the `<StatusBadge>` component (defined in `SKILL.md` section 8)

---

### Design Tone

Clean, professional, minimal. Think a simplified Notion / Linear internal tool aesthetic. Not flashy. Indigo as the primary accent color. Neutral gray sidebar. White content area. The people using this are HR managers and employees — prioritize clarity over decoration.

---

*Reference: SKILL.md — HR Portal (Full-Stack Agent Guide)*
