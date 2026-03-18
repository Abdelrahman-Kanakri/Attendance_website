import { AttendanceForm } from '../components/attendance/AttendanceForm';
import { AttendanceTable } from '../components/attendance/AttendanceTable';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useMyAttendanceHistory } from '../hooks/useAttendance';
import { useAuthContext } from '../context/AuthContext';
import { getErrorMessage } from '../lib/errors';

export default function AttendancePage() {
  const { role } = useAuthContext();
  const myHistoryQuery = useMyAttendanceHistory();

  const myHistoryError = getErrorMessage(myHistoryQuery.error, 'Could not load attendance history.');

  const isAdminView = role === 'admin' || role === 'manager';

  return (
    <div className="space-y-6 p-4 md:p-6">
      <AttendanceForm />

      {!isAdminView && (
        <Card>
          <h2 className="mb-4 text-base font-semibold text-gray-900">Today&apos;s Attendance Submission</h2>
          <p className="text-sm text-gray-600">Only today&apos;s submitted attendance is shown for your daily log.</p>
        </Card>
      )}

      <Card>
        <h2 className="mb-2 text-base font-semibold text-gray-900">
          {isAdminView ? 'My Attendance History' : 'My Attendance History'}
        </h2>
        <p className="mb-4 text-sm text-gray-600">Read-only history of your submitted attendance days.</p>

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

      {!isAdminView && (
        <Card>
          <p className="text-xs text-gray-500">
            HR and managers can review all records from the separate All Attendance page.
          </p>
        </Card>
      )}
    </div>
  );
}
