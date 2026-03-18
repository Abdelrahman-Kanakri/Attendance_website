import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { LeaveRequestForm } from '../components/leave/LeaveRequestForm';
import { LeaveTable } from '../components/leave/LeaveTable';
import { useLeaveBalance, useLeaveRequests } from '../hooks/useLeave';
import { useAuthContext } from '../context/AuthContext';
import { getErrorMessage } from '../lib/errors';

function Progress({ label, used, remaining, total }: { label: string; used: number; remaining: number; total: number }) {
  const percent = Math.min(100, Math.max(0, Math.round((used / total) * 100)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-gray-700">
        <span>{label}</span>
        <span>
          {remaining} of {total} remaining
        </span>
      </div>
      <progress className="h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-gray-200 [&::-webkit-progress-value]:bg-indigo-600" max={100} value={percent} />
    </div>
  );
}

export default function LeavePage() {
  const { role } = useAuthContext();
  const leaveQuery = useLeaveRequests();
  const balanceQuery = useLeaveBalance();

  const isEmployee = role === 'employee';

  return (
    <div className="space-y-6 p-4 md:p-6">
      {isEmployee && (
        <Card>
          <h2 className="mb-4 text-base font-semibold text-gray-900">Leave Balance</h2>
          {balanceQuery.isLoading && <p className="text-sm text-gray-600">Loading balances...</p>}
          {balanceQuery.isError && (
            <div>
              <p className="text-sm text-red-700">Could not load leave balance.</p>
              <p className="mt-1 text-xs text-red-700">
                {getErrorMessage(balanceQuery.error, 'Could not load leave balance.')}
              </p>
              <Button className="mt-3" variant="outline" onClick={() => void balanceQuery.refetch()}>
                Retry
              </Button>
            </div>
          )}
          {balanceQuery.isSuccess && (
            <div className="space-y-4">
              <Progress
                label="Annual Leave"
                used={balanceQuery.data.annualUsed}
                remaining={balanceQuery.data.annualRemaining}
                total={14}
              />
              <Progress
                label="Sick Leave"
                used={balanceQuery.data.sickUsed}
                remaining={balanceQuery.data.sickRemaining}
                total={14}
              />
            </div>
          )}
        </Card>
      )}

      {isEmployee && <LeaveRequestForm />}

      {leaveQuery.isLoading && <p className="text-sm text-gray-600">Loading leave records...</p>}
      {leaveQuery.isError && (
        <Card className="border border-red-100 bg-red-50">
          <p className="text-sm text-red-700">Could not load leave records.</p>
          <p className="mt-1 text-xs text-red-700">{getErrorMessage(leaveQuery.error, 'Could not load leave records.')}</p>
          <Button className="mt-3" variant="outline" onClick={() => void leaveQuery.refetch()}>
            Retry
          </Button>
        </Card>
      )}
      {leaveQuery.isSuccess && <LeaveTable rows={leaveQuery.data} />}
    </div>
  );
}
