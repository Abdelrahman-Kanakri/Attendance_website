import { toast } from 'sonner';
import { useAuthContext } from '../../context/AuthContext';
import { useUpdateLeaveStatus } from '../../hooks/useLeave';
import type { LeaveLog } from '../../types';
import { StatusBadge } from '../ui/status-badge';
import { Button } from '../ui/button';
import { Table, TBody, THead } from '../ui/table';

export function LeaveTable({ rows }: { rows: LeaveLog[] }) {
  const { role } = useAuthContext();
  const updateStatus = useUpdateLeaveStatus();

  const isAdminView = role === 'admin' || role === 'manager';

  const applyStatus = async (id: string, status: 'Approved' | 'Rejected') => {
    try {
      await updateStatus.mutateAsync({ id, status });
      toast.success(`Request ${status.toLowerCase()}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : `Unable to ${status.toLowerCase()} request.`;
      toast.error(message);
    }
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <Table>
        <THead>
          <tr>
            <th className="px-3 py-2">Employee</th>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Days</th>
            <th className="px-3 py-2">Reason</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Action</th>
          </tr>
        </THead>
        <TBody>
          {rows.map((row) => (
            <tr key={row.id} className="even:bg-gray-50">
              <td className="px-3 py-2">{row.employee_name}</td>
              <td className="px-3 py-2">{row.date}</td>
              <td className="px-3 py-2">{row.leave_type}</td>
              <td className="px-3 py-2">{row.duration_days}</td>
              <td className="px-3 py-2">{row.reason ?? '-'}</td>
              <td className="px-3 py-2">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-3 py-2">
                {isAdminView && row.status === 'Pending' ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => void applyStatus(row.id, 'Approved')}>
                      Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => void applyStatus(row.id, 'Rejected')}>
                      Reject
                    </Button>
                  </div>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
            </tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
