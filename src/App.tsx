import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuthContext } from './context/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { isSupabaseConfigured } from './lib/supabase';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AttendancePage from './pages/AttendancePage';
import AllAttendancePage from './pages/AllAttendancePage';
import LeavePage from './pages/LeavePage';
import SalaryPage from './pages/SalaryPage';
import AdminPage from './pages/AdminPage';

function RootRedirect() {
  const { user, loading } = useAuthContext();

  if (loading) {
    return <div className="p-6 text-sm text-gray-600">Loading...</div>;
  }

  return <Navigate to={user ? '/dashboard' : '/login'} replace />;
}

function LoginRoute() {
  const { user, loading } = useAuthContext();

  if (loading) {
    return <div className="p-6 text-sm text-gray-600">Loading...</div>;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <LoginPage />;
}

export default function App() {
  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
        <div className="w-full max-w-xl rounded-xl border border-amber-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">Supabase Not Configured</h1>
          <p className="mt-2 text-sm text-gray-600">
            Create a .env.local file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY,
            then restart the dev server.
          </p>
          <p className="mt-3 rounded-md bg-gray-50 p-3 font-mono text-xs text-gray-700">
            VITE_SUPABASE_URL=https://your-project-id.supabase.co
            <br />
            VITE_SUPABASE_ANON_KEY=your-anon-key
          </p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginRoute />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/all-attendance" element={<AllAttendancePage />} />
          <Route path="/leave" element={<LeavePage />} />
          <Route path="/salary" element={<SalaryPage />} />
          <Route element={<ProtectedRoute role="admin" />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
