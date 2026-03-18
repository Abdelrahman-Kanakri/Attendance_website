import { Card } from '../ui/card';

interface StatsGridProps {
  stats?: {
    totalEmployees: number;
    presentToday: number;
    onLeaveToday: number;
    pendingRequests: number;
  } | null;
  isEmployee: boolean;
}

export function StatsGrid({ stats, isEmployee }: StatsGridProps) {
  const safeStats = stats ?? {
    totalEmployees: 0,
    presentToday: 0,
    onLeaveToday: 0,
    pendingRequests: 0,
  };

  const items = [
    { label: 'Total Employees', value: safeStats.totalEmployees },
    { label: 'Present Today', value: safeStats.presentToday },
    { label: 'On Leave Today', value: safeStats.onLeaveToday },
    { label: 'Pending Requests', value: safeStats.pendingRequests },
  ];

  const visibleItems = isEmployee
    ? items.filter((item) => item.label === 'Present Today' || item.label === 'On Leave Today')
    : items;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {visibleItems.map((item) => (
        <Card key={item.label} className="p-5">
          <p className="text-sm text-gray-500">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{item.value}</p>
        </Card>
      ))}
    </div>
  );
}
