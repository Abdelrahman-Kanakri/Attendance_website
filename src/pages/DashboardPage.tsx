import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDashboardStats, useRecentLeaves, useWeeklyAttendance } from '../hooks/useDashboard';
import { Card } from '../components/ui/card';
import { Table, TBody, THead } from '../components/ui/table';
import { StatusBadge } from '../components/ui/status-badge';
import { Button } from '../components/ui/button';
import { StatsGrid } from '../components/dashboard/StatsGrid';
import { useAuthContext } from '../context/AuthContext';
import { getErrorMessage } from '../lib/errors';

export default function DashboardPage() {
  const { role } = useAuthContext();
  const statsQuery = useDashboardStats();
  const weeklyQuery = useWeeklyAttendance();
  const recentLeavesQuery = useRecentLeaves();

  const loading = statsQuery.isLoading || weeklyQuery.isLoading || recentLeavesQuery.isLoading;
  const error = statsQuery.error ?? weeklyQuery.error ?? recentLeavesQuery.error;
  const errorMessage = getErrorMessage(error, 'Failed to load dashboard data.');

  if (loading) {
    return <div className="p-6 text-sm text-gray-600">Loading dashboard...</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border border-red-100 bg-red-50 text-red-700">
          <p className="text-sm font-medium">Failed to load dashboard data.</p>
          <p className="mt-1 text-xs">{errorMessage}</p>
          <Button className="mt-3" variant="outline" onClick={() => void Promise.all([statsQuery.refetch(), weeklyQuery.refetch(), recentLeavesQuery.refetch()])}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  const isEmployeeView = role !== 'admin';
  const safeStats = statsQuery.data ?? {
    totalEmployees: 0,
    presentToday: 0,
    onLeaveToday: 0,
    pendingRequests: 0,
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <StatsGrid stats={safeStats} isEmployee={isEmployeeView} />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Weekly Attendance</h2>
          </div>
          <ResponsiveContainer width="100%" height={288}>
            <BarChart data={weeklyQuery.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#4f46e5" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-gray-900">Quick Actions</h2>
          <div className="mt-4 space-y-3">
            <Link to="/attendance" className="block">
              <Button className="w-full">Log Today's Attendance</Button>
            </Link>
            <Link to="/leave" className="block">
              <Button className="w-full" variant="outline">
                Submit Leave Request
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 text-base font-semibold text-gray-900">Recent Leave Requests</h2>
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <tr>
                <th className="px-3 py-2">Employee</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Days</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </THead>
            <TBody>
              {recentLeavesQuery.data?.map((leave) => (
                <tr key={leave.id} className="even:bg-gray-50">
                  <td className="px-3 py-2 text-gray-700">{leave.employee_name}</td>
                  <td className="px-3 py-2 text-gray-700">{leave.date}</td>
                  <td className="px-3 py-2 text-gray-700">{leave.leave_type}</td>
                  <td className="px-3 py-2 text-gray-700">{leave.duration_days}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={leave.status} />
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
