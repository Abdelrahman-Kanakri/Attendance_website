import { useState } from 'react';
import { toast } from 'sonner';
import { useAuthContext } from '../../context/AuthContext';
import { useUpdateManagementNote } from '../../hooks/useAttendance';
import type { DailyAttendance } from '../../types';
import { Table, TBody, THead } from '../ui/table';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { formatDisplayDate } from '../../lib/format';

interface AttendanceTableProps {
  rows: DailyAttendance[];
}

export function AttendanceTable({ rows }: AttendanceTableProps) {
  const { role } = useAuthContext();
  const updateNote = useUpdateManagementNote();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const isAdminView = role === 'admin' || role === 'manager';

  const saveNote = async (id: string) => {
    try {
      await updateNote.mutateAsync({ id, management_note: notes[id] ?? '' });
      toast.success('Management note saved.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save note.';
      toast.error(message);
    }
  };

  if (!isAdminView) {
    return (
      <div className="space-y-3">
        {rows.map((row) => {
          return (
            <CardLike key={row.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Date</p>
                  <p className="mt-1 text-base font-semibold text-gray-900">{formatDisplayDate(row.date)}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Check-in</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{row.check_in ?? '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Check-out</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{row.check_out ?? '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Worked hours</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{row.worked_hours ?? '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Location</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{row.work_location ?? '-'}</p>
                </div>
              </div>
            </CardLike>
          );
        })}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <Table>
        <THead>
          <tr>
            <th className="px-3 py-2">Employee</th>
            <th className="px-3 py-2">Date</th>
            {isAdminView && <th className="px-3 py-2">Website login</th>}
            <th className="px-3 py-2">Check In</th>
            <th className="px-3 py-2">Worked Hours</th>
            <th className="px-3 py-2 hidden md:table-cell">Location</th>
            <th className="px-3 py-2 hidden md:table-cell">Management Note</th>
            {!isAdminView && <th className="px-3 py-2">Actions</th>}
          </tr>
        </THead>
        <TBody>
          {rows.map((row) => {
            return (
              <tr key={row.id} className="even:bg-gray-50">
                <td className="px-3 py-2">{row.employee_name}</td>
                <td className="px-3 py-2">{formatDisplayDate(row.date)}</td>
                {isAdminView && <td className="px-3 py-2">{row.web_login_time ?? '-'}</td>}
                <td className="px-3 py-2">{row.check_in ?? '-'}</td>
                <td className="px-3 py-2">{row.worked_hours ?? '-'}</td>
                <td className="px-3 py-2 hidden md:table-cell">{row.work_location}</td>
                <td className="px-3 py-2 hidden md:table-cell">
                  {isAdminView ? (
                    <div className="flex min-w-64 items-center gap-2">
                      <Input
                        value={notes[row.id] ?? row.management_note ?? ''}
                        onChange={(event) =>
                          setNotes((prev) => ({ ...prev, [row.id]: event.target.value }))
                        }
                      />
                      <Button size="sm" onClick={() => void saveNote(row.id)}>
                        Save
                      </Button>
                    </div>
                  ) : (
                    <span>{row.management_note ?? '-'}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}

function CardLike({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">{children}</div>;
}
