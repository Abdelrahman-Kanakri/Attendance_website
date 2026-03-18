import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../context/AuthContext';
import type { LeaveSettings } from '../types';
import { withTimeout } from '../lib/query';

export function useLeaveSettingsAdmin() {
  const { role, user } = useAuthContext();

  return useQuery({
    queryKey: ['leave-settings-admin', role, user?.id],
    enabled: Boolean(user?.id) && role === 'admin',
    queryFn: async (): Promise<LeaveSettings[]> => {
      const { data, error } = await withTimeout<any>(
        supabase.from('leave_settings').select('*').order('updated_at', { ascending: false }),
        10000,
        'Leave settings',
      );
      if (error) throw error;
      return (data ?? []) as LeaveSettings[];
    },
  });
}

export function useUpsertLeaveSettings() {
  const { role } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      employee_id,
      annual_allowance,
      sick_allowance,
    }: {
      employee_id: string;
      annual_allowance: number;
      sick_allowance: number;
    }) => {
      if (role !== 'admin') throw new Error('Only admins can update leave allowances.');
      const { error } = await supabase
        .from('leave_settings')
        .upsert({ employee_id, annual_allowance, sick_allowance }, { onConflict: 'employee_id' });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['leave-settings-admin'] });
      await queryClient.invalidateQueries({ queryKey: ['leave-balance'] });
    },
  });
}

