import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../common/LoadingSpinner';

export function ProtectedRoute({ children, requireSuperAdmin = false }) {
  const { user, role, loading, canViewAdmin, isSuperAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" message="Restoring authenticated session..." />
      </div>
    );
  }

  // Not signed in
  if (!user) {
    return <Navigate to="/auth/signin" state={{ from: location }} replace />;
  }

  // Signed in but not an authorized admin member
  if (!canViewAdmin || !role) {
    return <Navigate to="/auth/access-denied" replace />;
  }

  // Route requires super_admin
  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/auth/access-denied" replace />;
  }

  return children;
}

