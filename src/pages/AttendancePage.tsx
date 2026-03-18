import { useState } from 'react';
import { AttendanceForm } from '../components/attendance/AttendanceForm';
import { AttendanceTable } from '../components/attendance/AttendanceTable';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useAttendanceHistory } from '../hooks/useAttendance';
import { useAuthContext } from '../context/AuthContext';
import { getErrorMessage } from '../lib/errors';

function monthRange(value: string) {
  if (!value) return { start: '', end: '' };
  const [yearRaw, monthRaw] = value.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return { start: '', end: '' };
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: toIso(start), end: toIso(end) };
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0] ?? {});
  const escape = (value: unknown) => {
    const s = value === null || value === undefined ? '' : String(value);
    if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AttendancePage() {
  const { role } = useAuthContext();
  const [month, setMonth] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [employee, setEmployee] = useState('');

  const attendanceQuery = useAttendanceHistory({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    employee: employee || undefined,
  });

  const errorMessage = getErrorMessage(attendanceQuery.error, 'Could not load attendance records.');

  const isAdminView = role === 'admin' || role === 'manager';

  return (
    <div className="space-y-6 p-4 md:p-6">
      <AttendanceForm />

      <Card>
        <h2 className="mb-4 text-base font-semibold text-gray-900">
          {isAdminView ? 'Filter Attendance (HR)' : 'My Attendance Records'}
        </h2>
        <div className={`grid gap-4 ${isAdminView ? 'md:grid-cols-6' : 'md:grid-cols-4'}`}>
          <Input
            type="month"
            value={month}
            onChange={(event) => {
              const next = event.target.value;
              setMonth(next);
              const range = monthRange(next);
              setStartDate(range.start);
              setEndDate(range.end);
            }}
          />
          <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          {isAdminView && (
            <Input
              placeholder="Employee name"
              value={employee}
              onChange={(event) => setEmployee(event.target.value)}
            />
          )}
          <Button variant="outline" onClick={() => void attendanceQuery.refetch()}>
            Apply
          </Button>
          {isAdminView && (
            <Button
              variant="outline"
              disabled={!attendanceQuery.data?.length}
              onClick={() => {
                const csvRows =
                  attendanceQuery.data?.map((row) => ({
                    employee_name: row.employee_name,
                    date: row.date,
                    check_in: row.check_in,
                    check_out: row.check_out,
                    worked_hours: row.worked_hours,
                    net_hours_worked: row.net_hours_worked,
                    work_location: row.work_location,
                    job_description: row.job_description,
                    management_note: row.management_note,
                  })) ?? [];
                const csv = toCsv(csvRows);
                const suffix = month ? month : `${startDate || 'all'}_${endDate || 'all'}`;
                downloadText(`attendance_${suffix}.csv`, csv);
              }}
            >
              Download CSV
            </Button>
          )}
        </div>
      </Card>

      {attendanceQuery.isLoading && <p className="text-sm text-gray-600">Loading attendance...</p>}

      {attendanceQuery.isError && (
        <Card className="border border-red-100 bg-red-50">
          <p className="text-sm text-red-700">Could not load attendance records.</p>
          <p className="mt-1 text-xs text-red-700">{errorMessage}</p>
          <Button className="mt-3" variant="outline" onClick={() => void attendanceQuery.refetch()}>
            Retry
          </Button>
        </Card>
      )}

      {attendanceQuery.isSuccess && <AttendanceTable rows={attendanceQuery.data} />}
    </div>
  );
}
