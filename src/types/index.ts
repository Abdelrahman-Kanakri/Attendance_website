export type Role = 'employee' | 'admin' | 'manager';
export type LeaveType = 'Annual Leave' | 'Sick Leave' | 'Unpaid';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';
export type WorkLocation = 'Office' | 'Remote' | 'Field';
export type PayMode = 'fixed' | 'hourly';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  pay_mode?: PayMode;
  department: string | null;
  position: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Salary {
  id: string;
  employee_id: string;
  employee_name: string;
  salary: number;
  currency: string;
  effective_date: string;
  created_at: string;
}

export interface PayRate {
  id: string;
  employee_id: string;
  rate_per_hour: number;
  currency: string;
  effective_date: string;
  created_at: string;
}

export interface PayrollReward {
  id: string;
  employee_id: string;
  amount: number;
  currency: string;
  reward_date: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SalaryReward {
  id: string;
  employee_id: string;
  amount: number;
  currency: string;
  reward_date: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface LeaveSettings {
  employee_id: string;
  annual_allowance: number;
  sick_allowance: number;
  annual_used: number;
  sick_used: number;
  created_at: string;
  updated_at: string;
}

export interface LeaveLog {
  id: string;
  request_id: number;
  employee_id: string;
  employee_name: string;
  date: string;
  leave_type: LeaveType;
  reason: string | null;
  status: LeaveStatus;
  duration_days: number;
  annual_leave_balance: number;
  sick_leave_balance: number;
  annual_leave_used: number;
  sick_leave_used: number;
  annual_leave_remaining: number;
  sick_leave_remaining: number;
  created_at: string;
}

export interface DailyAttendance {
  id: string;
  record_id: number;
  employee_id: string;
  employee_name: string;
  date: string;
  web_login_time?: string | null;
  check_in: string | null;
  check_out: string | null;
  worked_hours: number | null;
  net_hours_worked: number | null;
  total_late_time: number;
  job_description: string | null;
  work_location: WorkLocation;
  management_note: string | null;
  leave_log_id: string | null;
  created_by: string | null;
  created_at: string;
}
