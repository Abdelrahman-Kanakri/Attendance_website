import type { LeaveStatus } from '../../types';
import { cn } from '../../lib/utils';

const styles: Record<LeaveStatus, string> = {
  Pending: 'bg-yellow-100 text-yellow-800',
  Approved: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-800',
};

export function StatusBadge({ status }: { status: LeaveStatus }) {
  return (
    <span
      className={cn('inline-flex rounded-full px-2 py-1 text-xs font-semibold', styles[status])}
    >
      {status}
    </span>
  );
}
