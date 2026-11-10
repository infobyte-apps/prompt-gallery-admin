import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, CheckCircle2, FileEdit, Archive, Image as ImageIcon, 
  Video as VideoIcon, Layers, Plus, BookmarkCheck, ArrowRight, RefreshCw 
} from 'lucide-react';
import { api } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useAuth } from '../context/AuthContext';

export function DashboardPage() {
  const { canEditDrafts, canManageTaxonomy } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.dashboard.getStats();
      setStats(data);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return <LoadingSpinner size="lg" message="Loading editorial metrics..." />;
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-sm space-y-3">
        <p className="font-semibold">Error retrieving dashboard counts</p>
        <p>{error}</p>
        <button
          onClick={fetchStats}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Quick Action Shortcuts */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Editorial Dashboard</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Real-time catalog distribution and recent prompt updates
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canEditDrafts && (
            <Link
              to="/prompts/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New Prompt</span>
            </Link>
          )}

          {canManageTaxonomy && (
            <Link
              to="/collections"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium shadow-2xs transition-colors"
            >
              <BookmarkCheck className="w-4 h-4 text-indigo-600" />
              <span>Manage Featured</span>
            </Link>
          )}
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Prompts */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Catalog</span>
            <FileText className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900">{stats?.total || 0}</p>
          <p className="text-[11px] text-slate-400">All registered prompts</p>
        </div>

        {/* Published */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Published</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-700">{stats?.published || 0}</p>
          <p className="text-[11px] text-slate-400">Publicly visible on mobile</p>
        </div>

        {/* Drafts */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-amber-600">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Drafts</span>
            <FileEdit className="w-4 h-4" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-amber-700">{stats?.draft || 0}</p>
          <p className="text-[11px] text-slate-400">In staging / review</p>
        </div>

        {/* Archived */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Archived</span>
            <Archive className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-700">{stats?.archived || 0}</p>
          <p className="text-[11px] text-slate-400">Hidden from public joins</p>
        </div>
      </div>

      {/* Secondary Metrics: Media Types & Taxonomies */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Images vs Videos</span>
            <div className="flex items-center gap-3 text-sm font-semibold text-slate-800">
              <span className="inline-flex items-center gap-1 text-indigo-700">
                <ImageIcon className="w-4 h-4" /> {stats?.imageCount || 0} Images
              </span>
              <span className="text-slate-300">•</span>
              <span className="inline-flex items-center gap-1 text-violet-700">
                <VideoIcon className="w-4 h-4" /> {stats?.videoCount || 0} Videos
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Categories</span>
            <p className="text-sm font-semibold text-slate-800">
              {stats?.activeCategoryCount || 0} active / {stats?.categoryCount || 0} total
            </p>
          </div>
          <Layers className="w-5 h-5 text-indigo-500" />
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Curated Collections</span>
            <p className="text-sm font-semibold text-slate-800">
              {stats?.collectionCount || 0} collections configured
            </p>
          </div>
          <BookmarkCheck className="w-5 h-5 text-indigo-500" />
        </div>
      </div>

      {/* Recent Edits Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Recent Prompt Edits</h2>
            <p className="text-xs text-slate-500">Most recently modified prompts in the catalog</p>
          </div>

          <Link
            to="/prompts"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="divide-y divide-slate-100 overflow-x-auto">
          {stats?.recentEdits?.length === 0 ? (
            <p className="p-6 text-center text-xs text-slate-500">No prompt edits found yet.</p>
          ) : (
            stats?.recentEdits?.map((prompt) => (
              <div
                key={prompt.id}
                className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                    {prompt.cover_thumb ? (
                      <img
                        src={prompt.cover_thumb}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-slate-400" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <Link
                      to={`/prompts/${prompt.id}`}
                      className="text-xs sm:text-sm font-semibold text-slate-900 hover:text-indigo-600 truncate block"
                    >
                      {prompt.title}
                    </Link>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                      <span className="font-mono text-slate-400 truncate max-w-[150px] sm:max-w-[200px]">
                        /{prompt.slug}
                      </span>
                      <span>•</span>
                      <span className="capitalize">{prompt.media_type}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={prompt.status} size="sm" />
                  <span className="text-[11px] text-slate-400 hidden sm:inline">
                    {new Date(prompt.updated_at).toLocaleDateString()}
                  </span>
                  <Link
                    to={`/prompts/${prompt.id}`}
                    className="p-1.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100"
                    title="Edit prompt"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

