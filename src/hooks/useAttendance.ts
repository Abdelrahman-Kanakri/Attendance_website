import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../context/AuthContext';
import type { DailyAttendance, WorkLocation } from '../types';

export interface AttendanceFormInput {
  date: string;
  check_in: string;
  check_out?: string;
  work_location: WorkLocation;
  job_description?: string;
}

function todayIsoLocal() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function toMinutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function calculateWorkedHours(checkIn: string, checkOut: string): number {
  const checkInMinutes = toMinutes(checkIn);
  const checkOutMinutes = toMinutes(checkOut);
  return Math.round(((checkOutMinutes - checkInMinutes) / 60) * 100) / 100;
}

export function useAttendanceHistory(filters?: { startDate?: string; endDate?: string; employee?: string }) {
  const { role, user } = useAuthContext();

  return useQuery({
    queryKey: ['attendance-history', role, user?.id, filters?.startDate, filters?.endDate, filters?.employee],
    queryFn: async (): Promise<DailyAttendance[]> => {
      let query = supabase.from('daily_attendance').select('*').order('date', { ascending: false });

      const canViewAll = role === 'admin' || role === 'manager';

      if (!canViewAll && user?.id) {
        query = query.eq('employee_id', user.id);

        // Employees should only see today's submitted attendance rows.
        query = query.eq('date', todayIsoLocal()).not('check_in', 'is', null);
      }

      if (canViewAll && filters?.startDate) {
        query = query.gte('date', filters.startDate);
      }

      if (canViewAll && filters?.endDate) {
        query = query.lte('date', filters.endDate);
      }

      if (canViewAll && filters?.employee) {
        query = query.ilike('employee_name', `%${filters.employee}%`);
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      return (data ?? []) as DailyAttendance[];
    },
  });
}

export function useMyAttendanceHistory() {
  const { user, role } = useAuthContext();

  return useQuery({
    queryKey: ['attendance-history-employee-all', user?.id],
    enabled: role === 'employee' && !!user?.id,
    queryFn: async (): Promise<DailyAttendance[]> => {
      if (!user?.id) {
        return [];
      }

      const { data, error } = await supabase
        .from('daily_attendance')
        .select('*')
        .eq('employee_id', user.id)
        .not('check_in', 'is', null)
        .order('date', { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []) as DailyAttendance[];
    },
  });
}

export function useUpsertAttendance() {
  const { user, profile } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AttendanceFormInput) => {
      if (!user || !profile) {
        throw new Error('Not authenticated');
      }

      const normalizedCheckOut =
        input.check_out && input.check_out.trim() !== '' ? input.check_out.trim() : null;

      const { data: existing, error: readError } = await supabase
        .from('daily_attendance')
        .select('*')
        .eq('employee_id', user.id)
        .eq('date', input.date)
        .maybeSingle();

      if (readError) {
        throw readError;
      }

      const worked_hours =
        normalizedCheckOut && normalizedCheckOut > input.check_in
          ? calculateWorkedHours(input.check_in, normalizedCheckOut)
          : existing?.worked_hours ?? null;

      if (existing) {
        const { error: updateError } = await supabase
          .from('daily_attendance')
          .update({
            check_in: input.check_in,
            check_out: normalizedCheckOut ?? existing.check_out ?? null,
            worked_hours,
            net_hours_worked: worked_hours,
            work_location: input.work_location,
            job_description: input.job_description ?? existing.job_description,
            created_by: user.id,
          })
          .eq('id', existing.id);

        if (updateError) {
          throw updateError;
        }

        return;
      }

      const { error: insertError } = await supabase.from('daily_attendance').insert({
        employee_id: user.id,
        employee_name: profile.full_name,
        date: input.date,
        check_in: input.check_in,
        check_out: normalizedCheckOut,
        worked_hours,
        net_hours_worked: worked_hours,
        work_location: input.work_location,
        job_description: input.job_description ?? null,
        created_by: user.id,
      });

      if (insertError) {
        throw insertError;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['attendance-history'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-weekly-attendance'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

export function useUpdateManagementNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, management_note }: { id: string; management_note: string }) => {
      const { error } = await supabase
        .from('daily_attendance')
        .update({ management_note })
        .eq('id', id);

      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['attendance-history'] });
    },
  });
}

export function useUpdateMyAttendanceEntry() {
  const { user } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      date,
      check_out,
      job_description,
      check_in,
    }: {
      id: string;
      date: string;
      check_out: string | null;
      job_description: string | null;
      check_in: string | null;
    }) => {
      if (!user?.id) {
        throw new Error('Not authenticated');
      }

      const normalizedCheckOut = check_out && check_out.trim() !== '' ? check_out.trim() : null;

      const worked_hours =
        check_in && normalizedCheckOut && normalizedCheckOut > check_in
          ? calculateWorkedHours(check_in, normalizedCheckOut)
          : null;

      const { error } = await supabase
        .from('daily_attendance')
        .update({
          date,
          check_out: normalizedCheckOut,
          worked_hours,
          net_hours_worked: worked_hours,
          job_description,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['attendance-history'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-weekly-attendance'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}
