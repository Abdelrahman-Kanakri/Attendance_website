import { Navigate, Outlet } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import type { Role } from '../../types';

interface ProtectedRouteProps {
  role?: Role;
}

export function ProtectedRoute({ role }: ProtectedRouteProps) {
  const { user, loading, role: currentRole } = useAuthContext();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-sm text-gray-600">Loading session...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role && currentRole !== role) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
