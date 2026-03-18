import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../context/AuthContext';
import type { DailyAttendance, PayRate, PayrollReward } from '../types';
import { withTimeout } from '../lib/query';

function monthRange(value: string) {
  const [yearRaw, monthRaw] = value.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: toIso(start), end: toIso(end), startDate: start };
}

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export type PayrollRow = {
  employee_id: string;
  employee_name: string;
  hours: number;
  rate_per_hour: number;
  currency: string;
  rewards_total: number;
  estimated_total: number;
};

function sumHours(rows: DailyAttendance[]) {
  return rows.reduce((acc, r) => acc + Number(r.net_hours_worked ?? r.worked_hours ?? 0), 0);
}

function latestRateForMonth(rates: PayRate[], monthEndIso: string) {
  // pick most recent effective_date <= month end
  const candidates = rates
    .filter((r) => r.effective_date <= monthEndIso)
    .sort((a, b) => (a.effective_date < b.effective_date ? 1 : -1));
  return candidates[0] ?? null;
}

export function usePayrollMonth(month = currentMonthValue()) {
  const { role, user } = useAuthContext();

  return useQuery({
    queryKey: ['payroll-month', month, role, user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<{ month: string; rows: PayrollRow[] }> => {
      if (!user?.id) return { month, rows: [] };
      const { start, end } = monthRange(month);

      const isAdmin = role === 'admin';

      let attendanceQuery = supabase
        .from('daily_attendance')
        .select('*')
        .gte('date', start)
        .lte('date', end);

      let rewardsQuery = supabase
        .from('payroll_rewards')
        .select('*')
        .gte('reward_date', start)
        .lte('reward_date', end);

      let ratesQuery = supabase.from('pay_rates').select('*').order('effective_date', { ascending: false });

      if (!isAdmin) {
        attendanceQuery = attendanceQuery.eq('employee_id', user.id);
        rewardsQuery = rewardsQuery.eq('employee_id', user.id);
        ratesQuery = ratesQuery.eq('employee_id', user.id);
      }

      const [{ data: attendance, error: attendanceError }, { data: rewards, error: rewardsError }, { data: rates, error: ratesError }] =
        await withTimeout<any>(
          Promise.all([attendanceQuery, rewardsQuery, ratesQuery]),
          15000,
          'Payroll month data',
        );

      if (attendanceError) throw attendanceError;
      if (rewardsError) throw rewardsError;
      if (ratesError) throw ratesError;

      const attendanceRows = (attendance ?? []) as DailyAttendance[];
      const rewardRows = (rewards ?? []) as PayrollReward[];
      const rateRows = (rates ?? []) as PayRate[];

      const byEmployee = new Map<string, { name: string; attendance: DailyAttendance[]; rewards: PayrollReward[]; rates: PayRate[] }>();

      const ensure = (id: string, name: string) => {
        if (!byEmployee.has(id)) {
          byEmployee.set(id, { name, attendance: [], rewards: [], rates: [] });
        }
        const entry = byEmployee.get(id)!;
        if (!entry.name && name) entry.name = name;
        return entry;
      };

      for (const a of attendanceRows) {
        ensure(a.employee_id, a.employee_name).attendance.push(a);
      }
      for (const r of rewardRows) {
        ensure(r.employee_id, '').rewards.push(r);
      }
      for (const pr of rateRows) {
        ensure(pr.employee_id, '').rates.push(pr);
      }

      const result: PayrollRow[] = [];
      for (const [employeeId, entry] of byEmployee.entries()) {
        const hours = Math.round(sumHours(entry.attendance) * 100) / 100;
        const rate = latestRateForMonth(entry.rates, end);
        const currency = rate?.currency ?? 'JOD';
        const ratePerHour = Number(rate?.rate_per_hour ?? 0);
        const rewardsTotal = entry.rewards.reduce((acc, x) => acc + Number(x.amount ?? 0), 0);
        const estimatedTotal = Math.round((hours * ratePerHour + rewardsTotal) * 100) / 100;
        result.push({
          employee_id: employeeId,
          employee_name: entry.name || employeeId,
          hours,
          rate_per_hour: ratePerHour,
          currency,
          rewards_total: Math.round(rewardsTotal * 100) / 100,
          estimated_total: estimatedTotal,
        });
      }

      result.sort((a, b) => a.employee_name.localeCompare(b.employee_name));
      return { month, rows: result };
    },
  });
}

export function useUpsertPayRate() {
  const queryClient = useQueryClient();
  const { role } = useAuthContext();

  return useMutation({
    mutationFn: async ({
      employee_id,
      rate_per_hour,
      currency,
      effective_date,
    }: {
      employee_id: string;
      rate_per_hour: number;
      currency: string;
      effective_date: string;
    }) => {
      if (role !== 'admin') throw new Error('Only admins can set pay rates.');
      const { error } = await supabase
        .from('pay_rates')
        .upsert(
          { employee_id, rate_per_hour, currency, effective_date },
          { onConflict: 'employee_id,effective_date' },
        );
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payroll-month'] });
    },
  });
}

export function useAddPayrollReward() {
  const queryClient = useQueryClient();
  const { role, user } = useAuthContext();

  return useMutation({
    mutationFn: async ({
      employee_id,
      amount,
      currency,
      reward_date,
      note,
    }: {
      employee_id: string;
      amount: number;
      currency: string;
      reward_date: string;
      note: string;
    }) => {
      if (role !== 'admin') throw new Error('Only admins can add rewards.');
      const { error } = await supabase.from('payroll_rewards').insert({
        employee_id,
        amount,
        currency,
        reward_date,
        note: note || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payroll-month'] });
    },
  });
}

