# HR Portal

Production-ready HR Portal built with React, TypeScript, Tailwind, shadcn-style UI primitives, Supabase Auth + Postgres (RLS), TanStack Query, React Hook Form + Zod, and Recharts.

## Features

- Email/password authentication via Supabase
- Role-aware pages for employee, manager, and admin
- Attendance logging and history
- Leave request workflow with approval/rejection
- Salary view/edit by role
- Admin employee management panel

## Tech Stack

- React + Vite + TypeScript
- Tailwind CSS
- Supabase (`@supabase/supabase-js`)
- TanStack Query
- React Router v6
- React Hook Form + Zod
- Recharts

## Prerequisites

- Node.js 20+
- npm 10+
- A Supabase project

## Setup

1. Clone the project.
2. Install dependencies:

```bash
npm install
```

3. Copy environment template and set your Supabase values:

```bash
cp .env.local.example .env.local
```

4. In `.env.local`, configure:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

5. Open your Supabase SQL editor and run:

- `supabase/migrations/001_initial_schema.sql`

This migration creates:

- `profiles`, `daily_attendance`, `leave_log`, `salary`
- Row-level security policies
- New user profile trigger
- Leave approval balance trigger

6. Start the app:

```bash
npm run dev
```

7. Build for production:

```bash
npm run build
```

## Auth and Roles

- No self-registration UI is provided.
- Accounts are expected to be provisioned by admin processes in Supabase.
- Role is read from `profiles.role` and controls access:
  - employee
  - manager
  - admin

## Project Structure

- `supabase/migrations/001_initial_schema.sql` database schema and policies
- `src/context/AuthContext.tsx` auth/session state
- `src/hooks/` data hooks for attendance, leave, salary, dashboard
- `src/pages/` route pages
- `src/components/` layout and feature components

## Notes

- All server data fetching/mutations are implemented through TanStack Query + Supabase client.
- Form validation is implemented with Zod and displayed inline.
- Toast notifications are handled with Sonner via the shared toaster component.
