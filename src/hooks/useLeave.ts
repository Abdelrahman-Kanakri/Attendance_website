import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../context/AuthContext';
import type { LeaveLog, LeaveSettings, LeaveStatus, LeaveType } from '../types';
import { withTimeout } from '../lib/query';

export interface LeaveRequestInput {
  leave_type: LeaveType;
  date: string;
  duration_days: number;
  reason: string;
}

export interface LeaveBalance {
  annualRemaining: number;
  annualUsed: number;
  sickRemaining: number;
  sickUsed: number;
}

const DEFAULT_BALANCE: LeaveBalance = {
  annualRemaining: 14,
  annualUsed: 0,
  sickRemaining: 14,
  sickUsed: 0,
};

export function useLeaveRequests() {
  const { role, user } = useAuthContext();

  return useQuery({
    queryKey: ['leave-requests', role, user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<LeaveLog[]> => {
      if (!user?.id) {
        return [];
      }

      let query = supabase.from('leave_log').select('*').order('created_at', { ascending: false });

      if (role !== 'admin' && role !== 'manager') {
        query = query.eq('employee_id', user.id);
      }

      const { data, error } = await withTimeout<any>(query, 10000, 'Leave requests');
      if (error) {
        throw error;
      }

      return (data ?? []) as LeaveLog[];
    },
  });
}

export function useLeaveBalance() {
  const { user } = useAuthContext();

  return useQuery({
    queryKey: ['leave-balance', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<LeaveBalance> => {
      if (!user?.id) {
        return DEFAULT_BALANCE;
      }

      // Prefer HR-controlled leave settings. If PostgREST schema cache hasn't reloaded yet
      // (PGRST205: table not found), fall back to the legacy computed balances from leave_log.
      const { data, error } = await withTimeout<any>(
        supabase.from('leave_settings').select('*').eq('employee_id', user.id).maybeSingle(),
        10000,
        'Leave balance (settings)',
      );

      if (!error && data) {
        const settings = data as LeaveSettings;
        const annualRemaining = Math.max(
          0,
          Number(settings.annual_allowance) - Number(settings.annual_used),
        );
        const sickRemaining = Math.max(0, Number(settings.sick_allowance) - Number(settings.sick_used));

        return {
          annualRemaining,
          annualUsed: Number(settings.annual_used),
          sickRemaining,
          sickUsed: Number(settings.sick_used),
        };
      }

      const errorCode = (error as any)?.code;
      if (error && errorCode !== 'PGRST205') {
        throw error;
      }

      const { data: last, error: legacyError } = await withTimeout<any>(
        supabase
          .from('leave_log')
          .select('*')
          .eq('employee_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        10000,
        'Leave balance (legacy)',
      );

      if (legacyError) throw legacyError;
      if (!last) return DEFAULT_BALANCE;

      return {
        annualRemaining: last.annual_leave_remaining,
        annualUsed: last.annual_leave_used,
        sickRemaining: last.sick_leave_remaining,
        sickUsed: last.sick_leave_used,
      };
    },
  });
}

export function useSubmitLeaveRequest() {
  const { user, profile } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LeaveRequestInput) => {
      if (!user || !profile) {
        throw new Error('Not authenticated');
      }

      const { error } = await supabase.from('leave_log').insert({
        employee_id: user.id,
        employee_name: profile.full_name,
        leave_type: input.leave_type,
        date: input.date,
        duration_days: input.duration_days,
        reason: input.reason,
        status: 'Pending',
      });

      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-recent-leaves'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

export function useUpdateLeaveStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeaveStatus }) => {
      const { error } = await supabase.from('leave_log').update({ status }).eq('id', id);

      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      await queryClient.invalidateQueries({ queryKey: ['leave-balance'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-recent-leaves'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}
