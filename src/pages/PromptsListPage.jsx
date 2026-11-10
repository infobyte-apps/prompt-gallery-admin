import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, Search, Filter, ArrowUpDown, Edit, Eye, Trash2, 
  CheckCircle2, RefreshCw, Image as ImageIcon, Video as VideoIcon, 
  ExternalLink, Layers 
} from 'lucide-react';
import { api } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { Pagination } from '../components/common/Pagination';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

export function PromptsListPage() {
  const { canEditDrafts, canPublish, isViewer } = useAuth();
  const notify = useNotification();

  const [prompts, setPrompts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters, search & pagination state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortField, setSortField] = useState('updated_at');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load categories for filter dropdown
  useEffect(() => {
    async function loadCats() {
      try {
        const cats = await api.categories.list();
        setCategories(cats);
      } catch (err) {
        console.error('Failed to load categories for filter', err);
      }
    }
    loadCats();
  }, []);

  const fetchPrompts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.prompts.list({
        page,
        limit: 10,
        search: debouncedSearch,
        status: statusFilter,
        media_type: typeFilter,
        category_id: categoryFilter,
        sortField,
        sortDir,
      });
      setPrompts(res.data);
      setTotalPages(res.totalPages);
      setTotalCount(res.total);
    } catch (err) {
      setError(err.message || 'Failed to fetch prompts catalog');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, typeFilter, categoryFilter, sortField, sortDir]);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  const handleQuickPublish = async (prompt) => {
    if (!canPublish) {
      notify.error('Editor and Viewer roles cannot publish content.');
      return;
    }
    try {
      await api.prompts.publish(prompt.id);
      notify.success(`Published "${prompt.title}"`);
      fetchPrompts();
    } catch (err) {
      notify.error(err.message || 'Publishing failed. Please verify cover media.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.prompts.delete(deleteTarget.id);
      notify.success(`Deleted prompt "${deleteTarget.title}"`);
      setDeleteTarget(null);
      fetchPrompts();
    } catch (err) {
      notify.error(err.message || 'Delete failed');
    }
  };

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Prompts Catalog</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Curate, organize and publish AI prompt cards for the mobile gallery
          </p>
        </div>

        {canEditDrafts && (
          <Link
            to="/prompts/new"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Prompt</span>
          </Link>
        )}
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search prompts by title, slug or keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
            />
          </div>

          {/* Filter dropdowns */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="published">Published</option>
              <option value="draft">Drafts</option>
              <option value="archived">Archived</option>
            </select>

            {/* Media Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Types</option>
              <option value="image">Images</option>
              <option value="video">Videos</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              className="col-span-2 sm:col-span-1 px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {(search || statusFilter !== 'all' || typeFilter !== 'all' || categoryFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                  setTypeFilter('all');
                  setCategoryFilter('all');
                  setPage(1);
                }}
                className="col-span-2 sm:col-span-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <LoadingSpinner message="Querying prompts catalog..." />
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-sm space-y-3">
          <p className="font-semibold">Unable to fetch prompts</p>
          <p>{error}</p>
          <button
            onClick={fetchPrompts}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      ) : prompts.length === 0 ? (
        <EmptyState
          title="No prompts match your criteria"
          description="Try modifying search keywords or removing active status and category filters."
          action={
            canEditDrafts && (
              <Link
                to="/prompts/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold"
              >
                <Plus className="w-4 h-4" /> Create New Prompt
              </Link>
            )
          }
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          {/* Desktop Table View (Hidden on mobile <768px) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 uppercase text-[11px] font-semibold tracking-wider">
                  <th className="py-3 px-4 w-16">Cover</th>
                  <th className="py-3 px-4 cursor-pointer select-none" onClick={() => toggleSort('title')}>
                    <div className="flex items-center gap-1 hover:text-slate-900">
                      <span>Title & Slug</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-4 w-28">Type</th>
                  <th className="py-3 px-4 w-32">Status</th>
                  <th className="py-3 px-4">Categories</th>
                  <th className="py-3 px-4 cursor-pointer select-none w-36" onClick={() => toggleSort('updated_at')}>
                    <div className="flex items-center gap-1 hover:text-slate-900">
                      <span>Updated</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-4 text-right w-40">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {prompts.map((p) => {
                  const coverThumb = p.cover?.thumbnail_path || p.cover?.preview_path || p.cover?.image_url;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Cover thumbnail */}
                      <td className="py-3 px-4">
                        <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                          {coverThumb ? (
                            <img
                              src={coverThumb}
                              alt=""
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </td>

                      {/* Title & Slug */}
                      <td className="py-3 px-4 max-w-xs">
                        <Link
                          to={`/prompts/${p.id}`}
                          className="font-semibold text-slate-900 hover:text-indigo-600 block truncate"
                        >
                          {p.title}
                        </Link>
                        <span className="font-mono text-slate-400 text-xs block truncate mt-0.5">
                          /{p.slug}
                        </span>
                      </td>

                      {/* Media Type */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 capitalize">
                          {p.media_type === 'video' ? (
                            <VideoIcon className="w-3.5 h-3.5 text-violet-600" />
                          ) : (
                            <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                          )}
                          {p.media_type}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <StatusBadge status={p.status} />
                      </td>

                      {/* Categories */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {p.categoryObjects && p.categoryObjects.length > 0 ? (
                            p.categoryObjects.map((c) => (
                              <span
                                key={c.id}
                                className="inline-block px-2 py-0.5 bg-slate-100 rounded text-[11px] text-slate-600"
                              >
                                {c.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </div>
                      </td>

                      {/* Updated Date */}
                      <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(p.updated_at).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to={`/prompts/${p.id}`}
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg inline-flex items-center gap-1 text-xs font-medium"
                            title={isViewer ? 'View preview' : 'Edit prompt'}
                          >
                            {isViewer ? <Eye className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                            <span>{isViewer ? 'View' : 'Edit'}</span>
                          </Link>

                          {/* Quick Publish / Republish (Publisher & Super Admin only) */}
                          {canPublish && p.status !== 'published' && (
                            <button
                              onClick={() => handleQuickPublish(p)}
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg inline-flex items-center gap-1 text-xs font-medium cursor-pointer"
                              title="Publish this prompt to catalog"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Publish</span>
                            </button>
                          )}

                          {/* Quick Delete (Publisher & Super Admin only) */}
                          {canPublish && (
                            <button
                              onClick={() => setDeleteTarget(p)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg inline-flex items-center gap-1 text-xs font-medium cursor-pointer"
                              title="Delete prompt"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout (Visible on screens <768px) */}
          <div className="md:hidden divide-y divide-slate-100">
            {prompts.map((p) => {
              const coverThumb = p.cover?.thumbnail_path || p.cover?.preview_path;
              return (
                <div key={p.id} className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                      {coverThumb ? (
                        <img
                          src={coverThumb}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-slate-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <StatusBadge status={p.status} size="sm" />
                        <span className="text-[10px] text-slate-400">
                          {new Date(p.updated_at).toLocaleDateString()}
                        </span>
                      </div>

                      <Link
                        to={`/prompts/${p.id}`}
                        className="font-semibold text-slate-900 text-sm hover:text-indigo-600 truncate block mt-1"
                      >
                        {p.title}
                      </Link>

                      <p className="font-mono text-slate-400 text-xs truncate">/{p.slug}</p>
                    </div>
                  </div>

                  {/* Categories tag pills */}
                  {p.categoryObjects && p.categoryObjects.length > 0 && (
                    <div className="flex flex-wrap gap-1 text-[10px]">
                      {p.categoryObjects.map((c) => (
                        <span key={c.id} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                          {c.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Mobile Actions */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-50">
                    <Link
                      to={`/prompts/${p.id}`}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 inline-flex items-center gap-1"
                    >
                      {isViewer ? <Eye className="w-3.5 h-3.5" /> : <Edit className="w-3.5 h-3.5" />}
                      <span>{isViewer ? 'View' : 'Edit'}</span>
                    </Link>

                    {canPublish && p.status !== 'published' && (
                      <button
                        onClick={() => handleQuickPublish(p)}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Publish</span>
                      </button>
                    )}

                    {canPublish && (
                      <button
                        onClick={() => setDeleteTarget(p)}
                        className="px-3 py-1.5 border border-rose-200 text-rose-600 rounded-lg text-xs font-semibold hover:bg-rose-50 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Server-Paginated Footer */}
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalCount}
            pageSize={10}
            onPageChange={(newPage) => setPage(newPage)}
          />
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Delete Prompt"
        message={`Are you sure you want to permanently delete "${deleteTarget?.title}"? This action cannot be undone and will permanently remove this prompt and its associated media.`}
        confirmText="Delete Prompt"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

