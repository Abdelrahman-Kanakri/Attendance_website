import { useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/attendance': 'Attendance',
  '/leave': 'Leave',
  '/salary': 'Salary',
  '/admin': 'Administration',
};

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const title = useMemo(() => TITLES[location.pathname] ?? 'HR Portal', [location.pathname]);

  return (
    <div className="min-h-screen bg-gray-100 md:flex">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {sidebarOpen && (
        <button
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          type="button"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="relative z-20 flex-1">
        <Topbar title={title} onMenu={() => setSidebarOpen(true)} />
        <Outlet />
      </main>
    </div>
  );
}
