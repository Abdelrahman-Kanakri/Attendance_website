import { useState } from 'react';
import { AttendanceForm } from '../components/attendance/AttendanceForm';
import { AttendanceTable } from '../components/attendance/AttendanceTable';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useAttendanceHistory, useMyAttendanceHistory } from '../hooks/useAttendance';
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
  const myHistoryQuery = useMyAttendanceHistory();

  const errorMessage = getErrorMessage(attendanceQuery.error, 'Could not load attendance records.');
  const myHistoryError = getErrorMessage(myHistoryQuery.error, 'Could not load attendance history.');

  const isAdminView = role === 'admin' || role === 'manager';

  return (
    <div className="space-y-6 p-4 md:p-6">
      <AttendanceForm />

      <Card>
        <h2 className="mb-4 text-base font-semibold text-gray-900">
          {isAdminView ? 'Filter Attendance (HR)' : "Today's Attendance Submission"}
        </h2>
        {isAdminView ? (
          <div className="grid gap-4 md:grid-cols-6">
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
            <Input
              placeholder="Employee name"
              value={employee}
              onChange={(event) => setEmployee(event.target.value)}
            />
            <Button variant="outline" onClick={() => void attendanceQuery.refetch()}>
              Apply
            </Button>
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
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            Only today&apos;s submitted attendance is shown to employees. HR can still review website login date/time.
          </p>
        )}
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

      {!isAdminView && (
        <Card>
          <h2 className="mb-2 text-base font-semibold text-gray-900">My Attendance History</h2>
          <p className="mb-4 text-sm text-gray-600">Read-only history of all submitted attendance days.</p>

          {myHistoryQuery.isLoading && <p className="text-sm text-gray-600">Loading attendance history...</p>}

          {myHistoryQuery.isError && (
            <div className="rounded-lg border border-red-100 bg-red-50 p-3">
              <p className="text-sm text-red-700">Could not load attendance history.</p>
              <p className="mt-1 text-xs text-red-700">{myHistoryError}</p>
              <Button className="mt-3" variant="outline" onClick={() => void myHistoryQuery.refetch()}>
                Retry
              </Button>
            </div>
          )}

          {myHistoryQuery.isSuccess && (
            <>
              <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Total attended days</p>
                <p className="mt-1 text-xl font-semibold text-gray-900">{myHistoryQuery.data.length}</p>
              </div>
              <AttendanceTable rows={myHistoryQuery.data} />
            </>
          )}
        </Card>
      )}
    </div>
  );
}
