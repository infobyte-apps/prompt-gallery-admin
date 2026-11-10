import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let subscription = null;

    async function initAuth() {
      try {
        const session = await api.auth.getSession();
        if (session) {
          setUser(session.user);
          setRole(session.role);
        } else {
          setUser(null);
          setRole(null);
        }
      } catch (err) {
        console.error('Failed to initialize auth', err);
        setUser(null);
        setRole(null);
      } finally {
        setLoading(false);
      }
    }

    initAuth();

    // Listen to real-time auth state changes (login, logout, token refresh)
    subscription = api.auth.onAuthStateChange((session) => {
      if (session) {
        setUser(session.user);
        setRole(session.role);
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => {
      if (subscription?.unsubscribe) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const signIn = async (email, password) => {
    setLoading(true);
    try {
      const session = await api.auth.signIn(email, password);
      setUser(session.user);
      setRole(session.role);
      return session;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await api.auth.signOut();
      setUser(null);
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  // Role capabilities derived strictly from SRS Section 2
  const isSuperAdmin = role === 'super_admin';
  const isPublisher = role === 'publisher';
  const isEditor = role === 'editor';
  const isViewer = role === 'viewer';

  // Specific capability checks:
  const canViewAdmin = Boolean(role && ['super_admin', 'publisher', 'editor', 'viewer'].includes(role));
  const canEditDrafts = Boolean(role && ['super_admin', 'publisher', 'editor'].includes(role));
  const canPublish = Boolean(role && ['super_admin', 'publisher'].includes(role));
  const canManageTaxonomy = Boolean(role && ['super_admin', 'publisher'].includes(role));
  const canManageTeam = isSuperAdmin;

  const value = {
    user,
    role,
    loading,
    isAuthenticated: Boolean(user),
    isSuperAdmin,
    isPublisher,
    isEditor,
    isViewer,
    canViewAdmin,
    canEditDrafts,
    canPublish,
    canManageTaxonomy,
    canManageTeam,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
