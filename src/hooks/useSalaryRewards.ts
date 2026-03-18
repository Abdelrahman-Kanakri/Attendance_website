import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../context/AuthContext';
import type { SalaryReward } from '../types';
import { withTimeout } from '../lib/query';

function monthRange(value: string) {
  const [yearRaw, monthRaw] = value.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: toIso(start), end: toIso(end) };
}

export function useSalaryRewardsMonth(month: string) {
  const { role, user } = useAuthContext();

  return useQuery({
    queryKey: ['salary-rewards', month, role, user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<SalaryReward[]> => {
      if (!user?.id) return [];
      const { start, end } = monthRange(month);

      let q = supabase
        .from('salary_rewards')
        .select('*')
        .gte('reward_date', start)
        .lte('reward_date', end)
        .order('reward_date', { ascending: false });

      if (role !== 'admin') {
        q = q.eq('employee_id', user.id);
      }

      const { data, error } = await withTimeout<any>(q, 10000, 'Salary rewards');
      if (error) throw error;
      return (data ?? []) as SalaryReward[];
    },
  });
}

export function useAddSalaryReward() {
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
      if (role !== 'admin') throw new Error('Only admins can add fixed salary rewards.');
      const { error } = await supabase.from('salary_rewards').insert({
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
      await queryClient.invalidateQueries({ queryKey: ['salary-rewards'] });
    },
  });
}

