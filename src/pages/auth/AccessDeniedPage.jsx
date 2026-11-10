import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldX, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function AccessDeniedPage() {
  const navigate = useNavigate();
  const { user, role, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth/signin');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center space-y-6">
        <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
          <ShieldX className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Access Denied</h2>
          <p className="text-sm text-slate-600">
            {user
              ? `You are signed in as ${user.email}, but your account does not have active staff membership privileges (Current Role: ${role || 'None'}).`
              : 'You do not have permission to access this administration section.'}
          </p>
        </div>

        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500 text-left space-y-1">
          <p className="font-semibold text-slate-700">Required Authorization:</p>
          <p>• Only registered members in <code>public.admin_members</code> can enter the panel.</p>
          <p>• Super Admin account configured: <code>4e09b48f-da2b-4f34-930d-6ce0b6b6da27</code>.</p>
          <p>• If you need access, ask your Super Admin to add your user UUID.</p>
        </div>

        <button
          onClick={handleSignOut}
          className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out and Return to Sign In</span>
        </button>
      </div>
    </div>
  );
}
