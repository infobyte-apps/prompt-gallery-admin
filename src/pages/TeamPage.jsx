import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Shield, ShieldCheck, ShieldAlert, 
  Trash2, Edit3, AlertCircle, CheckCircle2, RefreshCw 
} from 'lucide-react';
import { api } from '../services/api';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

export function TeamPage() {
  const { user: currentUser, isSuperAdmin } = useAuth();
  const notify = useNotification();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add Member Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('editor');
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);

  // Edit Role Modal
  const [editingMember, setEditingMember] = useState(null);
  const [selectedRole, setSelectedRole] = useState('editor');
  const [editError, setEditError] = useState('');
  const [updating, setUpdating] = useState(false);

  // Revoke modal
  const [revokeTarget, setRevokeTarget] = useState(null);

  const fetchMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.team.list();
      setMembers(data);
    } catch (err) {
      setError(err.message || 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newUserId.trim()) {
      setAddError('User Auth UUID is required');
      return;
    }

    setAdding(true);
    setAddError('');
    try {
      await api.team.addMember(newUserId.trim(), newUserEmail.trim(), newUserRole);
      notify.success('Team member added successfully');
      setAddModalOpen(false);
      setNewUserId('');
      setNewUserEmail('');
      setNewUserRole('editor');
      fetchMembers();
    } catch (err) {
      setAddError(err.message || 'Failed to add team member');
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateRole = async (e) => {
    e.preventDefault();
    if (!editingMember) return;

    const superAdminCount = members.filter((m) => m.role === 'super_admin').length;
    if (editingMember.role === 'super_admin' && selectedRole !== 'super_admin' && superAdminCount <= 1) {
      setEditError('Action blocked: Cannot demote the sole active Super Admin in the system.');
      return;
    }

    setUpdating(true);
    setEditError('');
    try {
      await api.team.updateRole(editingMember.user_id, selectedRole);
      notify.success(`Updated role for ${editingMember.email || editingMember.user_id} to ${selectedRole}`);
      setEditingMember(null);
      fetchMembers();
    } catch (err) {
      setEditError(err.message || 'Failed to change role');
    } finally {
      setUpdating(false);
    }
  };

  const handleConfirmRevoke = async () => {
    if (!revokeTarget) return;

    const superAdminCount = members.filter((m) => m.role === 'super_admin').length;
    if (revokeTarget.role === 'super_admin' && superAdminCount <= 1) {
      notify.error('Action blocked: Cannot revoke the sole active Super Admin.');
      setRevokeTarget(null);
      return;
    }

    try {
      await api.team.removeMember(revokeTarget.user_id);
      notify.success(`Revoked access for ${revokeTarget.email || revokeTarget.user_id}`);
      setRevokeTarget(null);
      fetchMembers();
    } catch (err) {
      notify.error(err.message || 'Failed to revoke member');
    }
  };

  const roleColors = {
    super_admin: 'bg-purple-100 text-purple-800 border-purple-200',
    publisher: 'bg-blue-100 text-blue-800 border-blue-200',
    editor: 'bg-amber-100 text-amber-800 border-amber-200',
    viewer: 'bg-slate-100 text-slate-800 border-slate-200',
  };

  const roleDescriptions = {
    super_admin: 'Full system control, database access, team governance',
    publisher: 'Publish drafts, save live catalog updates, manage taxonomies',
    editor: 'Create & edit drafts, upload sample media (cannot publish)',
    viewer: 'Read-only access to drafts, private previews and metrics',
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Team & Governance</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Super Admin-only membership directory. Manage staff roles and enforce last Super Admin protection.
          </p>
        </div>

        <button
          onClick={() => setAddModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Team Member</span>
        </button>
      </div>

      {loading ? (
        <LoadingSpinner message="Querying admin directory..." />
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-sm space-y-3">
          <p className="font-semibold">Unable to fetch team members</p>
          <p>{error}</p>
          <button
            onClick={fetchMembers}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 uppercase text-[11px] font-semibold tracking-wider">
                  <th className="py-3 px-4">Member / Identity</th>
                  <th className="py-3 px-4 w-40">Role</th>
                  <th className="py-3 px-4 hidden md:table-cell">Privilege Scope</th>
                  <th className="py-3 px-4 w-32 hidden sm:table-cell">Added</th>
                  <th className="py-3 px-4 text-right w-32">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {members.map((member) => {
                  const isCurrent = member.user_id === currentUser?.id;
                  const isSuper = member.role === 'super_admin';

                  return (
                    <tr key={member.user_id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Identity */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0">
                            {member.email ? member.email.slice(0, 2).toUpperCase() : 'US'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-900 truncate">
                                {member.email || 'Admin User'}
                              </span>
                              {isCurrent && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-slate-400 text-[11px] block truncate">
                              {member.user_id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${
                            roleColors[member.role] || 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {member.role.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="py-3.5 px-4 hidden md:table-cell text-xs text-slate-500">
                        {roleDescriptions[member.role] || ''}
                      </td>

                      {/* Added Date */}
                      <td className="py-3.5 px-4 hidden sm:table-cell text-xs text-slate-400">
                        {new Date(member.created_at).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {(() => {
                          const superAdminCount = members.filter((m) => m.role === 'super_admin').length;
                          const isOnlySuperAdmin = member.role === 'super_admin' && superAdminCount <= 1;

                          return (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setEditingMember(member);
                                  setSelectedRole(member.role);
                                  setEditError('');
                                }}
                                className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                                title="Change Role"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => !isOnlySuperAdmin && setRevokeTarget(member)}
                                disabled={isOnlySuperAdmin}
                                className={`p-1.5 rounded-lg ${
                                  isOnlySuperAdmin
                                    ? 'text-slate-300 cursor-not-allowed'
                                    : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                                }`}
                                title={isOnlySuperAdmin ? 'Cannot revoke the only Super Admin' : 'Revoke Membership'}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setAddModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Add Existing Auth User to Team</h3>
            <p className="text-xs text-slate-500">
              Grant administration role to a registered Supabase Auth account using their User UUID.
            </p>

            {addError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-800 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Auth User UUID <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  placeholder="e.g. 8f498c0b-3375-4f3b-a9a3-5c77726bfa9e"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Email Label
                </label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="staff@promptgallery.internal"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Assigned Role
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="editor">Editor (Create & edit drafts)</option>
                  <option value="publisher">Publisher (Publish & live updates)</option>
                  <option value="viewer">Viewer (Read-only catalog & preview)</option>
                  <option value="super_admin">Super Admin (Full administrative access)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  {adding ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setEditingMember(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Modify Role: {editingMember.email || editingMember.user_id}
            </h3>

            {editError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-800 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateRole} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Select New Role
                </label>
                <div className="space-y-2">
                  {['super_admin', 'publisher', 'editor', 'viewer'].map((r) => (
                    <label
                      key={r}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${
                        selectedRole === r ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={r}
                        checked={selectedRole === r}
                        onChange={(e) => setSelectedRole(e.target.value)}
                        className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="text-xs">
                        <p className="font-semibold text-slate-900 capitalize">{r.replace('_', ' ')}</p>
                        <p className="text-slate-500 mt-0.5">{roleDescriptions[r]}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  {updating ? 'Saving...' : 'Update Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revoke Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(revokeTarget)}
        title="Revoke Team Membership"
        message={`Are you sure you want to revoke admin panel access for "${revokeTarget?.email || revokeTarget?.user_id}"? Note: If this user is the last super_admin, revocation will be rejected.`}
        confirmText="Revoke Access"
        isDestructive={true}
        onConfirm={handleConfirmRevoke}
        onCancel={() => setRevokeTarget(null)}
      />
    </div>
  );
}

