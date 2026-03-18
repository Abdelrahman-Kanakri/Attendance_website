import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { Profile, Role } from '../types';
import { Card } from '../components/ui/card';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { Table, TBody, THead } from '../components/ui/table';
import { Input } from '../components/ui/input';
import { getErrorMessage } from '../lib/errors';
import { useLeaveSettingsAdmin, useUpsertLeaveSettings } from '../hooks/useLeaveSettings';

const addEmployeeSchema = z.object({
  full_name: z.string().min(2, 'Name is required'),
  email: z.email('Enter a valid email'),
  role: z.enum(['employee', 'manager', 'admin']),
  department: z.string().optional(),
  position: z.string().optional(),
  password: z.string().optional(),
});

type AddEmployeeFormValues = z.infer<typeof addEmployeeSchema>;

async function callEdgeFunction<T>(name: string, token: string, body: unknown): Promise<T> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const apikey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !apikey) {
    throw new Error('Supabase is not configured (missing VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY).');
  }

  const res = await fetch(`${url}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      apikey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  let parsed: any = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const err: any = new Error('Edge Function returned a non-2xx status code');
    err.context = { status: res.status, body: parsed ?? {} };
    throw err;
  }

  return parsed as T;
}

function useProfiles() {
  return useQuery({
    queryKey: ['admin-profiles'],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });
      if (error) {
        throw error;
      }
      return (data ?? []) as Profile[];
    },
  });
}

function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: Role }) => {
      const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-profiles'] });
    },
  });
}

function useSetActive() {
    const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('profiles').update({ is_active }).eq('id', id);
      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-profiles'] });
    },
  });
}

function useCreateEmployeeProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AddEmployeeFormValues) => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.access_token) {
        throw new Error('Not authenticated (missing session token).');
      }

      return await callEdgeFunction<{ id: string; email: string; full_name: string; role: Role; temp_password?: string }>(
        'create-employee',
        session.access_token,
        {
          email: payload.email,
          full_name: payload.full_name,
          role: payload.role,
          department: payload.department || null,
          position: payload.position || null,
          password: payload.password || null,
        },
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-profiles'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

export default function AdminPage() {
  const profilesQuery = useProfiles();
  const updateRole = useUpdateRole();
  const setActive = useSetActive();
  const createEmployeeProfile = useCreateEmployeeProfile();
  const leaveSettingsQuery = useLeaveSettingsAdmin();
  const upsertLeaveSettings = useUpsertLeaveSettings();
  const [leaveDraft, setLeaveDraft] = useState<Record<string, { annual: string; sick: string }>>({});

  const leaveByEmployee = useMemo(() => {
    const map = new Map<
      string,
      { annual_allowance: number; sick_allowance: number; annual_used: number; sick_used: number }
    >();
    if (leaveSettingsQuery.data) {
      for (const s of leaveSettingsQuery.data) {
        map.set(s.employee_id, {
          annual_allowance: s.annual_allowance,
          sick_allowance: s.sick_allowance,
          annual_used: s.annual_used,
          sick_used: s.sick_used,
        });
      }
    }
    return map;
  }, [leaveSettingsQuery.data]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddEmployeeFormValues>({
    resolver: zodResolver(addEmployeeSchema),
    defaultValues: {
      full_name: '',
      email: '',
      role: 'employee',
      department: '',
      position: '',
      password: '',
    },
  });

  const onRoleChange = async (id: string, role: Role) => {
    try {
      await updateRole.mutateAsync({ id, role });
      toast.success('Role updated.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to update role.'));
    }
  };

  const onToggleActive = async (id: string, current: boolean) => {
    try {
      await setActive.mutateAsync({ id, is_active: !current });
      toast.success(!current ? 'Account reactivated.' : 'Account deactivated.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to update account status.'));
    }
  };

  const onCreateEmployee = handleSubmit(async (values) => {
    try {
      const result = await createEmployeeProfile.mutateAsync(values);
      const passwordNote = result?.temp_password
        ? ` Temp password: ${result.temp_password}`
        : '';
      toast.success(`Employee created.${passwordNote}`);
      reset();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to add employee profile.'));
    }
  });

  if (profilesQuery.isLoading) {
    return <div className="p-6 text-sm text-gray-600">Loading employee management...</div>;
  }

  if (profilesQuery.isError) {
    return (
      <div className="p-6">
        <Card className="border border-red-100 bg-red-50">
          <p className="text-sm text-red-700">Could not load employee profiles.</p>
          <p className="mt-1 text-xs text-red-700">
            {getErrorMessage(profilesQuery.error, 'Could not load employee profiles.')}
          </p>
          <Button className="mt-3" variant="outline" onClick={() => void profilesQuery.refetch()}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Card>
        <h2 className="mb-4 text-base font-semibold text-gray-900">Add Employee Profile</h2>
        <p className="mb-4 text-sm text-gray-500">
          This creates the Auth user + profile for you via a Supabase Edge Function (admin-only).
        </p>

        <form className="grid gap-4 md:grid-cols-3" onSubmit={onCreateEmployee}>
          <div>
            <label className="text-sm font-medium text-gray-700">Full Name</label>
            <Input placeholder="Employee full name" {...register('full_name')} />
            {errors.full_name && <p className="text-xs text-red-600">{errors.full_name.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Email</label>
            <Input type="email" placeholder="name@company.com" {...register('email')} />
            {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Role</label>
            <Select {...register('role')}>
              <option value="employee">employee</option>
              <option value="manager">manager</option>
              <option value="admin">admin</option>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Department</label>
            <Input placeholder="Department" {...register('department')} />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Position</label>
            <Input placeholder="Position" {...register('position')} />
          </div>

          <div className="md:col-span-3">
            <label className="text-sm font-medium text-gray-700">Password (optional)</label>
            <Input type="password" placeholder="Leave empty to generate a temporary password" {...register('password')} />
          </div>

          <div className="md:col-span-3">
            <Button type="submit" disabled={isSubmitting || createEmployeeProfile.isPending}>
              {isSubmitting || createEmployeeProfile.isPending ? 'Adding...' : 'Add Employee'}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="mb-4 text-base font-semibold text-gray-900">Leave Allowances (HR)</h2>
        <p className="mb-4 text-sm text-gray-500">
          Control annual/sick leave allowances per employee. Used/remaining are tracked automatically when requests are
          approved or unapproved.
        </p>

        {leaveSettingsQuery.isLoading && <p className="text-sm text-gray-600">Loading leave allowances...</p>}

        {leaveSettingsQuery.isError && (
          <div className="rounded-lg border border-red-100 bg-red-50 p-4">
            <p className="text-sm text-red-700">Could not load leave allowances.</p>
            <p className="mt-1 text-xs text-red-700">
              {getErrorMessage(leaveSettingsQuery.error, 'Could not load leave allowances.')}
            </p>
            <Button className="mt-3" variant="outline" onClick={() => void leaveSettingsQuery.refetch()}>
              Retry
            </Button>
          </div>
        )}

        {leaveSettingsQuery.isSuccess && (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <tr>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2 hidden sm:table-cell">Annual allowance</th>
                  <th className="px-3 py-2 hidden sm:table-cell">Sick allowance</th>
                  <th className="px-3 py-2 hidden md:table-cell">Annual used</th>
                  <th className="px-3 py-2 hidden md:table-cell">Sick used</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </THead>
              <TBody>
                {profilesQuery.data?.map((p) => {
                  const settings = leaveByEmployee.get(p.id) ?? {
                    annual_allowance: 14,
                    sick_allowance: 14,
                    annual_used: 0,
                    sick_used: 0,
                  };

                  const draft = leaveDraft[p.id] ?? {
                    annual: String(settings.annual_allowance),
                    sick: String(settings.sick_allowance),
                  };

                  return (
                    <tr key={p.id} className="even:bg-gray-50">
                      <td className="px-3 py-2">{p.full_name}</td>
                      <td className="px-3 py-2 hidden sm:table-cell">
                        <Input
                          type="number"
                          min={0}
                          value={draft.annual}
                          onChange={(e) =>
                            setLeaveDraft((prev) => ({
                              ...prev,
                              [p.id]: { ...draft, annual: e.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className="px-3 py-2 hidden sm:table-cell">
                        <Input
                          type="number"
                          min={0}
                          value={draft.sick}
                          onChange={(e) =>
                            setLeaveDraft((prev) => ({
                              ...prev,
                              [p.id]: { ...draft, sick: e.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell">{settings.annual_used}</td>
                      <td className="px-3 py-2 hidden md:table-cell">{settings.sick_used}</td>
                      <td className="px-3 py-2">
                        <Button
                          size="sm"
                          disabled={upsertLeaveSettings.isPending}
                          onClick={async () => {
                            try {
                              await upsertLeaveSettings.mutateAsync({
                                employee_id: p.id,
                                annual_allowance: Number(draft.annual),
                                sick_allowance: Number(draft.sick),
                              });
                              toast.success('Leave allowances saved.');
                            } catch (error) {
                              toast.error(getErrorMessage(error, 'Unable to save leave allowances.'));
                            }
                          }}
                        >
                          Save
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </TBody>
            </Table>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 text-base font-semibold text-gray-900">Employee Management</h2>
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Department</th>
                <th className="px-3 py-2">Position</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </THead>
            <TBody>
              {profilesQuery.data?.map((profile) => (
                <tr key={profile.id} className="even:bg-gray-50">
                  <td className="px-3 py-2">{profile.full_name}</td>
                  <td className="px-3 py-2">{profile.email}</td>
                  <td className="px-3 py-2">
                    <Select
                      value={profile.role}
                      onChange={(event) => void onRoleChange(profile.id, event.target.value as Role)}
                    >
                      <option value="employee">employee</option>
                      <option value="manager">manager</option>
                      <option value="admin">admin</option>
                    </Select>
                  </td>
                  <td className="px-3 py-2">{profile.department ?? '-'}</td>
                  <td className="px-3 py-2">{profile.position ?? '-'}</td>
                  <td className="px-3 py-2">
                    {profile.is_active ? (
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">Active</span>
                    ) : (
                      <span className="rounded-full bg-gray-200 px-2 py-1 text-xs text-gray-700">Inactive</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={profile.is_active ? 'destructive' : 'outline'}
                        onClick={() => void onToggleActive(profile.id, profile.is_active)}
                      >
                        {profile.is_active ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </TBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
