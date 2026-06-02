import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function ProtectedRoute({
  children,
  requireAdmin = false,
}: {
  children: ReactNode;
  requireAdmin?: boolean;
}) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6 text-woodland-muted">Loading...</div>;
  if (!user) return <Navigate to="/admin-login" replace />;
  if (requireAdmin && user.role !== 'admin') return <Navigate to="/wheel" replace />;
  return <>{children}</>;
}
