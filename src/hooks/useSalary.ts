import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../context/AuthContext';
import type { Salary } from '../types';
import { withTimeout } from '../lib/query';

export function useSalaryRecords() {
  const { role, user } = useAuthContext();

  return useQuery({
    queryKey: ['salary-records', role, user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<Salary[]> => {
      if (!user?.id) {
        return [];
      }

      let query = supabase.from('salary').select('*').order('employee_name', { ascending: true });

      // `salary` RLS grants org-wide access only to `admin` in the current schema.
      // Non-admins should be limited to their own row.
      if (role !== 'admin') {
        query = query.eq('employee_id', user.id);
      }

      const { data, error } = await withTimeout<any>(query, 10000, 'Salary records');
      if (error) {
        throw error;
      }

      return (data ?? []) as Salary[];
    },
  });
}

export function useUpdateSalary() {
  const { role } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, salary, currency }: { id: string; salary: number; currency: string }) => {
      if (role !== 'admin') {
        throw new Error('Only admins can update salary records.');
      }
      const { error } = await supabase.from('salary').update({ salary, currency }).eq('id', id);

      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['salary-records'] });
    },
  });
}

export function useCreateSalary() {
  const { role } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      employee_id,
      employee_name,
      salary,
      currency,
    }: {
      employee_id: string;
      employee_name: string;
      salary: number;
      currency: string;
    }) => {
      if (role !== 'admin') {
        throw new Error('Only admins can create salary records.');
      }
      const { error } = await supabase.from('salary').insert({
        employee_id,
        employee_name,
        salary,
        currency,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['salary-records'] });
    },
  });
}
