import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuthContext } from '../context/AuthContext';
import { useProfiles } from '../hooks/useProfiles';
import { useCreateSalary, useSalaryRecords, useUpdateSalary } from '../hooks/useSalary';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/card';
import { Table, TBody, THead } from '../components/ui/table';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { getErrorMessage } from '../lib/errors';
import { useAddPayrollReward, usePayrollMonth, useUpsertPayRate } from '../hooks/usePayroll';
import { useAddSalaryReward, useSalaryRewardsMonth } from '../hooks/useSalaryRewards';

export default function SalaryPage() {
  const { role, profile } = useAuthContext();
  const profilesQuery = useProfiles();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const payrollQuery = usePayrollMonth(month);
  const upsertRate = useUpsertPayRate();
  const addReward = useAddPayrollReward();
  const fixedSalaryQuery = useSalaryRecords();
  const updateSalary = useUpdateSalary();
  const createSalary = useCreateSalary();
  const fixedRewardsQuery = useSalaryRewardsMonth(month);
  const addFixedReward = useAddSalaryReward();

  const [draftRates, setDraftRates] = useState<Record<string, { rate: string; currency: string }>>({});
  const [draftRewards, setDraftRewards] = useState<Record<string, { amount: string; note: string }>>({});
  const [draftFixed, setDraftFixed] = useState<Record<string, { salary: string; currency: string }>>({});
  const [draftPayMode, setDraftPayMode] = useState<Record<string, 'fixed' | 'hourly'>>({});
  const [draftFixedRewards, setDraftFixedRewards] = useState<Record<string, { amount: string; note: string }>>({});

  const monthStart = useMemo(() => `${month}-01`, [month]);

  const downloadCsv = (rows: Array<Record<string, unknown>>, filename: string) => {
    const headers = Object.keys(rows[0] ?? {});
    const escape = (value: unknown) => {
      const s = value === null || value === undefined ? '' : String(value);
      if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
      return s;
    };
    const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (payrollQuery.isLoading) {
    return <div className="p-6 text-sm text-gray-600">Loading payroll...</div>;
  }

  if (payrollQuery.isError) {
    return (
      <div className="p-6">
        <Card className="border border-red-100 bg-red-50">
          <p className="text-sm text-red-700">Could not load payroll.</p>
          <p className="mt-1 text-xs text-red-700">
            {getErrorMessage(payrollQuery.error, 'Failed to load payroll.')}
          </p>
          <Button className="mt-3" variant="outline" onClick={() => void payrollQuery.refetch()}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  if (role !== 'admin') {
    const myMode = profile?.pay_mode ?? 'fixed';
    const fixed = fixedSalaryQuery.data?.[0] ?? null;
    const mine = payrollQuery.data?.rows?.[0] ?? null;
    const myFixedRewardsTotal =
      fixedRewardsQuery.data?.reduce((acc, r) => acc + Number(r.amount ?? 0), 0) ?? 0;
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Card className="max-w-xl">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500">Payroll month</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">{month}</p>
            </div>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
          </div>
        </Card>

        {myMode === 'fixed' ? (
          fixed ? (
            <Card className="max-w-xl">
              <p className="text-sm text-gray-500">Fixed salary</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {fixed.currency} {Number(fixed.salary).toLocaleString()}
              </p>
              <p className="mt-1 text-sm text-gray-500">Effective: {fixed.effective_date}</p>
              <p className="mt-3 text-sm text-gray-600">
                Rewards this month: {fixed.currency} {myFixedRewardsTotal.toLocaleString()}
              </p>
              <p className="mt-1 text-sm font-medium text-gray-900">
                Total: {fixed.currency} {(Number(fixed.salary) + myFixedRewardsTotal).toLocaleString()}
              </p>
            </Card>
          ) : (
            <Card className="max-w-xl">No salary record found.</Card>
          )
        ) : mine ? (
          <Card className="max-w-xl">
            <p className="text-sm text-gray-500">Estimated pay (hourly)</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {mine.currency} {Number(mine.estimated_total).toLocaleString()}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-gray-500">Hours</p>
                <p className="text-sm font-medium text-gray-900">{mine.hours}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Rate / hour</p>
                <p className="text-sm font-medium text-gray-900">
                  {mine.currency} {mine.rate_per_hour}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Rewards</p>
                <p className="text-sm font-medium text-gray-900">
                  {mine.currency} {mine.rewards_total}
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="max-w-xl">No payroll data found for this month.</Card>
        )}
      </div>
    );
  }

  if (profilesQuery.isLoading) {
    return <div className="p-6 text-sm text-gray-600">Loading employee list...</div>;
  }

  if (profilesQuery.isError) {
    return (
      <div className="p-6">
        <Card className="border border-red-100 bg-red-50">
          <p className="text-sm text-red-700">Could not load employee list.</p>
          <p className="mt-1 text-xs text-red-700">
            {getErrorMessage(profilesQuery.error, 'Failed to load employee list.')}
          </p>
          <Button className="mt-3" variant="outline" onClick={() => void profilesQuery.refetch()}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  const payrollRows = payrollQuery.data?.rows ?? [];
  const payrollByEmployeeId = new Map(payrollRows.map((row) => [row.employee_id, row]));
  const fixedRows = fixedSalaryQuery.data ?? [];
  const fixedByEmployeeId = new Map(fixedRows.map((row) => [row.employee_id, row]));
  const fixedRewardsTotalByEmployeeId = new Map<string, number>();
  for (const r of fixedRewardsQuery.data ?? []) {
    fixedRewardsTotalByEmployeeId.set(
      r.employee_id,
      (fixedRewardsTotalByEmployeeId.get(r.employee_id) ?? 0) + Number(r.amount ?? 0),
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Compensation</h2>
            <p className="mt-1 text-sm text-gray-500">
              Fixed salary for general staff. Hourly rate for home workers.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
            <Button
              variant="outline"
              onClick={() => {
                const exportRows =
                  profilesQuery.data?.map((p) => {
                    const mode = draftPayMode[p.id] ?? (p.pay_mode ?? 'fixed');
                    const fixed = fixedByEmployeeId.get(p.id) ?? null;
                    const fixedRewards = fixedRewardsTotalByEmployeeId.get(p.id) ?? 0;
                    const payroll = payrollByEmployeeId.get(p.id) ?? null;
                    return {
                      employee_name: p.full_name,
                      pay_mode: mode,
                      fixed_salary: fixed?.salary ?? '',
                      fixed_currency: fixed?.currency ?? '',
                      fixed_rewards_month: mode === 'fixed' ? fixedRewards : '',
                      fixed_total_month:
                        mode === 'fixed' && fixed ? Number(fixed.salary) + fixedRewards : '',
                      hours: mode === 'hourly' ? payroll?.hours ?? 0 : '',
                      rate_per_hour: mode === 'hourly' ? payroll?.rate_per_hour ?? 0 : '',
                      hourly_currency: mode === 'hourly' ? payroll?.currency ?? '' : '',
                      hourly_rewards_month: mode === 'hourly' ? payroll?.rewards_total ?? 0 : '',
                      hourly_estimated_total: mode === 'hourly' ? payroll?.estimated_total ?? 0 : '',
                    };
                  }) ?? [];
                downloadCsv(exportRows, `compensation_${month}.csv`);
              }}
            >
              Download CSV
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <THead>
              <tr>
                <th className="px-3 py-2">Employee</th>
                <th className="px-3 py-2">Mode</th>
                <th className="px-3 py-2 hidden md:table-cell">Fixed salary</th>
                <th className="px-3 py-2 hidden lg:table-cell">Hours</th>
                <th className="px-3 py-2 hidden lg:table-cell">Rate / hour</th>
                <th className="px-3 py-2 hidden md:table-cell">Currency</th>
                <th className="px-3 py-2 hidden lg:table-cell">Rewards</th>
                <th className="px-3 py-2">Estimated</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </THead>
            <TBody>
              {profilesQuery.data?.map((profileRow) => {
                const mode = draftPayMode[profileRow.id] ?? (profileRow.pay_mode ?? 'fixed');
                const payroll = payrollByEmployeeId.get(profileRow.id) ?? {
                  employee_id: profileRow.id,
                  employee_name: profileRow.full_name,
                  hours: 0,
                  rate_per_hour: 0,
                  currency: 'JOD',
                  rewards_total: 0,
                  estimated_total: 0,
                };
                const fixed = fixedByEmployeeId.get(profileRow.id) ?? null;

                const draftRate = draftRates[profileRow.id] ?? {
                  rate: String(payroll.rate_per_hour ?? 0),
                  currency: payroll.currency ?? 'JOD',
                };

                const draftReward = draftRewards[profileRow.id] ?? { amount: '', note: '' };
                const draftSalary = draftFixed[profileRow.id] ?? {
                  salary: String(fixed?.salary ?? 0),
                  currency: fixed?.currency ?? 'JOD',
                };
                const fixedRewardsTotal = fixedRewardsTotalByEmployeeId.get(profileRow.id) ?? 0;
                const draftFixedReward = draftFixedRewards[profileRow.id] ?? { amount: '', note: '' };

                return (
                  <tr key={profileRow.id} className="even:bg-gray-50">
                    <td className="px-3 py-2">{profileRow.full_name}</td>
                    <td className="px-3 py-2">
                      <select
                        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm"
                        value={mode}
                        onChange={async (e) => {
                          const next = e.target.value as 'fixed' | 'hourly';
                          setDraftPayMode((prev) => ({ ...prev, [profileRow.id]: next }));
                          try {
                            const { error } = await supabase
                              .from('profiles')
                              .update({ pay_mode: next })
                              .eq('id', profileRow.id);
                            if (error) throw error;
                            toast.success('Mode updated.');
                            void profilesQuery.refetch();
                          } catch (err) {
                            toast.error(getErrorMessage(err, 'Unable to update mode.'));
                          }
                        }}
                      >
                        <option value="fixed">fixed</option>
                        <option value="hourly">hourly</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell">
                      {mode === 'fixed' ? (
                        <div className="flex flex-col gap-2 md:flex-row md:items-center">
                          <Input
                            className="w-32"
                            type="number"
                            step="0.01"
                            value={draftSalary.salary}
                            onChange={(e) =>
                              setDraftFixed((prev) => ({
                                ...prev,
                                [profileRow.id]: { ...draftSalary, salary: e.target.value },
                              }))
                            }
                          />
                          <Input
                            className="w-20"
                            value={draftSalary.currency}
                            onChange={(e) =>
                              setDraftFixed((prev) => ({
                                ...prev,
                                [profileRow.id]: { ...draftSalary, currency: e.target.value },
                              }))
                            }
                          />
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 hidden lg:table-cell">{payroll.hours}</td>
                    <td className="px-3 py-2 hidden lg:table-cell">
                      {mode === 'hourly' ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={draftRate.rate}
                          onChange={(event) =>
                            setDraftRates((prev) => ({
                              ...prev,
                              [profileRow.id]: { ...draftRate, rate: event.target.value },
                            }))
                          }
                        />
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell">
                      {mode === 'hourly' ? (
                        <Input
                          value={draftRate.currency}
                          onChange={(event) =>
                            setDraftRates((prev) => ({
                              ...prev,
                              [profileRow.id]: { ...draftRate, currency: event.target.value },
                            }))
                          }
                        />
                      ) : (
                        <span className="text-gray-400">{draftSalary.currency}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 hidden lg:table-cell">
                      {mode === 'hourly' ? (
                        <>
                          {payroll.currency} {payroll.rewards_total}
                        </>
                      ) : (
                        <>
                          {draftSalary.currency} {fixedRewardsTotal}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {mode === 'hourly' ? (
                        <>
                          {payroll.currency} {payroll.estimated_total}
                        </>
                      ) : fixed ? (
                        <>
                          {fixed.currency} {(Number(fixed.salary) + fixedRewardsTotal).toLocaleString()}
                        </>
                      ) : (
                        <span className="text-gray-400">No salary</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
                        {mode === 'fixed' ? (
                          <Button
                            size="sm"
                            disabled={updateSalary.isPending || createSalary.isPending}
                            onClick={async () => {
                              try {
                                if (fixed) {
                                  await updateSalary.mutateAsync({
                                    id: fixed.id,
                                    salary: Number(draftSalary.salary),
                                    currency: draftSalary.currency || 'JOD',
                                  });
                                } else {
                                  await createSalary.mutateAsync({
                                    employee_id: profileRow.id,
                                    employee_name: profileRow.full_name,
                                    salary: Number(draftSalary.salary),
                                    currency: draftSalary.currency || 'JOD',
                                  });
                                }
                                toast.success('Salary saved.');
                                void fixedSalaryQuery.refetch();
                              } catch (error) {
                                toast.error(getErrorMessage(error, 'Unable to save salary.'));
                              }
                            }}
                          >
                            Save salary
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            disabled={upsertRate.isPending}
                            onClick={async () => {
                              try {
                                await upsertRate.mutateAsync({
                                  employee_id: profileRow.id,
                                  rate_per_hour: Number(draftRate.rate),
                                  currency: draftRate.currency || 'JOD',
                                  effective_date: monthStart,
                                });
                                toast.success('Rate saved.');
                              } catch (error) {
                                toast.error(getErrorMessage(error, 'Unable to save rate.'));
                              }
                            }}
                          >
                            Save rate
                          </Button>
                        )}

                        {mode === 'fixed' && (
                          <>
                            <Input
                              className="w-full md:w-28"
                              type="number"
                              step="0.01"
                              placeholder="Reward"
                              value={draftFixedReward.amount}
                              onChange={(e) =>
                                setDraftFixedRewards((prev) => ({
                                  ...prev,
                                  [profileRow.id]: { ...draftFixedReward, amount: e.target.value },
                                }))
                              }
                            />
                            <Input
                              className="w-full md:w-48"
                              placeholder="Note"
                              value={draftFixedReward.note}
                              onChange={(e) =>
                                setDraftFixedRewards((prev) => ({
                                  ...prev,
                                  [profileRow.id]: { ...draftFixedReward, note: e.target.value },
                                }))
                              }
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={addFixedReward.isPending || !draftFixedReward.amount}
                              onClick={async () => {
                                try {
                                  await addFixedReward.mutateAsync({
                                    employee_id: profileRow.id,
                                    amount: Number(draftFixedReward.amount),
                                    currency: draftSalary.currency || 'JOD',
                                    reward_date: monthStart,
                                    note: draftFixedReward.note,
                                  });
                                  setDraftFixedRewards((prev) => ({
                                    ...prev,
                                    [profileRow.id]: { amount: '', note: '' },
                                  }));
                                  toast.success('Reward added.');
                                  void fixedRewardsQuery.refetch();
                                } catch (error) {
                                  toast.error(getErrorMessage(error, 'Unable to add reward.'));
                                }
                              }}
                            >
                              Add reward
                            </Button>
                          </>
                        )}

                        {mode === 'hourly' && (
                          <>
                            <Input
                              className="w-full md:w-28"
                              type="number"
                              step="0.01"
                              placeholder="Reward"
                              value={draftReward.amount}
                              onChange={(e) =>
                                setDraftRewards((prev) => ({
                                  ...prev,
                                  [profileRow.id]: { ...draftReward, amount: e.target.value },
                                }))
                              }
                            />
                            <Input
                              className="w-full md:w-48"
                              placeholder="Note"
                              value={draftReward.note}
                              onChange={(e) =>
                                setDraftRewards((prev) => ({
                                  ...prev,
                                  [profileRow.id]: { ...draftReward, note: e.target.value },
                                }))
                              }
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={addReward.isPending || !draftReward.amount}
                              onClick={async () => {
                                try {
                                  await addReward.mutateAsync({
                                    employee_id: profileRow.id,
                                    amount: Number(draftReward.amount),
                                    currency: draftRate.currency || payroll.currency || 'JOD',
                                    reward_date: monthStart,
                                    note: draftReward.note,
                                  });
                                  setDraftRewards((prev) => ({
                                    ...prev,
                                    [profileRow.id]: { amount: '', note: '' },
                                  }));
                                  toast.success('Reward added.');
                                } catch (error) {
                                  toast.error(getErrorMessage(error, 'Unable to add reward.'));
                                }
                              }}
                            >
                              Add reward
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </TBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
