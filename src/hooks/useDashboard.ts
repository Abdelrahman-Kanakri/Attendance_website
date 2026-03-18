import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../context/AuthContext';
import type { LeaveLog } from '../types';
import { withTimeout } from '../lib/query';

interface DashboardStats {
  totalEmployees: number;
  presentToday: number;
  onLeaveToday: number;
  pendingRequests: number;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function useDashboardStats() {
  const { role, user } = useAuthContext();

  return useQuery({
    queryKey: ['dashboard-stats', role, user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<DashboardStats> => {
      if (!user?.id) {
        return {
          totalEmployees: 0,
          presentToday: 0,
          onLeaveToday: 0,
          pendingRequests: 0,
        };
      }

      const today = formatDate(new Date());
      // `profiles` RLS currently grants org-wide access only to `admin`.
      // Treat `manager` as self-only to avoid dashboard errors.
      const canViewAll = role === 'admin';

      if (!canViewAll) {
        const [presentResult, leaveResult, pendingResult] = await Promise.all([
          withTimeout<any>(
            supabase
            .from('daily_attendance')
            .select('id', { count: 'exact', head: true })
            .eq('employee_id', user.id)
            .eq('date', today),
            10000,
            'Dashboard present count',
          ),
          withTimeout<any>(
            supabase
            .from('leave_log')
            .select('id', { count: 'exact', head: true })
            .eq('employee_id', user.id)
            .eq('date', today)
            .eq('status', 'Approved'),
            10000,
            'Dashboard leave count',
          ),
          withTimeout<any>(
            supabase
            .from('leave_log')
            .select('id', { count: 'exact', head: true })
            .eq('employee_id', user.id)
            .eq('status', 'Pending'),
            10000,
            'Dashboard pending count',
          ),
        ]);

        if (presentResult.error) throw presentResult.error;
        if (leaveResult.error) throw leaveResult.error;
        if (pendingResult.error) throw pendingResult.error;

        return {
          totalEmployees: 0,
          presentToday: presentResult.count ?? 0,
          onLeaveToday: leaveResult.count ?? 0,
          pendingRequests: pendingResult.count ?? 0,
        };
      }

      const employeesQuery = supabase.from('profiles').select('id', { count: 'exact', head: true });
      const presentQuery = supabase
        .from('daily_attendance')
        .select('id', { count: 'exact', head: true })
        .eq('date', today);
      const leaveQuery = supabase
        .from('leave_log')
        .select('id', { count: 'exact', head: true })
        .eq('date', today)
        .eq('status', 'Approved');
      const pendingQuery = supabase
        .from('leave_log')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'Pending');

      const [employeesResult, presentResult, leaveResult, pendingResult] = await withTimeout<any>(
        Promise.all([
        employeesQuery,
        presentQuery,
        leaveQuery,
        pendingQuery,
        ]),
        10000,
        'Dashboard stats',
      );

      if (employeesResult.error) throw employeesResult.error;
      if (presentResult.error) throw presentResult.error;
      if (leaveResult.error) throw leaveResult.error;
      if (pendingResult.error) throw pendingResult.error;

      return {
        totalEmployees: employeesResult.count ?? 0,
        presentToday: presentResult.count ?? 0,
        onLeaveToday: leaveResult.count ?? 0,
        pendingRequests: pendingResult.count ?? 0,
      };
    },
  });
}

export function useWeeklyAttendance() {
  const { role, user } = useAuthContext();

  return useQuery({
    queryKey: ['dashboard-weekly-attendance', role, user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user?.id) {
        return [] as Array<{ date: string; count: number }>;
      }

      const canViewAll = role === 'admin' || role === 'manager';
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 6);

      let query = supabase
        .from('daily_attendance')
        .select('date')
        .gte('date', formatDate(start))
        .lte('date', formatDate(end));

      if (!canViewAll) {
        query = query.eq('employee_id', user.id);
      }

      const { data, error } = await withTimeout<any>(query, 10000, 'Weekly attendance');

      if (error) {
        throw error;
      }

      const grouped = new Map<string, number>();
      for (let i = 0; i < 7; i += 1) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        grouped.set(formatDate(d), 0);
      }

      for (const row of data ?? []) {
        const key = row.date as string;
        grouped.set(key, (grouped.get(key) ?? 0) + 1);
      }

      return Array.from(grouped.entries()).map(([date, count]) => ({
        date: date.slice(5),
        count,
      }));
    },
  });
}

export function useRecentLeaves() {
  const { role, user } = useAuthContext();

  return useQuery({
    queryKey: ['dashboard-recent-leaves', role, user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<LeaveLog[]> => {
      if (!user?.id) {
        return [];
      }

      let query = supabase.from('leave_log').select('*').order('created_at', { ascending: false }).limit(5);

      if (role !== 'admin' && role !== 'manager') {
        query = query.eq('employee_id', user.id);
      }

      const { data, error } = await withTimeout<any>(query, 10000, 'Recent leaves');
      if (error) {
        throw error;
      }

      return (data ?? []) as LeaveLog[];
    },
  });
}
