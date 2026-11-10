import React, { useState, useEffect } from 'react';
import { 
  BookmarkCheck, Plus, Sparkles, TrendingUp, MoveUp, MoveDown, 
  Trash2, Image as ImageIcon, ExternalLink, Check, Layers, RefreshCw 
} from 'lucide-react';
import { api } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

export function CollectionsPage() {
  const { canManageTaxonomy } = useAuth();
  const notify = useNotification();

  const [collections, setCollections] = useState([]);
  const [promptsList, setPromptsList] = useState([]);
  const [activeCollectionId, setActiveCollectionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add Prompt Modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState('');
  const [selectedMediaId, setSelectedMediaId] = useState('');
  const [promptDetailForModal, setPromptDetailForModal] = useState(null);

  const fetchCollections = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cols, promptRes] = await Promise.all([
        api.collections.list(),
        api.prompts.list({ limit: 50, status: 'published' }), // only published prompts in collections
      ]);
      setCollections(cols);
      setPromptsList(promptRes.data);
      if (cols.length > 0 && !activeCollectionId) {
        setActiveCollectionId(cols[0].id);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch collections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  const activeCollection = collections.find((c) => c.id === activeCollectionId) || collections[0] || null;

  // When prompt is chosen in Add Modal, load its media samples so operator can select specific sample or cover fallback
  useEffect(() => {
    if (!selectedPromptId) {
      setPromptDetailForModal(null);
      setSelectedMediaId('');
      return;
    }
    async function loadPromptDetails() {
      try {
        const details = await api.prompts.getById(selectedPromptId);
        setPromptDetailForModal(details);
        setSelectedMediaId(details?.cover_media_id || '');
      } catch (err) {
        console.error('Failed to load prompt media options', err);
      }
    }
    loadPromptDetails();
  }, [selectedPromptId]);

  const handleAddPromptToCollection = async (e) => {
    e.preventDefault();
    if (!selectedPromptId || !activeCollection) return;

    try {
      await api.collections.addPrompt(
        activeCollection.id,
        selectedPromptId,
        selectedMediaId || null
      );
      notify.success('Prompt added to collection');
      setAddModalOpen(false);
      setSelectedPromptId('');
      setSelectedMediaId('');
      fetchCollections();
    } catch (err) {
      notify.error(err.message || 'Failed to add prompt');
    }
  };

  const handleRemovePrompt = async (promptId) => {
    if (!activeCollection) return;
    try {
      await api.collections.removePrompt(activeCollection.id, promptId);
      notify.info('Prompt removed from collection');
      fetchCollections();
    } catch (err) {
      notify.error(err.message || 'Failed to remove prompt');
    }
  };

  const handleMoveItem = async (index, direction) => {
    if (!activeCollection || !activeCollection.items) return;
    const items = [...activeCollection.items];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const temp = items[index];
    items[index] = items[targetIndex];
    items[targetIndex] = temp;

    const orderedIds = items.map((i) => i.id);
    try {
      await api.collections.updateOrder(activeCollection.id, orderedIds);
      fetchCollections();
    } catch (err) {
      notify.error('Failed to update order');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Collections Curation</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Curate Featured and Trending hero carousels for the mobile app home screen.
          </p>
        </div>

        {canManageTaxonomy && (
          <button
            onClick={() => setAddModalOpen(true)}
            disabled={!activeCollection}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Add Prompt to {activeCollection?.title || 'Collection'}</span>
          </button>
        )}
      </div>

      {loading ? (
        <LoadingSpinner message="Loading collections..." />
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-sm space-y-3">
          <p className="font-semibold">Unable to fetch collections</p>
          <p>{error}</p>
          <button
            onClick={fetchCollections}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Collection Tab Selector (Left: 4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              System & Curated Feeds
            </h3>

            <div className="space-y-2">
              {collections.map((col) => {
                const isSelected = col.id === activeCollection?.id;
                const isFeatured = col.slug === 'featured';
                const isTrending = col.slug === 'trending';

                return (
                  <button
                    key={col.id}
                    onClick={() => setActiveCollectionId(col.id)}
                    className={`w-full p-4 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-white border-indigo-600 shadow-sm ring-1 ring-indigo-600/20'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                          isFeatured
                            ? 'bg-amber-100 text-amber-700'
                            : isTrending
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {isFeatured ? (
                          <Sparkles className="w-5 h-5" />
                        ) : isTrending ? (
                          <TrendingUp className="w-5 h-5" />
                        ) : (
                          <BookmarkCheck className="w-5 h-5" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-sm truncate">{col.title}</p>
                        <p className="font-mono text-slate-400 text-xs">#{col.slug}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                        {col.itemCount || 0} items
                      </span>
                    </div>
                  </button>
                );
              })}

              {/* Dynamic New Prompts info card */}
              <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 text-xs text-slate-500 space-y-1">
                <p className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  Dynamic "New Prompts" Feed
                </p>
                <p>
                  As mandated by the SRS, the <strong>New Prompts</strong> carousel is computed dynamically based on each prompt's immutable <code>published_at</code> timestamp.
                </p>
              </div>
            </div>
          </div>

          {/* Collection Items Management (Right: 8 cols) */}
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {activeCollection ? activeCollection.title : 'Collection Items'}
                </h2>
                <p className="text-xs text-slate-500">
                  Reorder cards or select alternate sample hero images for this carousel
                </p>
              </div>

              <StatusBadge status={activeCollection?.status || 'published'} />
            </div>

            <div className="divide-y divide-slate-100">
              {!activeCollection?.items || activeCollection.items.length === 0 ? (
                <div className="p-10 text-center text-slate-500 text-xs space-y-3">
                  <Layers className="w-8 h-8 text-slate-300 mx-auto" />
                  <p>No prompts in this collection yet.</p>
                  {canManageTaxonomy && (
                    <button
                      onClick={() => setAddModalOpen(true)}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-medium inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add First Prompt
                    </button>
                  )}
                </div>
              ) : (
                activeCollection.items.map((item, index) => {
                  const prompt = item.prompt;
                  const thumb = item.media?.thumbnail_path || item.media?.preview_path || item.media?.image_url || item.media?.storage_path;

                  return (
                    <div
                      key={item.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Order rank indicator */}
                        <span className="w-6 text-center font-bold text-slate-400 text-xs">
                          #{index + 1}
                        </span>

                        {/* Thumbnail */}
                        <div className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                          {thumb ? (
                            <img src={thumb} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="w-6 h-6 text-slate-400" />
                          )}
                        </div>

                        {/* Prompt details */}
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 text-sm truncate">
                            {prompt?.title || 'Unknown prompt'}
                          </p>
                          <p className="text-xs text-slate-400 font-mono truncate">
                            /{prompt?.slug}
                          </p>
                          <p className="text-[11px] text-indigo-600 font-medium mt-0.5">
                            {item.media_id ? 'Custom selected sample' : 'Fallback: Default prompt cover'}
                          </p>
                        </div>
                      </div>

                      {/* Reorder and Remove Actions */}
                      {canManageTaxonomy && (
                        <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMoveItem(index, -1)}
                            disabled={index === 0}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            title="Move Up"
                          >
                            <MoveUp className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleMoveItem(index, 1)}
                            disabled={index === activeCollection.items.length - 1}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            title="Move Down"
                          >
                            <MoveDown className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemovePrompt(item.prompt_id)}
                            className="p-1.5 rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title="Remove from collection"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Prompt to Collection Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setAddModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Add Prompt to "{activeCollection?.title}"
            </h3>

            <form onSubmit={handleAddPromptToCollection} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Select Published Prompt
                </label>
                <select
                  required
                  value={selectedPromptId}
                  onChange={(e) => setSelectedPromptId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Choose a published prompt --</option>
                  {promptsList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.media_type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Sample picker for hero card (optional - falls back to cover) */}
              {promptDetailForModal && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Display Sample Media (Nullable: falls back to Cover)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {promptDetailForModal.media?.map((m) => {
                      const isSelected = selectedMediaId === m.id;
                      const isCover = promptDetailForModal.cover_media_id === m.id;

                      return (
                        <div
                          key={m.id}
                          onClick={() => setSelectedMediaId(m.id)}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer ${
                            isSelected ? 'border-indigo-600 ring-2 ring-indigo-600/30' : 'border-slate-200'
                          }`}
                        >
                          <img
                            src={m.thumbnail_path || m.storage_path}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          {isCover && (
                            <span className="absolute bottom-1 left-1 bg-slate-900/80 text-white text-[9px] px-1 rounded font-bold">
                              COVER
                            </span>
                          )}
                          {isSelected && (
                            <div className="absolute top-1 right-1 bg-indigo-600 text-white p-0.5 rounded-full">
                              <Check className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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
                  disabled={!selectedPromptId}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  Add to Collection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

