import React, { useState, useEffect } from 'react';
import { Tag as TagIcon, Plus, Edit2, Trash2, Search, AlertCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

export function TagsPage() {
  const { canManageTaxonomy } = useAuth();
  const notify = useNotification();

  const [tags, setTags] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal form state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchTags = async (q = '') => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.tags.list(q);
      setTags(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch tags');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTags(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const generateSlug = (val) => {
    return val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  };

  const handleNameChange = (e) => {
    const val = e.target.value;
    setFormName(val);
    if (!editingTag) {
      setFormSlug(generateSlug(val));
    }
  };

  const openCreateModal = () => {
    setEditingTag(null);
    setFormName('');
    setFormSlug('');
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (tag) => {
    setEditingTag(tag);
    setFormName(tag.name);
    setFormSlug(tag.slug);
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Tag name is required');
      return;
    }
    if (!formSlug.trim()) {
      setFormError('Slug is required');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      await api.tags.save({
        id: editingTag?.id,
        name: formName.trim(),
        slug: formSlug.trim(),
      });

      notify.success(editingTag ? `Tag "${formName}" updated` : `Tag "${formName}" created`);
      setModalOpen(false);
      fetchTags(search);
    } catch (err) {
      setFormError(err.message || 'Failed to save tag');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    // SRS Requirement: Block deletion of in-use tags until mappings are removed explicitly
    if (deleteTarget.usage_count > 0) {
      notify.error(
        `Action Blocked: Tag "${deleteTarget.name}" is attached to ${deleteTarget.usage_count} prompt(s). Remove this tag from all prompts before deleting.`
      );
      setDeleteTarget(null);
      return;
    }

    try {
      await api.tags.delete(deleteTarget.id);
      notify.success(`Deleted tag "${deleteTarget.name}"`);
      setDeleteTarget(null);
      fetchTags(search);
    } catch (err) {
      notify.error(err.message || 'Deletion failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tags</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Keyword taxonomy for deep search filters. Tags attached to active prompts are protected against accidental deletion.
          </p>
        </div>

        {canManageTaxonomy && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Tag</span>
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search tags by name or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Searching tags..." />
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-sm space-y-3">
          <p className="font-semibold">Unable to fetch tags</p>
          <p>{error}</p>
          <button
            onClick={() => fetchTags(search)}
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
                  <th className="py-3 px-4">Tag Name & Slug</th>
                  <th className="py-3 px-4 w-40 text-center">Prompt Usage</th>
                  <th className="py-3 px-4 w-48">Status / Protection</th>
                  <th className="py-3 px-4 text-right w-36">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {tags.map((tag) => {
                  const isInUse = tag.usage_count > 0;
                  return (
                    <tr key={tag.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Name & Slug */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <TagIcon className="w-3.5 h-3.5 text-indigo-600" />
                          <span className="font-semibold text-slate-900">{tag.name}</span>
                          <span className="font-mono text-slate-400 text-xs">#{tag.slug}</span>
                        </div>
                      </td>

                      {/* Usage */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                          {tag.usage_count || 0} prompts
                        </span>
                      </td>

                      {/* Protection Note */}
                      <td className="py-3 px-4">
                        {isInUse ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Locked (In use)
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Available to delete</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        {canManageTaxonomy && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openEditModal(tag)}
                              className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                              title="Edit tag"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(tag)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title={isInUse ? 'Cannot delete: in use' : 'Delete tag'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Dialog */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              {editingTag ? 'Edit Tag' : 'Create New Tag'}
            </h3>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-800 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Tag Name
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={handleNameChange}
                  placeholder="e.g. Cyberpunk 2077"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Tag Slug
                </label>
                <input
                  type="text"
                  required
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  placeholder="cyberpunk-2077"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  {saving ? 'Saving...' : 'Save Tag'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Delete Tag"
        message={
          deleteTarget?.usage_count > 0
            ? `Cannot delete "${deleteTarget?.name}": It is currently assigned to ${deleteTarget?.usage_count} prompts. Please remove the tag from those prompts first.`
            : `Are you sure you want to delete tag "${deleteTarget?.name}"?`
        }
        confirmText="Delete Tag"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

