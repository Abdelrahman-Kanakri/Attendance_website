import { useState } from 'react';
import { toast } from 'sonner';
import { useAuthContext } from '../../context/AuthContext';
import { useUpdateManagementNote, useUpdateMyAttendanceEntry } from '../../hooks/useAttendance';
import type { DailyAttendance } from '../../types';
import { Table, TBody, THead } from '../ui/table';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { getErrorMessage } from '../../lib/errors';
import { formatDisplayDate } from '../../lib/format';

interface AttendanceTableProps {
  rows: DailyAttendance[];
}

export function AttendanceTable({ rows }: AttendanceTableProps) {
  const { role } = useAuthContext();
  const updateNote = useUpdateManagementNote();
  const updateMine = useUpdateMyAttendanceEntry();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [edits, setEdits] = useState<Record<string, { date: string; check_out: string; job_description: string }>>(
    {},
  );
  const [editingRowId, setEditingRowId] = useState<string | null>(null);

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

  const saveMyRow = async (row: DailyAttendance) => {
    const draft = edits[row.id] ?? {
      date: row.date,
      check_out: row.check_out ?? '',
      job_description: row.job_description ?? '',
    };

    try {
      await updateMine.mutateAsync({
        id: row.id,
        date: draft.date,
        check_out: draft.check_out ? draft.check_out : null,
        job_description: draft.job_description ? draft.job_description : null,
        check_in: row.check_in,
      });
      toast.success('Attendance updated.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to update attendance.'));
    }
  };

  if (!isAdminView) {
    return (
      <div className="space-y-3">
        {rows.map((row) => {
          const draft = edits[row.id] ?? {
            date: row.date,
            check_out: row.check_out ?? '',
            job_description: row.job_description ?? '',
          };
          const isEditing = editingRowId === row.id;

          return (
            <CardLike key={row.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Date</p>
                  <p className="mt-1 text-base font-semibold text-gray-900">{formatDisplayDate(row.date)}</p>
                </div>
                {!isEditing ? (
                  <Button size="sm" variant="outline" onClick={() => setEditingRowId(row.id)}>
                    Edit
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setEditingRowId(null)}>
                    Close
                  </Button>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Check-in</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{row.check_in ?? '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Worked hours</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{row.worked_hours ?? '-'}</p>
                </div>
              </div>

              {isEditing && (
                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Check-out</p>
                    <Input
                      type="time"
                      value={draft.check_out}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [row.id]: { ...draft, check_out: e.target.value },
                        }))
                      }
                    />
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Job description</p>
                    <Input
                      value={draft.job_description}
                      placeholder="What did you work on?"
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [row.id]: { ...draft, job_description: e.target.value },
                        }))
                      }
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={updateMine.isPending}
                      onClick={() => void saveMyRow(row).then(() => setEditingRowId(null))}
                    >
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingRowId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
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
            const draft = edits[row.id] ?? {
              date: row.date,
              check_out: row.check_out ?? '',
              job_description: row.job_description ?? '',
            };
            const isEditing = !isAdminView && editingRowId === row.id;

            return (
              <tr key={row.id} className="even:bg-gray-50">
                <td className="px-3 py-2">{row.employee_name}</td>
                <td className="px-3 py-2">
                  {isAdminView ? (
                    formatDisplayDate(row.date)
                  ) : (
                    isEditing ? (
                      <Input
                        type="date"
                        value={draft.date}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [row.id]: { ...draft, date: e.target.value },
                          }))
                        }
                      />
                    ) : (
                      <span>{formatDisplayDate(row.date)}</span>
                    )
                  )}
                </td>
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
                {!isAdminView && (
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
                        <Input
                          className="w-32"
                          type="time"
                          value={draft.check_out}
                          placeholder="Check out"
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [row.id]: { ...draft, check_out: e.target.value },
                            }))
                          }
                        />
                        <Input
                          className="w-full md:w-56"
                          value={draft.job_description}
                          placeholder="Job description"
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [row.id]: { ...draft, job_description: e.target.value },
                            }))
                          }
                        />
                        <Button
                          size="sm"
                          disabled={updateMine.isPending}
                          onClick={() => {
                            void saveMyRow(row).then(() => setEditingRowId(null));
                          }}
                        >
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingRowId(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setEditingRowId(row.id)}>
                        Edit check-out & description
                      </Button>
                    )}
                  </td>
                )}
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
