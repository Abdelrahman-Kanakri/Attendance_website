# HR Portal User Guide

## 1. What This Portal Does

The HR Portal helps employees and HR/admin teams manage:

- Daily attendance
- Leave requests and approvals
- Salary visibility
- Employee administration (admin only)

## 2. Access and Login

1. Open the website in your browser.
2. Go to `/login`.
3. Enter your company email and password.
4. Click `Sign In`.
5. If you forgot your password:
- Enter your email in the email field.
- Click `Forgot password?`.
- Follow the reset email link from Supabase.

Important:
- There is no self-registration page.
- Accounts are created by admins.

## 3. Roles and Permissions

The portal supports these roles:

- `employee`
- `manager`
- `admin`

### Employee can:

- Log and update own attendance for the day
- View own attendance history
- Submit leave requests
- View own leave history and balances
- View own salary record

### Manager can:

- View all attendance
- Add/edit management notes in attendance table
- View all leave requests
- Approve or reject pending leave requests

### Admin can:

- All manager capabilities
- Access Admin page
- Manage employee role
- Deactivate/reactivate employee profile
- View/edit all salary records

## 4. Navigation

Use the left sidebar:

- `Dashboard`
- `Attendance`
- `Leave`
- `Salary`
- `Admin` (admin only)

Top-right button:

- `Sign out`

## 5. Dashboard

The dashboard shows:

- Total Employees
- Present Today
- On Leave Today
- Pending Requests
- Weekly attendance bar chart
- Recent leave requests
- Quick actions for attendance and leave

If data fails to load:

- Use the `Retry` button on the error card.

## 6. Attendance Module

### Employee flow

1. Open `Attendance`.
2. Fill:
- Check In
- Check Out
- Work Location
- Job Description
3. Date is auto-filled as today.
4. Worked Hours is auto-calculated.
5. Click `Save Attendance`.
6. Your attendance history appears below.

Worked hours formula:

$\text{Worked Hours} = \frac{\text{CheckOutMinutes} - \text{CheckInMinutes}}{60}$ (rounded to 2 decimals)

### Admin/Manager flow

1. Open `Attendance`.
2. Filter by start date, end date, and employee name.
3. Review the all-employee table.
4. Add or update `Management Note` inline and click `Save`.

## 7. Leave Module

### Employee flow

1. Open `Leave`.
2. Review balances:
- Annual Leave remaining
- Sick Leave remaining
3. Submit request:
- Leave Type
- Start Date
- Duration (days)
- Reason
4. Click `Submit Request`.
5. Track status in history table.

Status colors:

- Pending: yellow
- Approved: green
- Rejected: red

Validation:

- Duration cannot exceed remaining balance for Annual/Sick leave.

### Admin/Manager flow

1. Open `Leave`.
2. Review all requests.
3. For `Pending` rows, click:
- `Approve`, or
- `Reject`

Approval notes:

- Balance deductions are done in the database (server-side trigger), not client-side.

## 8. Salary Module

### Employee view

- See your current salary card and currency.

### Admin view

1. Open `Salary`.
2. Edit salary and/or currency in the row.
3. Click `Save`.

## 9. Admin Module

Admin page includes employee management table:

- Name
- Email
- Role
- Department
- Position
- Account status

Actions:

- Change role: employee / manager / admin
- Deactivate or reactivate account

## 10. Common Issues and Fixes

### I am redirected to login

- Your session expired or you are not authenticated.
- Sign in again.

### I cannot see Admin page

- Your role is not `admin`.
- Ask an admin to verify your role in profiles.

### Leave approval fails

- The request may exceed available balance.
- Review annual/sick remaining values.

### Data not loading

- Use each page's `Retry` button.
- Check internet and Supabase status.

## 11. Best Practices for Daily Use

- Log attendance at start/end of day consistently.
- Add clear leave reasons for faster approval.
- Managers should keep management notes concise and factual.
- Admins should review role assignments regularly.

## 12. Support Checklist for Admins

When onboarding a new user:

1. Create auth account in Supabase.
2. Confirm profile auto-created by trigger.
3. Set `role`, `department`, and `position`.
4. Add salary record.
5. Ask user to sign in and reset password if needed.
