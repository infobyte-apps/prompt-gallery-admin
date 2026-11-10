import React, { useState, useEffect } from 'react';
import { Layers, Plus, Edit2, Trash2, Eye, EyeOff, Check, AlertCircle, RefreshCw, Upload } from 'lucide-react';
import { api } from '../services/api';
import { supabase, isLiveSupabaseConfigured } from '../lib/supabaseClient';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { ImageInputTabs } from '../components/common/ImageInputTabs';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

export function CategoriesPage() {
  const { canManageTaxonomy, isViewer } = useAuth();
  const notify = useNotification();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal form state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formSortOrder, setFormSortOrder] = useState(1);
  const [formCover, setFormCover] = useState('');
  const [formCoverSourceType, setFormCoverSourceType] = useState('imagekit');
  const [formCoverFileId, setFormCoverFileId] = useState(null);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.categories.list();
      setCategories(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormName('');
    setFormSlug('');
    setFormSortOrder(categories.length + 1);
    setFormCover('');
    setFormCoverSourceType('imagekit');
    setFormCoverFileId(null);
    setFormIsActive(true);
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (cat) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormSlug(cat.slug);
    setFormSortOrder(cat.sort_order || 0);
    setFormCover(cat.cover_image_url || cat.cover_storage_path || '');
    setFormCoverSourceType(cat.cover_source_type || 'imagekit');
    setFormCoverFileId(cat.cover_imagekit_file_id || null);
    setFormIsActive(cat.is_active);
    setFormError('');
    setModalOpen(true);
  };

  const generateSlug = (val) => {
    return val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  };

  const handleNameChange = (e) => {
    const val = e.target.value;
    setFormName(val);
    if (!editingCategory) {
      setFormSlug(generateSlug(val));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Category name is required');
      return;
    }
    if (!formSlug.trim()) {
      setFormError('Slug is required');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      await api.categories.save({
        id: editingCategory?.id,
        name: formName.trim(),
        slug: formSlug.trim(),
        sort_order: Number(formSortOrder) || 0,
        cover_image_url: formCover.trim() || null,
        cover_source_type: formCoverSourceType || 'imagekit',
        cover_imagekit_file_id: formCoverFileId || null,
        cover_storage_path: formCover.trim() || null,
        is_active: formIsActive,
      });

      notify.success(
        editingCategory
          ? `Category "${formName}" updated`
          : `Category "${formName}" created`
      );
      setModalOpen(false);
      fetchCategories();
    } catch (err) {
      setFormError(err.message || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (cat) => {
    if (!canManageTaxonomy) {
      notify.error('Read-only access: Cannot modify category visibility');
      return;
    }
    try {
      await api.categories.save({
        ...cat,
        is_active: !cat.is_active,
      });
      notify.info(
        `Category "${cat.name}" is now ${!cat.is_active ? 'Active' : 'Inactive (Hidden from Discover)'}`
      );
      fetchCategories();
    } catch (err) {
      notify.error(err.message || 'Failed to update status');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.categories.delete(deleteTarget.id);
      notify.success(`Deleted category "${deleteTarget.name}"`);
      setDeleteTarget(null);
      fetchCategories();
    } catch (err) {
      notify.error(err.message || 'Deletion failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Categories</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Organize prompts into discoverable themes. Deactivating hides a theme from Discover without breaking prompt links.
          </p>
        </div>

        {canManageTaxonomy && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Category</span>
          </button>
        )}
      </div>

      {loading ? (
        <LoadingSpinner message="Loading categories..." />
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-sm space-y-3">
          <p className="font-semibold">Unable to fetch categories</p>
          <p>{error}</p>
          <button
            onClick={fetchCategories}
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
                  <th className="py-3 px-4 w-12 text-center">Order</th>
                  <th className="py-3 px-4 w-16">Cover</th>
                  <th className="py-3 px-4">Name & Slug</th>
                  <th className="py-3 px-4 w-28 text-center">Prompt Usage</th>
                  <th className="py-3 px-4 w-32">Status</th>
                  <th className="py-3 px-4 text-right w-36">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Sort Order */}
                    <td className="py-3 px-4 text-center font-semibold text-slate-400">
                      {cat.sort_order}
                    </td>

                    {/* Cover Preview */}
                    <td className="py-3 px-4">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        {cat.cover_storage_path ? (
                          <img
                            src={cat.cover_storage_path}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <Layers className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </td>

                    {/* Name & Slug */}
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900">{cat.name}</p>
                      <p className="font-mono text-slate-400 text-xs">/{cat.slug}</p>
                    </td>

                    {/* Usage count */}
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                        {cat.usage_count || 0} prompts
                      </span>
                    </td>

                    {/* Active / Inactive Badge */}
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleActive(cat)}
                        disabled={!canManageTaxonomy}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border cursor-pointer ${
                          cat.is_active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                        } disabled:cursor-not-allowed`}
                        title={cat.is_active ? 'Click to deactivate' : 'Click to activate'}
                      >
                        {cat.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        <span>{cat.is_active ? 'Active' : 'Inactive'}</span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      {canManageTaxonomy && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(cat)}
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                            title="Edit Category"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(cat)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Delete Category"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Modal Dialog */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              {editingCategory ? 'Edit Category' : 'Create New Category'}
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
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={handleNameChange}
                  placeholder="e.g. Architecture & Space"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Slug
                </label>
                <input
                  type="text"
                  required
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  placeholder="architecture-and-space"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formSortOrder}
                    onChange={(e) => setFormSortOrder(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Discover Status
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormIsActive(!formIsActive)}
                    className={`w-full py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 cursor-pointer ${
                      formIsActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-300'
                    }`}
                  >
                    {formIsActive ? <Check className="w-3.5 h-3.5" /> : null}
                    <span>{formIsActive ? 'Active in Discover' : 'Deactivated'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Category Cover Image
                </label>
                <ImageInputTabs
                  folder="/categories"
                  initialUrl={formCover}
                  initialSourceType={formCoverSourceType}
                  initialFileId={formCoverFileId}
                  onImageSelected={({ url, fileId, sourceType }) => {
                    setFormCover(url);
                    setFormCoverSourceType(sourceType);
                    setFormCoverFileId(fileId);
                  }}
                  onRemove={() => {
                    setFormCover('');
                    setFormCoverSourceType('imagekit');
                    setFormCoverFileId(null);
                  }}
                  readOnly={!canManageTaxonomy}
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
                  {saving ? 'Saving...' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Delete Category"
        message={`Are you sure you want to delete category "${deleteTarget?.name}"? Note: If this category is currently attached to any prompts, deletion will be blocked by foreign key constraint.`}
        confirmText="Delete Category"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

