import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Save, CheckCircle2, Archive, AlertCircle, Copy, Check, 
  ExternalLink, Sparkles, Image as ImageIcon, Video as VideoIcon, RefreshCw, Eye 
} from 'lucide-react';
import { api } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { MediaUpload } from '../components/common/MediaUpload';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { VIDEO_PUBLISHING_ENABLED } from '../lib/supabaseClient';

export function PromptEditorPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { canEditDrafts, canPublish, isViewer } = useAuth();
  const notify = useNotification();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Archive modal
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);

  // Form Fields
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [promptText, setPromptText] = useState('');
  const [mediaType, setMediaType] = useState('image');
  const [status, setStatus] = useState('draft');
  const [coverMediaId, setCoverMediaId] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [mediaItems, setMediaItems] = useState([]);
  const [publishedAt, setPublishedAt] = useState(null);
  const [originalUpdatedAt, setOriginalUpdatedAt] = useState(null);

  // Lookup options
  const [availableCategories, setAvailableCategories] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);

  // Field errors
  const [errors, setErrors] = useState({});

  // Active preview sample index for the preview card
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);

  // Warn on unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  // Load taxonomy options
  useEffect(() => {
    async function loadOptions() {
      try {
        const [cats, tags] = await Promise.all([
          api.categories.list(),
          api.tags.list(),
        ]);
        setAvailableCategories(cats);
        setAvailableTags(tags);
      } catch (err) {
        console.error('Failed to load categories/tags', err);
      }
    }
    loadOptions();
  }, []);

  // Load existing prompt
  useEffect(() => {
    if (isNew) return;

    async function loadPrompt() {
      setLoading(true);
      try {
        const data = await api.prompts.getById(id);
        if (!data) {
          notify.error('Prompt not found');
          navigate('/prompts');
          return;
        }

        setTitle(data.title || '');
        setSlug(data.slug || '');
        setPromptText(data.prompt_text || '');
        setMediaType(data.media_type || 'image');
        setStatus(data.status || 'draft');
        setCoverMediaId(data.cover_media_id || null);
        setSelectedCategories(data.categories || []);
        setSelectedTags(data.tags || []);
        setMediaItems(data.media || []);
        setPublishedAt(data.published_at || null);
        setOriginalUpdatedAt(data.updated_at || null);
        setDirty(false);
      } catch (err) {
        notify.error(err.message || 'Error loading prompt details');
      } finally {
        setLoading(false);
      }
    }
    loadPrompt();
  }, [id, isNew, navigate, notify]);

  // Slug generator helper
  const generateSlug = (val) => {
    return val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  };

  const handleTitleChange = (e) => {
    const val = e.target.value;
    setTitle(val);
    setDirty(true);
    // Auto-generate slug if new or matching previous
    if (isNew || !slug || slug === generateSlug(title)) {
      setSlug(generateSlug(val));
    }
  };

  const handleCategoryToggle = (catId) => {
    if (isViewer) return;
    setDirty(true);
    setSelectedCategories((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    );
  };

  const handleTagToggle = (tagId) => {
    if (isViewer) return;
    setDirty(true);
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  // Media operations
  const handleAddMedia = async (mediaItem) => {
    setDirty(true);
    if (!isNew && id) {
      // Direct API insert if prompt already saved
      const saved = await api.prompts.addMedia(id, mediaItem);
      setMediaItems((prev) => [...prev, saved]);
      if (!coverMediaId) {
        setCoverMediaId(saved.id);
      }
    } else {
      // Staged in form with valid RFC4122 UUID and staging flag
      const stagedId = crypto.randomUUID();
      const stagedItem = {
        ...mediaItem,
        id: stagedId,
        _staged: true,
      };
      setMediaItems((prev) => [...prev, stagedItem]);
      if (!coverMediaId) {
        setCoverMediaId(stagedId);
      }
    }
  };

  const handleUpdateMedia = async (mediaId, updates) => {
    setDirty(true);
    setMediaItems((prev) =>
      prev.map((m) => (m.id === mediaId ? { ...m, ...updates } : m))
    );
    const item = mediaItems.find((m) => m.id === mediaId);
    if (!isNew && id && item && !item._staged) {
      await api.prompts.updateMedia(mediaId, updates);
    }
  };

  const handleDeleteMedia = async (mediaId) => {
    if (status === 'published' && mediaId === coverMediaId) {
      const remaining = mediaItems.filter((m) => m.id !== mediaId);
      if (remaining.length === 0) {
        notify.error('Cannot remove the last valid cover from a published prompt');
        return;
      }
    }

    setDirty(true);
    const remaining = mediaItems.filter((m) => m.id !== mediaId);
    setMediaItems(remaining);

    const newCover = coverMediaId === mediaId ? (remaining[0]?.id || null) : coverMediaId;
    if (coverMediaId === mediaId) {
      setCoverMediaId(newCover);
    }

    const item = mediaItems.find((m) => m.id === mediaId);
    if (!isNew && id && item && !item._staged) {
      await api.prompts.deleteMedia(id, mediaId, newCover);
    }
  };

  const handleSetCover = (mediaId) => {
    setDirty(true);
    setCoverMediaId(mediaId);
  };

  const handleReorderMedia = (newOrderedList) => {
    setDirty(true);
    setMediaItems(newOrderedList);
  };

  // Validation
  const validateForm = (targetStatus) => {
    const newErrors = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }
    if (!slug.trim()) {
      newErrors.slug = 'Slug is required';
    }
    if (!promptText.trim()) {
      newErrors.promptText = 'Prompt generation instructions are required';
    }

    if (targetStatus === 'published') {
      if (mediaItems.length === 0) {
        newErrors.cover = 'A published prompt must have at least one media asset and an assigned cover';
      }

      if (mediaType === 'video') {
        const coverMedia = mediaItems.find((m) => m.id === coverMediaId) || mediaItems[0];
        if (!coverMedia?.duration_ms || coverMedia.duration_ms <= 0) {
          newErrors.video = 'Published video prompt requires valid positive duration';
        }
        if (!coverMedia?.preview_path) {
          newErrors.video = 'Published video prompt requires poster/preview image path';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Save handler (Draft or Published)
  const handleSave = async (targetStatus) => {
    if (isViewer) {
      notify.error('Viewer role has read-only access');
      return;
    }

    // Role check: Editor cannot publish or save live updates to published items!
    if (targetStatus === 'published' && !canPublish) {
      notify.error('Permission Denied: Editor role cannot publish content. Save as Draft instead.');
      return;
    }
    if (status === 'published' && !canPublish) {
      notify.error('Permission Denied: Editor role cannot modify live published content.');
      return;
    }

    if (!validateForm(targetStatus)) {
      notify.error('Please fix validation errors before saving');
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        // Step 1: Create prompt as draft with cover_media_id: null to satisfy FK constraints
        const initialPayload = {
          title: title.trim(),
          slug: slug.trim(),
          prompt_text: promptText.trim(),
          media_type: mediaType,
          status: 'draft',
          cover_media_id: null,
          categories: selectedCategories,
          tags: selectedTags,
        };

        const savedPrompt = await api.prompts.save(initialPayload);
        let realCoverId = null;

        // Step 2: Upload and insert all media items
        if (mediaItems.length > 0) {
          for (let i = 0; i < mediaItems.length; i++) {
            const item = mediaItems[i];
            const isSelectedAsCover = (item.id === coverMediaId) || (i === 0 && !realCoverId);
            const savedMedia = await api.prompts.addMedia(savedPrompt.id, item);
            if (isSelectedAsCover || !realCoverId) {
              realCoverId = savedMedia.id;
            }
          }
        }

        // Step 3: Update the prompt with the real cover media UUID and target status (draft or published)
        if (realCoverId || targetStatus === 'published') {
          await api.prompts.save({
            id: savedPrompt.id,
            cover_media_id: realCoverId,
            status: targetStatus,
          });
        }

        setDirty(false);
        notify.success(
          targetStatus === 'published'
            ? 'Prompt published live to the public gallery!'
            : 'Prompt draft saved successfully.'
        );

        navigate(`/prompts/${savedPrompt.id}`, { replace: true });
      } else {
        // Updating existing prompt
        let activeCover = coverMediaId;
        const updatedMediaList = [];

        // Save any newly added/staged media
        for (const item of mediaItems) {
          if (item._staged) {
            const savedMedia = await api.prompts.addMedia(id, item);
            updatedMediaList.push(savedMedia);
            if (item.id === activeCover) {
              activeCover = savedMedia.id;
            }
          } else {
            updatedMediaList.push(item);
          }
        }

        // Validate cover ID exists in media list, fallback to first item if available
        const hasValidCover = updatedMediaList.some((m) => m.id === activeCover);
        const resolvedCoverId = hasValidCover ? activeCover : (updatedMediaList[0]?.id || null);

        const payload = {
          id,
          title: title.trim(),
          slug: slug.trim(),
          prompt_text: promptText.trim(),
          media_type: mediaType,
          status: targetStatus,
          cover_media_id: resolvedCoverId,
          categories: selectedCategories,
          tags: selectedTags,
          original_updated_at: originalUpdatedAt,
        };

        const updated = await api.prompts.save(payload);
        setDirty(false);
        setStatus(targetStatus);
        setCoverMediaId(resolvedCoverId);
        setMediaItems(updatedMediaList);
        setOriginalUpdatedAt(updated.updated_at);
        notify.success(
          targetStatus === 'published'
            ? 'Live prompt updated successfully!'
            : 'Prompt draft saved successfully.'
        );
      }
    } catch (err) {
      notify.error(err.message || 'Failed to save prompt');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!canPublish) {
      notify.error('Only Publishers and Super Admins can archive content');
      return;
    }

    setSaving(true);
    try {
      await api.prompts.archive(id);
      setStatus('archived');
      setShowArchiveDialog(false);
      setDirty(false);
      notify.info('Prompt has been archived and hidden from public feeds');
    } catch (err) {
      notify.error(err.message || 'Archive failed');
    } finally {
      setSaving(false);
    }
  };

  const copyPromptText = () => {
    navigator.clipboard.writeText(promptText);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  if (loading) {
    return <LoadingSpinner size="lg" message="Loading prompt editor..." />;
  }

  const activeMedia = mediaItems[activePreviewIndex] || mediaItems[0] || null;

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumbs action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            to="/prompts"
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
            title="Return to Prompts catalog"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 truncate max-w-sm sm:max-w-md">
                {isNew ? 'Create New Prompt' : title || 'Edit Prompt'}
              </h1>
              <StatusBadge status={status} />
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              {slug ? `/${slug}` : 'Generating unique slug...'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {dirty && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200 font-medium animate-pulse">
              Unsaved changes
            </span>
          )}

          {/* Save Draft */}
          {canEditDrafts && (
            <button
              type="button"
              onClick={() => handleSave('draft')}
              disabled={saving}
              className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold shadow-2xs transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4 text-slate-500" />
              <span>Save Draft</span>
            </button>
          )}

          {/* Live Update or Publish (Publishers & Super Admins only) */}
          {canPublish && (
            <button
              type="button"
              onClick={() => handleSave('published')}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{status === 'published' ? 'Save Live Update' : 'Publish to Gallery'}</span>
            </button>
          )}

          {/* Archive Action */}
          {canPublish && !isNew && status === 'published' && (
            <button
              type="button"
              onClick={() => setShowArchiveDialog(true)}
              className="px-3 py-2 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold cursor-pointer"
            >
              <Archive className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Two-Column Editorial Layout (Left: Content form, Right: Status & Live Preview) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form: 7 cols on lg */}
        <div className="lg:col-span-7 space-y-6">
          {/* Main Content Card */}
          <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-2xs space-y-5">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider text-[11px] text-slate-400">
              Basic Information
            </h3>

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Prompt Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                disabled={isViewer}
                value={title}
                onChange={handleTitleChange}
                placeholder="e.g. Cinematic Nordic Architecture Villa"
                className={`w-full px-3.5 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 disabled:bg-slate-50 ${
                  errors.title ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-300 focus:ring-indigo-500'
                }`}
              />
              {errors.title && <p className="text-xs text-rose-600 mt-1">{errors.title}</p>}
            </div>

            {/* Slug */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Normalized Unique Slug <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center">
                <span className="px-3 py-2.5 bg-slate-100 border border-r-0 border-slate-300 rounded-l-lg text-slate-500 text-xs font-mono">
                  /prompts/
                </span>
                <input
                  type="text"
                  disabled={isViewer}
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setDirty(true);
                  }}
                  placeholder="cinematic-nordic-architecture"
                  className={`flex-1 px-3.5 py-2.5 rounded-r-lg border font-mono text-xs focus:outline-none focus:ring-2 disabled:bg-slate-50 ${
                    errors.slug ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-300 focus:ring-indigo-500'
                  }`}
                />
              </div>
              {errors.slug && <p className="text-xs text-rose-600 mt-1">{errors.slug}</p>}
            </div>

            {/* Full Prompt Text */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Full AI Prompt Instruction <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={copyPromptText}
                  className="text-xs text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1 font-medium cursor-pointer"
                >
                  {copiedPrompt ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPrompt ? 'Copied' : 'Copy Text'}</span>
                </button>
              </div>
              <textarea
                rows={5}
                disabled={isViewer}
                value={promptText}
                onChange={(e) => {
                  setPromptText(e.target.value);
                  setDirty(true);
                }}
                placeholder="Paste complete generation prompt including model flags, aspect ratio and parameters (e.g. Futuristic glass dwelling surrounded by pine forest, cinematic 8k --ar 16:9)..."
                className={`w-full px-3.5 py-2.5 rounded-lg border text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 disabled:bg-slate-50 ${
                  errors.promptText ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-300 focus:ring-indigo-500'
                }`}
              />
              {errors.promptText && <p className="text-xs text-rose-600 mt-1">{errors.promptText}</p>}
              <p className="text-[11px] text-slate-400 mt-1">
                SRS rule: Mobile carousel displays short preview; full prompt text is fetched on demand when copied.
              </p>
            </div>

            {/* Media Type Toggle */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Catalog Media Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={isViewer || mediaItems.length > 0}
                  onClick={() => {
                    setMediaType('image');
                    setDirty(true);
                  }}
                  className={`p-3 rounded-lg border flex items-center justify-center gap-2 text-xs font-semibold transition-all cursor-pointer ${
                    mediaType === 'image'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>Image Prompt</span>
                </button>

                <button
                  type="button"
                  disabled={isViewer || mediaItems.length > 0}
                  onClick={() => {
                    setMediaType('video');
                    setDirty(true);
                  }}
                  className={`p-3 rounded-lg border flex items-center justify-center gap-2 text-xs font-semibold transition-all cursor-pointer ${
                    mediaType === 'video'
                      ? 'border-violet-600 bg-violet-50 text-violet-700 shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  <VideoIcon className="w-4 h-4" />
                  <span>Video Prompt</span>
                </button>
              </div>
              {mediaItems.length > 0 && (
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Media type locked while media samples are attached. Remove samples first to switch format.
                </p>
              )}
            </div>
          </div>

          {/* Media Manager Card */}
          <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <MediaUpload
              media={mediaItems}
              coverMediaId={coverMediaId}
              mediaType={mediaType}
              onAddMedia={handleAddMedia}
              onUpdateMedia={handleUpdateMedia}
              onDeleteMedia={handleDeleteMedia}
              onSetCover={handleSetCover}
              onReorderMedia={handleReorderMedia}
              readOnly={isViewer}
            />
            {errors.cover && <p className="text-xs text-rose-600">{errors.cover}</p>}
            {errors.video && <p className="text-xs text-rose-600">{errors.video}</p>}
          </div>

          {/* Taxonomies: Categories & Tags */}
          <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-2xs space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Categories</h3>
              <p className="text-xs text-slate-500 mb-3">Select one or more categories for mobile navigation</p>
              <div className="flex flex-wrap gap-2">
                {availableCategories.map((cat) => {
                  const isSelected = selectedCategories.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      disabled={isViewer}
                      onClick={() => handleCategoryToggle(cat.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Tags & Keywords</h3>
              <p className="text-xs text-slate-500 mb-3">Filterable tags to enhance searchability</p>
              <div className="flex flex-wrap gap-1.5">
                {availableTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      disabled={isViewer}
                      onClick={() => handleTagToggle(tag.id)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      #{tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: 5 cols on lg (Status Details & Mobile Preview Card) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Status & Lifecycle Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Publishing Lifecycle
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Current Status:</span>
                <StatusBadge status={status} />
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">First Published:</span>
                <span className="font-medium text-slate-800">
                  {publishedAt ? new Date(publishedAt).toLocaleString() : 'Not published yet'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Concurrency Check:</span>
                <span className="font-mono text-[11px] text-slate-400">
                  {originalUpdatedAt ? new Date(originalUpdatedAt).toLocaleTimeString() : 'New'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500">Cover Assigned:</span>
                <span className="font-medium text-slate-800">
                  {coverMediaId ? 'Yes' : 'Missing (Required for publish)'}
                </span>
              </div>
            </div>

            {/* Permission explanation note */}
            {!canPublish && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs">
                <p className="font-semibold">Editor Role Access:</p>
                <p className="mt-0.5">
                  You can edit drafts and stage samples. Publishing and live updates require Publisher or Super Admin permissions.
                </p>
              </div>
            )}
          </div>

          {/* Live Mobile Card Preview */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-indigo-600" />
                Mobile Catalog Preview
              </h3>
              <span className="text-[10px] text-slate-400">Card View @ 360px</span>
            </div>

            {/* Mock Mobile Prompt Card */}
            <div className="w-full max-w-[340px] mx-auto bg-slate-900 rounded-2xl overflow-hidden shadow-xl border border-slate-800 text-white flex flex-col">
              {/* Media Preview Box */}
              <div className="relative aspect-4/3 w-full bg-slate-950 flex items-center justify-center overflow-hidden">
                {activeMedia ? (
                  <img
                    src={activeMedia.preview_path || activeMedia.image_url || activeMedia.storage_path || activeMedia.thumbnail_path}
                    alt={activeMedia.alt_text || 'Prompt sample preview'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://placehold.co/600x450/1e293b/94a3b8?text=Image+Preview+Unavailable';
                    }}
                  />
                ) : (
                  <div className="text-center p-6 text-slate-500">
                    <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">No media uploaded</p>
                  </div>
                )}

                {/* Badge overlay */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <span className="bg-slate-900/80 backdrop-blur-xs text-[10px] font-bold px-2 py-0.5 rounded text-white capitalize">
                    {mediaType}
                  </span>
                </div>

                {/* Sample selector dots */}
                {mediaItems.length > 1 && (
                  <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1.5">
                    {mediaItems.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setActivePreviewIndex(i)}
                        className={`w-2 h-2 rounded-full transition-all ${
                          i === activePreviewIndex ? 'bg-white w-4' : 'bg-white/40'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Card Body */}
              <div className="p-4 space-y-2.5">
                <h4 className="font-bold text-sm text-slate-100 line-clamp-1">
                  {title || 'Prompt Title Placeholder'}
                </h4>

                {/* SRS Requirement: Show the actual matching prompt under the active sample */}
                <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                    <span>Active Sample Prompt Text</span>
                    <span>Sample #{activePreviewIndex + 1}</span>
                  </div>
                  <p className="text-xs text-slate-300 font-mono line-clamp-3 leading-relaxed">
                    {promptText || 'No prompt text specified yet...'}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-slate-400">
                    {mediaItems.length} sample{mediaItems.length !== 1 ? 's' : ''}
                  </span>

                  <button
                    type="button"
                    onClick={copyPromptText}
                    className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy Prompt</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Archive Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showArchiveDialog}
        title="Archive Prompt"
        message="Are you sure you want to archive this prompt? It will immediately disappear from mobile feeds and collection joins."
        confirmText="Archive Prompt"
        isDestructive={true}
        onConfirm={handleArchive}
        onCancel={() => setShowArchiveDialog(false)}
      />
    </div>
  );
}

