import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Save,
  Send,
  RotateCcw,
  Eye,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  ShieldCheck,
  Globe,
  Mail,
  Share2,
  Sliders,
  Wrench,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  X,
  Radio,
  Layers,
  Sparkles,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { api } from '../services/api';
import { ImageInputTabs } from '../components/common/ImageInputTabs';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export function MobileAppSettingsPage() {
  const { isSuperAdmin, userRole } = useAuth();
  const notify = useNotification();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Settings State from DB
  const [version, setVersion] = useState(1);
  const [publishedAt, setPublishedAt] = useState(null);
  const [hasPreviousSnapshot, setHasPreviousSnapshot] = useState(false);
  const [publishedConfig, setPublishedConfig] = useState(null);
  const [form, setForm] = useState(null);

  // UI state
  const [activeTab, setActiveTab] = useState('links');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewDeviceTab, setPreviewDeviceTab] = useState('home');
  const [confirmDialog, setConfirmDialog] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await api.mobileSettings.get();
      if (data) {
        setVersion(data.version || 1);
        setPublishedAt(data.published_at);
        setHasPreviousSnapshot(Boolean(data.previous_published_config));
        setPublishedConfig(data.published_config);
        // If user is super_admin, load draft_config for editing; otherwise display published_config
        const initialForm = isSuperAdmin ? data.draft_config : data.published_config;
        setForm(JSON.parse(JSON.stringify(initialForm || {})));
      }
    } catch (err) {
      notify.error(`Failed to load mobile settings: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const hasUnpublishedChanges = () => {
    if (!form || !publishedConfig) return false;
    return JSON.stringify(form) !== JSON.stringify(publishedConfig);
  };

  // Helper: Deep immutable update for form fields
  const updateField = (path, value) => {
    if (!isSuperAdmin) return;
    setForm((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let cur = copy;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!cur[keys[i]]) cur[keys[i]] = {};
        cur = cur[keys[i]];
      }
      cur[keys[keys.length - 1]] = value;
      return copy;
    });
  };

  // Section 1: Social Links Handlers
  const handleAddSocialLink = () => {
    if (!isSuperAdmin) return;
    const current = form.links_support?.social_links || [];
    const newId = `social_${Date.now()}`;
    const updated = [...current, { id: newId, label: 'New Social Link', url: '', is_visible: true }];
    updateField('links_support.social_links', updated);
  };

  const handleRemoveSocialLink = (index) => {
    if (!isSuperAdmin) return;
    const current = [...(form.links_support?.social_links || [])];
    current.splice(index, 1);
    updateField('links_support.social_links', current);
  };

  const handleMoveSocialLink = (index, direction) => {
    if (!isSuperAdmin) return;
    const current = [...(form.links_support?.social_links || [])];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= current.length) return;
    const temp = current[index];
    current[index] = current[targetIdx];
    current[targetIdx] = temp;
    updateField('links_support.social_links', current);
  };

  // Section 2: Home Sections Handlers
  const handleMoveHomeSection = (index, direction) => {
    if (!isSuperAdmin) return;
    const current = [...(form.home_discover?.sections || [])];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= current.length) return;
    const temp = current[index];
    current[index] = current[targetIdx];
    current[targetIdx] = temp;
    // update order numbers
    current.forEach((sec, idx) => {
      sec.order = idx + 1;
    });
    updateField('home_discover.sections', current);
  };

  // Client Validation before save/publish
  const validateForm = () => {
    const email = form.links_support?.support_email;
    if (email && email.trim()) {
      const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
      if (!emailRegex.test(email.trim())) {
        throw new Error(`Invalid support email format: "${email}"`);
      }
    }

    const privacy = form.links_support?.privacy_policy_url;
    if (privacy && privacy.trim() && !privacy.trim().startsWith('https://')) {
      throw new Error('Privacy Policy URL must use secure HTTPS scheme');
    }

    const website = form.links_support?.website_url;
    if (website && website.trim() && !website.trim().startsWith('https://')) {
      throw new Error('Website URL must use secure HTTPS scheme');
    }

    const supportPage = form.links_support?.support_page_url;
    if (supportPage && supportPage.trim() && !supportPage.trim().startsWith('https://')) {
      throw new Error('Support Page URL must use secure HTTPS scheme');
    }

    const playStore = form.links_support?.play_store_url;
    if (playStore && playStore.trim() && !playStore.trim().startsWith('https://') && !playStore.trim().startsWith('market://')) {
      throw new Error('Play Store URL must use HTTPS or market:// scheme');
    }

    const bannerAction = form.app_experience?.banner?.action_url;
    if (bannerAction && bannerAction.trim() && !bannerAction.trim().startsWith('https://')) {
      throw new Error('Banner action link must use secure HTTPS scheme');
    }

    const isBlocking = Boolean(form.maintenance?.update_notice?.is_blocking);
    if (isBlocking && (!playStore || !playStore.trim())) {
      throw new Error('A blocking update requires a valid Play Store URL before publishing');
    }
  };

  // Actions
  const handleSaveDraft = async () => {
    if (!isSuperAdmin) return;
    try {
      validateForm();
    } catch (err) {
      notify.error(err.message);
      return;
    }

    setSaving(true);
    try {
      const res = await api.mobileSettings.saveDraft(form, version);
      notify.success('Mobile app settings draft saved successfully');
      setForm(res.draft_config);
    } catch (err) {
      notify.error(`Failed to save draft: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const executePublish = async () => {
    setPublishing(true);
    try {
      // First ensure draft is up to date
      await api.mobileSettings.saveDraft(form, version);
      const res = await api.mobileSettings.publish(version);
      notify.success(`Mobile app settings published successfully as v${res.version}`);
      setVersion(res.version);
      setPublishedAt(res.published_at);
      setPublishedConfig(res.published_config);
      setHasPreviousSnapshot(Boolean(res.previous_published_config));
      setForm(JSON.parse(JSON.stringify(res.draft_config)));
    } catch (err) {
      notify.error(`Publish failed: ${err.message}`);
    } finally {
      setPublishing(false);
    }
  };

  const handlePublishClick = () => {
    if (!isSuperAdmin) return;
    try {
      validateForm();
    } catch (err) {
      notify.error(err.message);
      return;
    }

    const isMaint = Boolean(form.maintenance?.is_enabled);
    const isBlocking = Boolean(form.maintenance?.update_notice?.is_blocking);

    if (isMaint || isBlocking) {
      setConfirmDialog({
        title: isMaint ? 'Publish Maintenance Mode?' : 'Publish Blocking Update?',
        message: isMaint
          ? 'Warning: Enabling Maintenance Mode will immediately present a blocking maintenance screen to all mobile users. Do you wish to proceed?'
          : `Warning: Enabling a Blocking Update will require mobile users with builds older than build #${form.maintenance?.update_notice?.min_build_number || 1} to update before using the app. Proceed?`,
        confirmLabel: 'Confirm & Publish',
        isDestructive: true,
        onConfirm: executePublish,
      });
      return;
    }

    executePublish();
  };

  const handleRestoreClick = () => {
    if (!isSuperAdmin) return;
    setConfirmDialog({
      title: 'Restore Previous Published Settings?',
      message: 'This will revert both the published configuration and draft to the previous snapshot, incrementing the version. Any unpublished changes will be replaced.',
      confirmLabel: 'Restore Previous Version',
      isDestructive: true,
      onConfirm: async () => {
        setRestoring(true);
        try {
          const res = await api.mobileSettings.restore(version);
          notify.success(`Settings restored to previous snapshot (now v${res.version})`);
          setVersion(res.version);
          setPublishedAt(res.published_at);
          setPublishedConfig(res.published_config);
          setForm(JSON.parse(JSON.stringify(res.published_config)));
        } catch (err) {
          notify.error(`Restore failed: ${err.message}`);
        } finally {
          setRestoring(false);
        }
      },
    });
  };

  if (loading || !form) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <LoadingSpinner size="lg" message="Loading Mobile App Settings..." />
      </div>
    );
  }

  const isReadOnly = !isSuperAdmin;
  const isChanged = hasUnpublishedChanges();

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs border border-indigo-100">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Mobile App Settings</h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  v{version}
                </span>
                {isChanged ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Unpublished Changes
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                    Published
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {publishedAt
                  ? `Last published on ${new Date(publishedAt).toLocaleString()}`
                  : 'Default system configuration'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold shadow-xs hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Eye className="w-4 h-4 text-slate-500" />
            <span>Preview in App</span>
          </button>

          {isSuperAdmin && (
            <>
              {hasPreviousSnapshot && (
                <button
                  type="button"
                  disabled={restoring || publishing}
                  onClick={handleRestoreClick}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                  title="Revert to previous published settings"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore</span>
                </button>
              )}

              <button
                type="button"
                disabled={saving || publishing}
                onClick={handleSaveDraft}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Draft'}</span>
              </button>

              <button
                type="button"
                disabled={publishing || saving}
                onClick={handlePublishClick}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold shadow-sm hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{publishing ? 'Publishing...' : 'Publish Settings'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Role Banner if not Super Admin */}
      {isReadOnly && (
        <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700 flex items-center gap-3">
          <Lock className="w-4 h-4 text-slate-500 shrink-0" />
          <span>
            <strong>Read-only view ({userRole}):</strong> You are inspecting the published mobile configuration. Only Super Admins can modify drafts, publish, or restore settings.
          </span>
        </div>
      )}

      {/* Section Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('links')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'links'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>1. Links & Support</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'home'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>2. Home & Discover</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('experience')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'experience'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>3. App Experience</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('maintenance')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'maintenance'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>4. Maintenance & Updates</span>
        </button>
      </div>

      {/* TAB 1: Links & Support */}
      {activeTab === 'links' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
            <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              <span>Official Links & Legal</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Privacy Policy URL <span className="text-rose-500">*</span>
                </label>
                <input
                  type="url"
                  disabled={isReadOnly}
                  value={form.links_support?.privacy_policy_url || ''}
                  onChange={(e) => updateField('links_support.privacy_policy_url', e.target.value)}
                  placeholder="https://example.com/privacy"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Mandatory HTTPS link required for app store release compliance. Opened in in-app webview.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Support Email
                </label>
                <input
                  type="email"
                  disabled={isReadOnly}
                  value={form.links_support?.support_email || ''}
                  onChange={(e) => updateField('links_support.support_email', e.target.value)}
                  placeholder="support@promptgallery.app"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Validated RFC email for user inquiries displayed in the More screen.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Website URL
                </label>
                <input
                  type="url"
                  disabled={isReadOnly}
                  value={form.links_support?.website_url || ''}
                  onChange={(e) => updateField('links_support.website_url', e.target.value)}
                  placeholder="https://promptgallery.app"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Optional Support Page URL
                </label>
                <input
                  type="url"
                  disabled={isReadOnly}
                  value={form.links_support?.support_page_url || ''}
                  onChange={(e) => updateField('links_support.support_page_url', e.target.value)}
                  placeholder="https://help.promptgallery.app"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Google Play Store URL
                </label>
                <input
                  type="url"
                  disabled={isReadOnly}
                  value={form.links_support?.play_store_url || ''}
                  onChange={(e) => updateField('links_support.play_store_url', e.target.value)}
                  placeholder="https://play.google.com/store/apps/details?id=com.promptgallery"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Used for "Rate App" CTA, update notices, and fallback for share links.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Share App URL
                </label>
                <input
                  type="url"
                  disabled={isReadOnly}
                  value={form.links_support?.share_url || ''}
                  onChange={(e) => updateField('links_support.share_url', e.target.value)}
                  placeholder="Leave empty to automatically fall back to Play Store URL"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Custom landing or referral URL. If left blank, falls back to the Google Play Store URL.
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Share Message
                </label>
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={form.links_support?.share_message || ''}
                  onChange={(e) => updateField('links_support.share_message', e.target.value)}
                  placeholder="Discover curated AI prompts on Prompt Gallery!"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Default text passed into Android's native share sheet.
                </p>
              </div>
            </div>
          </div>

          {/* Social Links List */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-indigo-600" />
                  <span>Social Links</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ordered social media links surfaced in the More screen.
                </p>
              </div>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={handleAddSocialLink}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Social Link</span>
                </button>
              )}
            </div>

            <div className="space-y-3">
              {(form.links_support?.social_links || []).map((soc, idx) => (
                <div
                  key={soc.id || idx}
                  className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50/50"
                >
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      disabled={isReadOnly || idx === 0}
                      onClick={() => handleMoveSocialLink(idx, -1)}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={isReadOnly || idx === (form.links_support.social_links.length - 1)}
                      onClick={() => handleMoveSocialLink(idx, 1)}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={soc.label || ''}
                      onChange={(e) => {
                        const copy = [...form.links_support.social_links];
                        copy[idx].label = e.target.value;
                        updateField('links_support.social_links', copy);
                      }}
                      placeholder="Label (e.g., Discord)"
                      className="px-3 py-1.5 rounded-md border border-slate-300 text-xs focus:ring-1 focus:ring-indigo-500 bg-white"
                    />
                    <input
                      type="url"
                      disabled={isReadOnly}
                      value={soc.url || ''}
                      onChange={(e) => {
                        const copy = [...form.links_support.social_links];
                        copy[idx].url = e.target.value;
                        updateField('links_support.social_links', copy);
                      }}
                      placeholder="https://..."
                      className="px-3 py-1.5 rounded-md border border-slate-300 text-xs focus:ring-1 focus:ring-indigo-500 bg-white"
                    />
                  </div>

                  <label className="flex items-center gap-1.5 text-xs text-slate-600 select-none cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={isReadOnly}
                      checked={Boolean(soc.is_visible)}
                      onChange={(e) => {
                        const copy = [...form.links_support.social_links];
                        copy[idx].is_visible = e.target.checked;
                        updateField('links_support.social_links', copy);
                      }}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Visible</span>
                  </label>

                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSocialLink(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {(!form.links_support?.social_links || form.links_support.social_links.length === 0) && (
                <p className="text-xs text-slate-400 italic py-2">No social links configured.</p>
              )}
            </div>
          </div>

          {/* More Tab Link Toggles */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-600" />
              <span>More Tab Link Toggles</span>
            </h2>
            <p className="text-xs text-slate-500">
              Configure which utility items appear in the mobile app's More tab.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
              <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-not-allowed">
                <input
                  type="checkbox"
                  disabled={true}
                  checked={true}
                  className="rounded text-indigo-600"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-900 block">Privacy Policy</span>
                  <span className="text-[10px] text-slate-500">Locked visible for release</span>
                </div>
              </label>

              {['support', 'website', 'share_app', 'rate_app', 'terms'].map((key) => {
                const labels = {
                  support: 'Support & Help',
                  website: 'Official Website',
                  share_app: 'Share Prompt Gallery',
                  rate_app: 'Rate on Google Play',
                  terms: 'Terms of Service',
                };
                return (
                  <label
                    key={key}
                    className={`flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 transition-colors ${
                      isReadOnly ? 'cursor-not-allowed bg-slate-50' : 'cursor-pointer hover:bg-slate-50 bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={isReadOnly}
                      checked={Boolean(form.links_support?.visible_more_links?.[key])}
                      onChange={(e) => updateField(`links_support.visible_more_links.${key}`, e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-900 block">{labels[key]}</span>
                      <span className="text-[10px] text-slate-400 capitalize">{key.replace('_', ' ')}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Home & Discover */}
      {activeTab === 'home' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-600" />
                  <span>Home Screen Feed Sections</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Reorder and customize section title overrides on the app's primary Discover / Home feed.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-indigo-50/60 border border-indigo-100 text-xs text-indigo-900 flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>
                <strong>System integration:</strong> This controls display ordering and titles for the Featured, Trending, and New Prompts feeds. Prompts, categories, and collection items remain directly curated in their respective admin sections.
              </span>
            </div>

            <div className="space-y-4 pt-2">
              {(form.home_discover?.sections || []).map((sec, idx) => (
                <div
                  key={sec.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-slate-200 bg-white shadow-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div className="flex flex-col">
                      <button
                        type="button"
                        disabled={isReadOnly || idx === 0}
                        onClick={() => handleMoveHomeSection(idx, -1)}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isReadOnly || idx === (form.home_discover.sections.length - 1)}
                        onClick={() => handleMoveHomeSection(idx, 1)}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {sec.id.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        Type: {sec.type}
                      </span>
                    </div>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={sec.title || ''}
                      onChange={(e) => {
                        const copy = [...form.home_discover.sections];
                        copy[idx].title = e.target.value;
                        updateField('home_discover.sections', copy);
                      }}
                      placeholder="Section Title Override"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2 sm:pt-0">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 select-none cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={isReadOnly}
                        checked={Boolean(sec.is_visible)}
                        onChange={(e) => {
                          const copy = [...form.home_discover.sections];
                          copy[idx].is_visible = e.target.checked;
                          updateField('home_discover.sections', copy);
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Visible in Feed</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: App Experience */}
      {activeTab === 'experience' && (
        <div className="space-y-6">
          {/* Identity & Tagline */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
            <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <span>Branding & App Identity</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  App Display Name
                </label>
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={form.app_experience?.app_name || ''}
                  onChange={(e) => updateField('app_experience.app_name', e.target.value)}
                  placeholder="Prompt Gallery"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Tagline / Subheading
                </label>
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={form.app_experience?.tagline || ''}
                  onChange={(e) => updateField('app_experience.tagline', e.target.value)}
                  placeholder="Curated AI Prompts for Creators"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
              Approved mobile bottom navigation bar: <strong>Home</strong>, <strong>Discover</strong>, <strong>Favorites</strong>, and <strong>More</strong>.
            </div>
          </div>

          {/* Promotional Banner with ImageKit + External URL */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Radio className="w-5 h-5 text-indigo-600" />
                  <span>Promotional In-App Banner</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Optional visual banner displayed at the top of the mobile Discover feed.
                </p>
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  disabled={isReadOnly}
                  checked={Boolean(form.app_experience?.banner?.enabled)}
                  onChange={(e) => updateField('app_experience.banner.enabled', e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Enable Banner</span>
              </label>
            </div>

            {form.app_experience?.banner?.enabled && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Banner Text / Headline
                    </label>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={form.app_experience?.banner?.text || ''}
                      onChange={(e) => updateField('app_experience.banner.text', e.target.value)}
                      placeholder="Explore v6 Midjourney & FLUX.1 models now live!"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Action Link (HTTPS URL)
                    </label>
                    <input
                      type="url"
                      disabled={isReadOnly}
                      value={form.app_experience?.banner?.action_url || ''}
                      onChange={(e) => updateField('app_experience.banner.action_url', e.target.value)}
                      placeholder="https://promptgallery.app/special-event"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Banner Background Image
                  </label>
                  <ImageInputTabs
                    value={form.app_experience?.banner?.image_url}
                    sourceType={form.app_experience?.banner?.source_type || 'imagekit'}
                    fileId={form.app_experience?.banner?.imagekit_file_id}
                    disabled={isReadOnly}
                    onChange={({ url, sourceType, fileId }) => {
                      if (!isSuperAdmin) return;
                      updateField('app_experience.banner.image_url', url);
                      updateField('app_experience.banner.source_type', sourceType);
                      updateField('app_experience.banner.imagekit_file_id', fileId);
                    }}
                    folder="/banners"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Feature Flags */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-600" />
              <span>Mobile Feature Toggles</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isReadOnly}
                  checked={Boolean(form.app_experience?.features?.video_prompts)}
                  onChange={(e) => updateField('app_experience.features.video_prompts', e.target.checked)}
                  className="rounded text-indigo-600 mt-0.5"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Video Prompts</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Surfaces video media types in mobile feeds once the client build supports video playback.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isReadOnly}
                  checked={Boolean(form.app_experience?.features?.favorite_prompts)}
                  onChange={(e) => updateField('app_experience.features.favorite_prompts', e.target.checked)}
                  className="rounded text-indigo-600 mt-0.5"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Favorites Screen</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Enables local on-device bookmarking and the Favorites navigation tab.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isReadOnly}
                  checked={Boolean(form.app_experience?.features?.copy_prompt_action)}
                  onChange={(e) => updateField('app_experience.features.copy_prompt_action', e.target.checked)}
                  className="rounded text-indigo-600 mt-0.5"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">One-Click Copy</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Shows 1-click prompt text clipboard copy action on prompt cards.
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Maintenance & Updates */}
      {activeTab === 'maintenance' && (
        <div className="space-y-6">
          {/* Maintenance Mode */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-indigo-600" />
                  <span>Maintenance Mode</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Take the mobile app offline during major backend upgrades or migrations.
                </p>
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  disabled={isReadOnly}
                  checked={Boolean(form.maintenance?.is_enabled)}
                  onChange={(e) => updateField('maintenance.is_enabled', e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className={form.maintenance?.is_enabled ? 'text-rose-600 font-bold' : ''}>
                  {form.maintenance?.is_enabled ? 'Maintenance ACTIVE' : 'Maintenance Disabled'}
                </span>
              </label>
            </div>

            {form.maintenance?.is_enabled && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-4">
                <div className="flex items-center gap-2 text-rose-800 text-xs font-semibold">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    When enabled, the mobile app displays a blocking screen and halts catalog requests.
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-rose-900 uppercase tracking-wider mb-1">
                      Maintenance Screen Title
                    </label>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={form.maintenance?.title || ''}
                      onChange={(e) => updateField('maintenance.title', e.target.value)}
                      placeholder="Scheduled Maintenance"
                      className="w-full px-3 py-2 rounded-lg border border-rose-300 bg-white text-sm focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-rose-900 uppercase tracking-wider mb-1">
                      Maintenance Screen Message
                    </label>
                    <textarea
                      rows={2}
                      disabled={isReadOnly}
                      value={form.maintenance?.message || ''}
                      onChange={(e) => updateField('maintenance.message', e.target.value)}
                      placeholder="We are currently upgrading Prompt Gallery. Please check back shortly."
                      className="w-full px-3 py-2 rounded-lg border border-rose-300 bg-white text-sm focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* App Update Notice */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <ArrowUp className="w-5 h-5 text-indigo-600" />
                  <span>Mobile Update Notice</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Notify mobile app users when a new release is available on Google Play.
                </p>
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  disabled={isReadOnly}
                  checked={Boolean(form.maintenance?.update_notice?.is_enabled)}
                  onChange={(e) => updateField('maintenance.update_notice.is_enabled', e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Enable Notice</span>
              </label>
            </div>

            {form.maintenance?.update_notice?.is_enabled && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Notice Title
                    </label>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={form.maintenance?.update_notice?.title || ''}
                      onChange={(e) => updateField('maintenance.update_notice.title', e.target.value)}
                      placeholder="New Version Available"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Minimum Supported Android Build Number
                    </label>
                    <input
                      type="number"
                      min="1"
                      disabled={isReadOnly}
                      value={form.maintenance?.update_notice?.min_build_number || 1}
                      onChange={(e) => updateField('maintenance.update_notice.min_build_number', parseInt(e.target.value, 10) || 1)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Builds lower than this will trigger the update prompt on launch.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Notice Message
                  </label>
                  <textarea
                    rows={2}
                    disabled={isReadOnly}
                    value={form.maintenance?.update_notice?.message || ''}
                    onChange={(e) => updateField('maintenance.update_notice.message', e.target.value)}
                    placeholder="A new version of Prompt Gallery is available on Google Play with fresh features and optimizations."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      CTA Button Label
                    </label>
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={form.maintenance?.update_notice?.cta_label || ''}
                      onChange={(e) => updateField('maintenance.update_notice.cta_label', e.target.value)}
                      placeholder="Update Now"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex items-center pt-5">
                    <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer w-full">
                      <input
                        type="checkbox"
                        disabled={isReadOnly}
                        checked={Boolean(form.maintenance?.update_notice?.is_blocking)}
                        onChange={(e) => updateField('maintenance.update_notice.is_blocking', e.target.checked)}
                        className="rounded text-rose-600 focus:ring-rose-500 mt-0.5"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Enforce Blocking (Mandatory) Update
                        </span>
                        <span className="text-[11px] text-slate-500 block">
                          Users cannot dismiss the update screen until updating via Google Play Store. Requires valid store URL.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interactive Mobile Device Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Mobile App Preview (360×640)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Preview Viewport Tabs */}
            <div className="flex border-b border-slate-200 bg-white px-4 gap-2 pt-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPreviewDeviceTab('home')}
                className={`pb-2 px-2 border-b-2 transition-colors cursor-pointer ${
                  previewDeviceTab === 'home'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                Home / Feed
              </button>
              <button
                type="button"
                onClick={() => setPreviewDeviceTab('more')}
                className={`pb-2 px-2 border-b-2 transition-colors cursor-pointer ${
                  previewDeviceTab === 'more'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                More Tab
              </button>
              <button
                type="button"
                onClick={() => setPreviewDeviceTab('dialogs')}
                className={`pb-2 px-2 border-b-2 transition-colors cursor-pointer ${
                  previewDeviceTab === 'dialogs'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                Maintenance & Notice
              </button>
            </div>

            {/* Simulated Mobile Screen */}
            <div className="p-4 overflow-y-auto flex-1 bg-slate-100 flex justify-center">
              <div className="w-[320px] bg-slate-900 text-white rounded-2xl shadow-xl overflow-hidden border border-slate-800 flex flex-col min-h-[480px]">
                {/* Mobile Top Bar */}
                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <span className="font-bold text-xs tracking-tight text-white">
                      {form.app_experience?.app_name || 'Prompt Gallery'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">10:00</span>
                </div>

                {/* Device Content */}
                <div className="p-3 flex-1 overflow-y-auto space-y-3">
                  {/* HOME PREVIEW */}
                  {previewDeviceTab === 'home' && (
                    <div className="space-y-3">
                      {/* Banner Preview */}
                      {form.app_experience?.banner?.enabled && (
                        <div className="relative rounded-xl overflow-hidden bg-indigo-900/60 border border-indigo-700/50 p-3 min-h-[70px] flex flex-col justify-end">
                          {form.app_experience?.banner?.image_url && (
                            <img
                              src={form.app_experience?.banner?.image_url}
                              alt="Banner"
                              className="absolute inset-0 w-full h-full object-cover opacity-35"
                            />
                          )}
                          <div className="relative z-10">
                            <span className="text-[11px] font-bold text-white block">
                              {form.app_experience?.banner?.text || 'Featured Promotional Event'}
                            </span>
                            {form.app_experience?.banner?.action_url && (
                              <span className="text-[9px] text-indigo-300 underline block mt-0.5">
                                Tap to explore &rarr;
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Home Sections */}
                      {(form.home_discover?.sections || [])
                        .filter((s) => s.is_visible)
                        .map((sec) => (
                          <div key={sec.id} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-200">
                                {sec.title || sec.id}
                              </span>
                              <span className="text-[9px] text-indigo-400">See all</span>
                            </div>
                            <div className="flex gap-2 overflow-x-hidden">
                              <div className="w-20 h-24 rounded-lg bg-slate-800 border border-slate-700/70 flex items-center justify-center text-[10px] text-slate-500 shrink-0">
                                Card 1
                              </div>
                              <div className="w-20 h-24 rounded-lg bg-slate-800 border border-slate-700/70 flex items-center justify-center text-[10px] text-slate-500 shrink-0">
                                Card 2
                              </div>
                              <div className="w-20 h-24 rounded-lg bg-slate-800 border border-slate-700/70 flex items-center justify-center text-[10px] text-slate-500 shrink-0">
                                Card 3
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* MORE SCREEN PREVIEW */}
                  {previewDeviceTab === 'more' && (
                    <div className="space-y-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/50 mb-3">
                        <span className="font-bold text-white block text-xs">
                          {form.app_experience?.app_name || 'Prompt Gallery'}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {form.app_experience?.tagline || 'Curated AI Prompts'}
                        </span>
                      </div>

                      {/* Visible utility links */}
                      <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 divide-y divide-slate-800">
                        {form.links_support?.visible_more_links?.privacy_policy && (
                          <div className="p-2 flex items-center justify-between text-[11px]">
                            <span>Privacy Policy</span>
                            <span className="text-[9px] text-slate-400">In-App Web</span>
                          </div>
                        )}
                        {form.links_support?.visible_more_links?.support && (
                          <div className="p-2 flex items-center justify-between text-[11px]">
                            <span>Support & Feedback</span>
                            <span className="text-[9px] text-slate-400 truncate max-w-[120px]">
                              {form.links_support?.support_email || 'Email'}
                            </span>
                          </div>
                        )}
                        {form.links_support?.visible_more_links?.website && (
                          <div className="p-2 flex items-center justify-between text-[11px]">
                            <span>Official Website</span>
                            <ExternalLink className="w-3 h-3 text-slate-500" />
                          </div>
                        )}
                        {form.links_support?.visible_more_links?.share_app && (
                          <div className="p-2 flex items-center justify-between text-[11px]">
                            <span>Share App</span>
                            <Share2 className="w-3 h-3 text-slate-500" />
                          </div>
                        )}
                        {form.links_support?.visible_more_links?.rate_app && (
                          <div className="p-2 flex items-center justify-between text-[11px]">
                            <span>Rate on Play Store</span>
                            <span className="text-[9px] text-amber-400">★★★★★</span>
                          </div>
                        )}
                      </div>

                      {/* Social Links */}
                      {(form.links_support?.social_links || []).filter((s) => s.is_visible).length > 0 && (
                        <div className="pt-2">
                          <span className="text-[10px] uppercase font-semibold text-slate-500 px-1 block mb-1">
                            Follow Us
                          </span>
                          <div className="grid grid-cols-2 gap-1.5">
                            {(form.links_support?.social_links || [])
                              .filter((s) => s.is_visible)
                              .map((soc) => (
                                <div
                                  key={soc.id}
                                  className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-[10px] text-center truncate text-slate-300"
                                >
                                  {soc.label}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* MAINTENANCE & UPDATE PREVIEW */}
                  {previewDeviceTab === 'dialogs' && (
                    <div className="space-y-4">
                      {form.maintenance?.is_enabled ? (
                        <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-800 text-center space-y-2">
                          <Wrench className="w-6 h-6 text-rose-400 mx-auto" />
                          <h4 className="text-xs font-bold text-white">
                            {form.maintenance?.title || 'Scheduled Maintenance'}
                          </h4>
                          <p className="text-[10px] text-rose-200">
                            {form.maintenance?.message || 'We are currently upgrading the catalog.'}
                          </p>
                          <span className="inline-block text-[9px] text-rose-400 mt-2">
                            (Blocking modal — all app tabs disabled)
                          </span>
                        </div>
                      ) : (
                        <div className="p-3 text-center text-[11px] text-slate-500">
                          Maintenance mode is currently inactive.
                        </div>
                      )}

                      {form.maintenance?.update_notice?.is_enabled && (
                        <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 text-center space-y-2">
                          <ArrowUp className="w-6 h-6 text-indigo-400 mx-auto" />
                          <h4 className="text-xs font-bold text-white">
                            {form.maintenance?.update_notice?.title || 'Update Available'}
                          </h4>
                          <p className="text-[10px] text-slate-300">
                            {form.maintenance?.update_notice?.message || 'New features available on Google Play.'}
                          </p>
                          <button
                            type="button"
                            className="w-full py-1.5 rounded-lg bg-indigo-600 text-white text-[10px] font-bold shadow-sm"
                          >
                            {form.maintenance?.update_notice?.cta_label || 'Update Now'}
                          </button>
                          <span className="text-[9px] text-slate-400 block">
                            {form.maintenance?.update_notice?.is_blocking
                              ? 'Blocking update — non-dismissible'
                              : 'Dismissible notice'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Mobile Bottom Navigation Bar */}
                <div className="px-4 py-2 border-t border-slate-800 bg-slate-950 flex items-center justify-around text-[10px] text-slate-400">
                  <span className="text-indigo-400 font-bold">Home</span>
                  <span>Discover</span>
                  <span>Favorites</span>
                  <span>More</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          isOpen={true}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          isDestructive={confirmDialog.isDestructive}
          onConfirm={() => {
            const cb = confirmDialog.onConfirm;
            setConfirmDialog(null);
            if (cb) cb();
          }}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}

export default MobileAppSettingsPage;

