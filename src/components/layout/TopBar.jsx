import React, { useState } from 'react';
import { Menu, LogOut, ChevronDown } from 'lucide-react';
import { Breadcrumbs } from './Breadcrumbs';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';

export function TopBar({ onOpenMobileNav }) {
  const { user, role, signOut } = useAuth();
  const notify = useNotification();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const roleColors = {
    super_admin: 'bg-purple-100 text-purple-800 border-purple-200',
    publisher: 'bg-blue-100 text-blue-800 border-blue-200',
    editor: 'bg-amber-100 text-amber-800 border-amber-200',
    viewer: 'bg-slate-100 text-slate-800 border-slate-200',
  };

  const roleLabels = {
    super_admin: 'Super Admin',
    publisher: 'Publisher',
    editor: 'Editor',
    viewer: 'Viewer',
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      notify.info('Signed out of admin panel');
    } catch (err) {
      notify.error('Sign out failed');
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Mobile Hamburger & Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileNav}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none"
          aria-label="Open mobile navigation drawer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <Breadcrumbs />
      </div>

      {/* Right: Authenticated Identity, Role Badge & Sign out */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Real Role Badge */}
        {role && (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
              roleColors[role] || 'bg-slate-100 text-slate-800 border-slate-200'
            }`}
          >
            {roleLabels[role] || role}
          </span>
        )}

        {/* User profile & Sign Out */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 focus:outline-none cursor-pointer"
            aria-label="User menu"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-200">
              {user?.email ? user.email.slice(0, 2).toUpperCase() : 'SA'}
            </div>
            <span className="hidden lg:inline text-xs font-medium text-slate-700 max-w-[160px] truncate">
              {user?.email || 'Super Admin'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white shadow-xl border border-slate-200 py-1.5 z-50">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-900 truncate">{user?.email}</p>
                <p className="text-[11px] text-slate-500 capitalize">{roleLabels[role] || 'Staff Member'}</p>
              </div>

              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  handleSignOut();
                }}
                className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
