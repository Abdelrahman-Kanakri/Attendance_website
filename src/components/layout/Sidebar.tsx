import { Link, NavLink } from 'react-router-dom';
import { LayoutDashboard, CalendarClock, Plane, WalletCards, Shield } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthContext } from '../../context/AuthContext';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/attendance', label: 'Attendance', icon: CalendarClock },
  { to: '/leave', label: 'Leave', icon: Plane },
  { to: '/salary', label: 'Salary', icon: WalletCards },
];

export function Sidebar({ open, onClose }: SidebarProps) {
  const { profile } = useAuthContext();
  const canViewAllAttendance = profile?.role === 'admin' || profile?.role === 'manager';

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 w-64 -translate-x-full bg-gray-900 p-4 text-white transition-transform md:static md:translate-x-0',
        open && 'translate-x-0',
      )}
    >
      <div className="mb-8">
        <Link to="/dashboard" className="text-lg font-semibold text-white">
          HR Portal
        </Link>
        <p className="mt-2 text-xs text-gray-400">Internal workforce workspace</p>
      </div>

      <nav className="space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800 hover:text-white',
                isActive && 'bg-gray-800 text-white',
              )
            }
          >
            <Icon size={16} />
            <span>{label}</span>
          </NavLink>
        ))}

        {canViewAllAttendance && (
          <NavLink
            to="/all-attendance"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800 hover:text-white',
                isActive && 'bg-gray-800 text-white',
              )
            }
          >
            <CalendarClock size={16} />
            <span>All Attendance</span>
          </NavLink>
        )}

        {profile?.role === 'admin' && (
          <NavLink
            to="/admin"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800 hover:text-white',
                isActive && 'bg-gray-800 text-white',
              )
            }
          >
            <Shield size={16} />
            <span>Admin</span>
          </NavLink>
        )}
      </nav>

      <div className="mt-auto rounded-md bg-gray-800 p-3">
        <p className="text-sm font-medium text-white">{profile?.full_name ?? 'Unknown User'}</p>
        <p className="text-xs capitalize text-gray-400">{profile?.role ?? 'employee'}</p>
      </div>
    </aside>
  );
}
