import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Smartphone,
  Save,
  CheckCircle,
  AlertTriangle,
  Layers,
  Sliders,
  Info,
  ShieldAlert,
  Copy,
  ExternalLink,
  Lock,
  RefreshCw,
  Clock,
  Sparkles,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { api } from '../services/api';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

// Official Google AdMob Test Identifiers (Publicly documented by Google for testing)
const GOOGLE_ADMOB_TEST_IDS = {
  android: {
    appId: 'ca-app-pub-3940256099942544~3347511713',
    banner: 'ca-app-pub-3940256099942544/6300978111',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
    app_open: 'ca-app-pub-3940256099942544/9257390708',
  },
  ios: {
    appId: 'ca-app-pub-3940256099942544~1458002511',
    banner: 'ca-app-pub-3940256099942544/2934735716',
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
    app_open: 'ca-app-pub-3940256099942544/5575463023',
  },
};

const PLACEMENT_METADATA = {
  home_feed_banner: {
    name: 'Home Feed Banner',
    screen: 'Home / Discover Masonry Feed',
    description: 'Inline banner ad displayed beneath prompt cards in the main feed.',
    format: 'banner',
  },
  prompt_details_banner: {
    name: 'Prompt Details Banner',
    screen: 'Prompt Details Screen',
    description: 'Sticky or bottom banner positioned below prompt metadata and action buttons.',
    format: 'banner',
  },
  navigation_interstitial: {
    name: 'Navigation Interstitial',
    screen: 'Prompt & Collection Transitions',
    description: 'Full-screen interstitial shown at natural navigation breaks between views.',
    format: 'interstitial',
  },
  app_open: {
    name: 'App Open Ad',
    screen: 'Cold Start & Foreground Return',
    description: 'Full-screen ad displayed seamlessly when opening or resuming the application, with cold-start gating and launch counters.',
    format: 'app_open',
  },
};

export function MonetizationPage() {
  const { isSuperAdmin, userRole } = useAuth();
  const notify = useNotification();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'placements' | 'app_config'
  const [platformFilter, setPlatformFilter] = useState('all'); // 'all' | 'android' | 'ios'

  // Server state
  const [serverState, setServerState] = useState(null);

  // Form state
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [platformSettings, setPlatformSettings] = useState([]);
  const [placements, setPlacements] = useState([]);
  const [configVersion, setConfigVersion] = useState(1);
  const [updatedAt, setUpdatedAt] = useState(null);

  // Dirty state tracking
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const data = await api.monetization.getConfig();
      if (data) {
        setServerState(JSON.parse(JSON.stringify(data)));
        setGlobalEnabled(Boolean(data.global_enabled));
        setPlatformSettings(JSON.parse(JSON.stringify(data.settings || [])));
        setPlacements(JSON.parse(JSON.stringify(data.placements || [])));
        setConfigVersion(data.config_version || 1);
        setUpdatedAt(data.updated_at);
        setIsDirty(false);
      }
    } catch (err) {
      notify.error(`Failed to load monetization configuration: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Check if form differs from loaded server state
  const checkIfDirty = (newGlobal, newSettings, newPlacements) => {
    if (!serverState) return false;
    const gDiff = newGlobal !== serverState.global_enabled;
    const sDiff = JSON.stringify(newSettings) !== JSON.stringify(serverState.settings);
    const pDiff = JSON.stringify(newPlacements) !== JSON.stringify(serverState.placements);
    return gDiff || sDiff || pDiff;
  };

  // Mutators
  const handleToggleGlobal = (val) => {
    if (!isSuperAdmin) return;
    setGlobalEnabled(val);
    setIsDirty(checkIfDirty(val, platformSettings, placements));
  };

  const handleUpdatePlatformSetting = (platform, field, val) => {
    if (!isSuperAdmin) return;
    const updated = platformSettings.map((item) => {
      if (item.platform === platform) {
        return { ...item, [field]: val };
      }
      return item;
    });
    setPlatformSettings(updated);
    setIsDirty(checkIfDirty(globalEnabled, updated, placements));
  };

  const handleUpdatePlacement = (placementKey, platform, field, val) => {
    if (!isSuperAdmin) return;
    const updated = placements.map((item) => {
      if (item.placement_key === placementKey && item.platform === platform) {
        return { ...item, [field]: val };
      }
      return item;
    });
    setPlacements(updated);
    setIsDirty(checkIfDirty(globalEnabled, platformSettings, updated));
  };

  // Validation
  const validateSettingsBeforeSave = () => {
    // 1. Validate App IDs
    platformSettings.forEach((ps) => {
      if (ps.desired_app_id && ps.desired_app_id.trim()) {
        const appId = ps.desired_app_id.trim();
        if (!/^ca-app-pub-[0-9]{16}~[0-9]{10}$/i.test(appId)) {
          throw new Error(`Invalid AdMob App ID format for ${ps.platform.toUpperCase()} (expected ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX): "${appId}"`);
        }
      }
    });

    // 2. Validate Placements
    placements.forEach((plc) => {
      const unitId = plc.ad_unit_id ? plc.ad_unit_id.trim() : '';
      if (unitId) {
        if (!/^ca-app-pub-[0-9]{16}\/[0-9]{10}$/i.test(unitId)) {
          throw new Error(`Invalid Ad Unit ID format for "${plc.placement_key}" on ${plc.platform.toUpperCase()} (expected ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX): "${unitId}"`);
        }
      }
      if (plc.enabled && !unitId) {
        throw new Error(`Placement "${PLACEMENT_METADATA[plc.placement_key]?.name || plc.placement_key}" on ${plc.platform.toUpperCase()} cannot be enabled without an Ad Unit ID.`);
      }

      // Check frequency numeric ranges for interstitials
      if (plc.ad_format === 'interstitial') {
        if (plc.min_interval_seconds !== null && plc.min_interval_seconds !== undefined) {
          const val = Number(plc.min_interval_seconds);
          if (val < 10 || val > 3600) {
            throw new Error(`Minimum interval between ads must be between 10 and 3600 seconds (got ${val}s)`);
          }
        }
        if (plc.max_impressions_per_session !== null && plc.max_impressions_per_session !== undefined) {
          const val = Number(plc.max_impressions_per_session);
          if (val < 1 || val > 100) {
            throw new Error(`Max impressions per session must be between 1 and 100 (got ${val})`);
          }
        }
        if (plc.min_navigation_events !== null && plc.min_navigation_events !== undefined) {
          const val = Number(plc.min_navigation_events);
          if (val < 0 || val > 50) {
            throw new Error(`Minimum navigation events must be between 0 and 50 (got ${val})`);
          }
        }
        if (plc.first_session_grace_seconds !== null && plc.first_session_grace_seconds !== undefined) {
          const val = Number(plc.first_session_grace_seconds);
          if (val < 0 || val > 1800) {
            throw new Error(`First-session grace period must be between 0 and 1800 seconds (got ${val}s)`);
          }
        }
      }

      // Check frequency & trigger ranges for app_open
      if (plc.ad_format === 'app_open') {
        if (plc.min_interval_seconds !== null && plc.min_interval_seconds !== undefined) {
          const val = Number(plc.min_interval_seconds);
          if (val < 10 || val > 3600) {
            throw new Error(`Cooldown between app-open ads must be between 10 and 3600 seconds (got ${val}s)`);
          }
        }
        if (plc.max_impressions_per_session !== null && plc.max_impressions_per_session !== undefined) {
          const val = Number(plc.max_impressions_per_session);
          if (val < 1 || val > 100) {
            throw new Error(`Maximum app-open impressions per session must be between 1 and 100 (got ${val})`);
          }
        }
        if (plc.min_background_seconds !== null && plc.min_background_seconds !== undefined) {
          const val = Number(plc.min_background_seconds);
          if (val < 5 || val > 3600) {
            throw new Error(`Minimum background duration must be between 5 and 3600 seconds (got ${val}s)`);
          }
        }
        if (plc.skip_first_n_launches !== null && plc.skip_first_n_launches !== undefined) {
          const val = Number(plc.skip_first_n_launches);
          if (val < 1 || val > 100) {
            throw new Error(`Skip first N app launches must be between 1 and 100 (got ${val}). Must be at least 1 to prevent first-ever-launch ads.`);
          }
        }
      }
    });
  };

  const handleSaveChanges = async () => {
    if (!isSuperAdmin) return;
    try {
      validateSettingsBeforeSave();
    } catch (err) {
      notify.error(err.message);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        global_enabled: globalEnabled,
        settings: platformSettings,
        placements: placements,
        expected_version: configVersion,
      };
      const res = await api.monetization.saveConfig(payload);
      notify.success(`Monetization settings saved successfully (v${res.config_version})`);
      await loadConfig();
    } catch (err) {
      notify.error(`Failed to save settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Helper counters
  const enabledPlacementsCount = placements.filter((p) => p.enabled && p.ad_unit_id).length;
  const androidPlacementsCount = placements.filter((p) => p.platform === 'android' && p.enabled && p.ad_unit_id).length;
  const iosPlacementsCount = placements.filter((p) => p.platform === 'ios' && p.enabled && p.ad_unit_id).length;

  const androidSetting = platformSettings.find((s) => s.platform === 'android') || { enabled: false, desired_app_id: '' };
  const iosSetting = platformSettings.find((s) => s.platform === 'ios') || { enabled: false, desired_app_id: '' };

  const filteredPlacements = placements.filter((p) => {
    if (platformFilter === 'all') return true;
    return p.platform === platformFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <LoadingSpinner size="lg" message="Loading Monetization Configuration..." />
      </div>
    );
  }

  const isReadOnly = !isSuperAdmin;

  return (
    <div className="space-y-6 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs border border-emerald-100">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Monetization</h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  v{configVersion}
                </span>
                {isDirty ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Unsaved Changes
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                    Saved
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage mobile app advertising, Google AdMob placements, and build configurations
              </p>
            </div>
          </div>
        </div>

        {/* Master Switch & Save Button */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Master Enable Ads Switch */}
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white shadow-xs">
            <span className="text-xs font-semibold text-slate-700 select-none">Master Ads Switch:</span>
            <button
              type="button"
              disabled={isReadOnly}
              onClick={() => handleToggleGlobal(!globalEnabled)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                globalEnabled ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
              role="switch"
              aria-checked={globalEnabled}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  globalEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={`text-[11px] font-bold ${globalEnabled ? 'text-emerald-700' : 'text-slate-500'}`}>
              {globalEnabled ? 'ACTIVE' : 'OFF'}
            </span>
          </div>

          {/* Save Changes Button */}
          {isSuperAdmin && (
            <button
              type="button"
              disabled={saving || !isDirty}
              onClick={handleSaveChanges}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold shadow-sm hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-40"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Role Banner if not Super Admin */}
      {isReadOnly && (
        <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700 flex items-center gap-3">
          <Lock className="w-4 h-4 text-slate-500 shrink-0" />
          <span>
            <strong>Read-only view ({userRole}):</strong> You are viewing the active monetization configuration. Only Super Admins are authorized to edit AdMob identifiers, adjust placement rules, or toggle master switches.
          </span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('placements')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'placements'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Ad Placements ({enabledPlacementsCount} active)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('app_config')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'app_config'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>App Configuration</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW                                                           */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Master Global State */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Master Switch
                </span>
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    globalEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                  }`}
                />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {globalEnabled ? 'Enabled' : 'Disabled'}
              </div>
              <p className="text-[11px] text-slate-500">
                {globalEnabled
                  ? 'Advertising is globally active across eligible mobile builds.'
                  : 'All mobile ad requests are globally halted regardless of placements.'}
              </p>
            </div>

            {/* Android Status */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Android Ads
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    androidSetting.enabled && globalEnabled
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {androidSetting.enabled && globalEnabled ? 'ACTIVE' : 'OFF'}
                </span>
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {androidPlacementsCount} Active
              </div>
              <p className="text-[11px] text-slate-500">
                {androidSetting.desired_app_id
                  ? 'App ID configured for native builds.'
                  : 'No build App ID configured.'}
              </p>
            </div>

            {/* iOS Status */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  iOS Ads
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    iosSetting.enabled && globalEnabled
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {iosSetting.enabled && globalEnabled ? 'ACTIVE' : 'OFF'}
                </span>
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {iosPlacementsCount} Active
              </div>
              <p className="text-[11px] text-slate-500">
                {iosSetting.desired_app_id
                  ? 'App ID configured for native builds.'
                  : 'No build App ID configured.'}
              </p>
            </div>

            {/* Config Version & Sync Status */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Config Version
                </span>
                <Clock className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                v{configVersion}
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                {updatedAt ? `Updated ${new Date(updatedAt).toLocaleString()}` : 'Initial seed'}
              </p>
            </div>
          </div>

          {/* Quick Platform Switches Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
            <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-emerald-600" />
              <span>Platform Delivery Controls</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Android Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-900">Android Platform Ads</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold">
                      Google Play
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Controls ad serving across Android app installations.
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    disabled={isReadOnly}
                    checked={Boolean(androidSetting.enabled)}
                    onChange={(e) => handleUpdatePlatformSetting('android', 'enabled', e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span className="text-xs font-bold text-slate-700">Enabled</span>
                </label>
              </div>

              {/* iOS Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-900">iOS Platform Ads</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold">
                      App Store
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Controls ad serving across iOS app installations.
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    disabled={isReadOnly}
                    checked={Boolean(iosSetting.enabled)}
                    onChange={(e) => handleUpdatePlatformSetting('ios', 'enabled', e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span className="text-xs font-bold text-slate-700">Enabled</span>
                </label>
              </div>
            </div>
          </div>

          {/* Architecture & Offline Notice */}
          <div className="p-5 rounded-xl bg-indigo-50/70 border border-indigo-100 space-y-3">
            <div className="flex items-center gap-2 text-indigo-900 font-semibold text-xs">
              <Info className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Mobile Client Synchronization Architecture</span>
            </div>
            <p className="text-xs text-indigo-800 leading-relaxed">
              Monetization configurations are retrieved by the mobile client via the public Supabase endpoint. <strong>Settings apply after the mobile app successfully refreshes its configuration; changes are not instant on offline devices.</strong> Devices cache the last valid configuration and refresh automatically upon launch and foreground recovery.
            </p>
            <p className="text-[11px] text-indigo-600">
              * Note: Revenue, impression, and eCPM metrics are measured directly in your Google AdMob dashboard. This panel governs remote runtime ad rules and build configurations without accessing your private Google credentials.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: AD PLACEMENTS                                                      */}
      {/* ========================================================================= */}
      {activeTab === 'placements' && (
        <div className="space-y-6">
          {/* Filter Bar & Quick Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Filter Platform:
              </span>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
                {['all', 'android', 'ios'].map((plat) => (
                  <button
                    key={plat}
                    type="button"
                    onClick={() => setPlatformFilter(plat)}
                    className={`px-3 py-1 rounded-md font-semibold capitalize transition-colors cursor-pointer ${
                      platformFilter === plat
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {plat === 'all' ? 'All Platforms' : plat}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-xs text-slate-500">
              Only exposures and placements implemented in the mobile code are configurable.
            </div>
          </div>

          {/* Placements Cards / Table */}
          <div className="space-y-4">
            {filteredPlacements.map((plc) => {
              const meta = PLACEMENT_METADATA[plc.placement_key] || {
                name: plc.placement_key,
                screen: 'Custom Location',
                description: '',
                format: plc.ad_format,
              };

              const testUnitId = GOOGLE_ADMOB_TEST_IDS[plc.platform]?.[plc.ad_format];

              return (
                <div
                  key={`${plc.placement_key}_${plc.platform}`}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs hover:border-slate-300 transition-colors"
                >
                  {/* Card Header */}
                  <div className="p-4 sm:p-5 bg-slate-50/70 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-900">{meta.name}</h3>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                            plc.platform === 'android'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {plc.platform}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700 capitalize">
                          {plc.ad_format}
                        </span>
                        <code className="text-[11px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                          {plc.placement_key}
                        </code>
                      </div>
                      <p className="text-xs text-slate-500">{meta.description}</p>
                    </div>

                    {/* Enable Toggle for this Placement */}
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          disabled={isReadOnly}
                          checked={Boolean(plc.enabled)}
                          onChange={(e) =>
                            handleUpdatePlacement(plc.placement_key, plc.platform, 'enabled', e.target.checked)
                          }
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                        />
                        <span className={plc.enabled ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                          {plc.enabled ? 'Placement Enabled' : 'Disabled'}
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 sm:p-5 space-y-4">
                    {/* Ad Unit ID input with Quick Test ID helper */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                          Ad Unit ID <span className="text-slate-400 font-normal">(format: ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX)</span>
                        </label>
                        {isSuperAdmin && testUnitId && (
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdatePlacement(plc.placement_key, plc.platform, 'ad_unit_id', testUnitId)
                            }
                            className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Use Google AdMob Test Ad Unit ID</span>
                          </button>
                        )}
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          disabled={isReadOnly}
                          value={plc.ad_unit_id || ''}
                          onChange={(e) =>
                            handleUpdatePlacement(plc.placement_key, plc.platform, 'ad_unit_id', e.target.value)
                          }
                          placeholder={testUnitId || 'ca-app-pub-3940256099942544/6300978111'}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
                        />
                      </div>
                    </div>

                    {/* Specific Interstitial Frequency Settings */}
                    {plc.ad_format === 'interstitial' && (
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                          <Sliders className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Interstitial Frequency Capping & Delivery Rules</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                              Min Interval (seconds)
                            </label>
                            <input
                              type="number"
                              min="10"
                              max="3600"
                              disabled={isReadOnly}
                              value={plc.min_interval_seconds ?? 180}
                              onChange={(e) =>
                                handleUpdatePlacement(
                                  plc.placement_key,
                                  plc.platform,
                                  'min_interval_seconds',
                                  parseInt(e.target.value, 10) || 10
                                )
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold focus:ring-1 focus:ring-emerald-500"
                            />
                            <span className="text-[10px] text-slate-400">Default: 180s (3m)</span>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                              Max Impressions / Session
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              disabled={isReadOnly}
                              value={plc.max_impressions_per_session ?? 3}
                              onChange={(e) =>
                                handleUpdatePlacement(
                                  plc.placement_key,
                                  plc.platform,
                                  'max_impressions_per_session',
                                  parseInt(e.target.value, 10) || 1
                                )
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold focus:ring-1 focus:ring-emerald-500"
                            />
                            <span className="text-[10px] text-slate-400">Default: 3 per session</span>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                              Min Navigation Events
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="50"
                              disabled={isReadOnly}
                              value={plc.min_navigation_events ?? 4}
                              onChange={(e) =>
                                handleUpdatePlacement(
                                  plc.placement_key,
                                  plc.platform,
                                  'min_navigation_events',
                                  parseInt(e.target.value, 10) || 0
                                )
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold focus:ring-1 focus:ring-emerald-500"
                            />
                            <span className="text-[10px] text-slate-400">Default: 4 views</span>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                              Grace Period (seconds)
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="1800"
                              disabled={isReadOnly}
                              value={plc.first_session_grace_seconds ?? 60}
                              onChange={(e) =>
                                handleUpdatePlacement(
                                  plc.placement_key,
                                  plc.platform,
                                  'first_session_grace_seconds',
                                  parseInt(e.target.value, 10) || 0
                                )
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold focus:ring-1 focus:ring-emerald-500"
                            />
                            <span className="text-[10px] text-slate-400">Default: 60s cooldown</span>
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200 flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>
                            Interstitials are strictly suppressed during startup/splash, tab switches, and Copy/Generate actions.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Specific App Open Settings */}
                    {plc.ad_format === 'app_open' && (
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                          <Sliders className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>App Open Trigger & Frequency Capping Rules</span>
                        </div>

                        {/* Trigger Toggles (Cold start & Foreground return) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2 border-b border-slate-200">
                          <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800">Show on Cold Start</span>
                              <input
                                type="checkbox"
                                disabled={isReadOnly}
                                checked={plc.show_on_cold_start !== false}
                                onChange={(e) =>
                                  handleUpdatePlacement(
                                    plc.placement_key,
                                    plc.platform,
                                    'show_on_cold_start',
                                    e.target.checked
                                  )
                                }
                                className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                              />
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Show ad when app is opened from a terminated state (subject to launch threshold).
                            </p>
                          </div>

                          <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800">Show on Foreground Return</span>
                              <input
                                type="checkbox"
                                disabled={isReadOnly}
                                checked={plc.show_on_foreground_return !== false}
                                onChange={(e) =>
                                  handleUpdatePlacement(
                                    plc.placement_key,
                                    plc.platform,
                                    'show_on_foreground_return',
                                    e.target.checked
                                  )
                                }
                                className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                              />
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Show ad when returning to the app from background after minimum background duration.
                            </p>
                          </div>
                        </div>

                        {/* Frequency Numerical Limits */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                              Min Background (sec)
                            </label>
                            <input
                              type="number"
                              min="5"
                              max="3600"
                              disabled={isReadOnly}
                              value={plc.min_background_seconds ?? 60}
                              onChange={(e) =>
                                handleUpdatePlacement(
                                  plc.placement_key,
                                  plc.platform,
                                  'min_background_seconds',
                                  parseInt(e.target.value, 10) || 5
                                )
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold focus:ring-1 focus:ring-emerald-500"
                            />
                            <span className="text-[10px] text-slate-400 block mt-0.5 leading-tight">
                              Min background duration before returning qualifies. Default: 60s.
                            </span>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                              Cooldown (sec)
                            </label>
                            <input
                              type="number"
                              min="10"
                              max="3600"
                              disabled={isReadOnly}
                              value={plc.min_interval_seconds ?? 300}
                              onChange={(e) =>
                                handleUpdatePlacement(
                                  plc.placement_key,
                                  plc.platform,
                                  'min_interval_seconds',
                                  parseInt(e.target.value, 10) || 10
                                )
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold focus:ring-1 focus:ring-emerald-500"
                            />
                            <span className="text-[10px] text-slate-400 block mt-0.5 leading-tight">
                              Minimum spacing between consecutive app-open ads. Default: 300s.
                            </span>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                              Max / Session
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              disabled={isReadOnly}
                              value={plc.max_impressions_per_session ?? 2}
                              onChange={(e) =>
                                handleUpdatePlacement(
                                  plc.placement_key,
                                  plc.platform,
                                  'max_impressions_per_session',
                                  parseInt(e.target.value, 10) || 1
                                )
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold focus:ring-1 focus:ring-emerald-500"
                            />
                            <span className="text-[10px] text-slate-400 block mt-0.5 leading-tight">
                              Max app-open impressions per session. Default: 2.
                            </span>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                              Skip First N Launches
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              disabled={isReadOnly}
                              value={plc.skip_first_n_launches ?? 2}
                              onChange={(e) =>
                                handleUpdatePlacement(
                                  plc.placement_key,
                                  plc.platform,
                                  'skip_first_n_launches',
                                  parseInt(e.target.value, 10) || 1
                                )
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold focus:ring-1 focus:ring-emerald-500"
                            />
                            <span className="text-[10px] text-slate-400 block mt-0.5 leading-tight">
                              Fresh launches to skip before first ad (min 1). Default: 2.
                            </span>
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200 flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>
                            First-ever app launch ads are strictly blocked. Setting "Skip first N launches" to ≥ 1 preserves the user's initial onboarding experience.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: APP CONFIGURATION                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'app_config' && (
        <div className="space-y-6">
          {/* Build-Time Banner Notice */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold uppercase tracking-wider block">
                Requires Native Rebuild and App Release
              </span>
              <p>
                AdMob App IDs (<code className="bg-amber-100 px-1 py-0.5 rounded font-mono">ca-app-pub-...~...</code>) are <strong>build-time native constants</strong> embedded inside <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">AndroidManifest.xml</code> and <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">Info.plist</code>. Saving them here stores the desired build configuration in Supabase. It will <strong>not</strong> change the App ID in installed app binaries until a new build is created and released.
              </p>
            </div>
          </div>

          {/* App IDs Configuration Form */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
            <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-emerald-600" />
              <span>Native AdMob App Identifiers</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Android App ID */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Android AdMob App ID
                  </label>
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdatePlatformSetting('android', 'desired_app_id', GOOGLE_ADMOB_TEST_IDS.android.appId)
                      }
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Use Google Test App ID</span>
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  disabled={isReadOnly}
                  value={androidSetting.desired_app_id || ''}
                  onChange={(e) => handleUpdatePlatformSetting('android', 'desired_app_id', e.target.value)}
                  placeholder="ca-app-pub-3940256099942544~3347511713"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-50"
                />
                <p className="text-[11px] text-slate-400">
                  Google AdMob App ID for Android (uses tilde <code className="font-mono">~</code> delimiter).
                </p>
              </div>

              {/* iOS App ID */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    iOS AdMob App ID
                  </label>
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdatePlatformSetting('ios', 'desired_app_id', GOOGLE_ADMOB_TEST_IDS.ios.appId)
                      }
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Use Google Test App ID</span>
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  disabled={isReadOnly}
                  value={iosSetting.desired_app_id || ''}
                  onChange={(e) => handleUpdatePlatformSetting('ios', 'desired_app_id', e.target.value)}
                  placeholder="ca-app-pub-3940256099942544~1458002511"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-50"
                />
                <p className="text-[11px] text-slate-400">
                  Google AdMob App ID for iOS (uses tilde <code className="font-mono">~</code> delimiter).
                </p>
              </div>
            </div>

            {/* Visual Guide: App ID vs Ad Unit ID */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-800 block">
                How to distinguish App IDs from Ad Unit IDs:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                  <span className="font-semibold text-slate-700 block">AdMob App ID (Build-time)</span>
                  <code className="text-emerald-700 font-mono text-[11px] block mt-0.5">
                    ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX
                  </code>
                  <span className="text-[10px] text-slate-400 block mt-1">Contains tilde (~)</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                  <span className="font-semibold text-slate-700 block">Ad Unit ID (Runtime)</span>
                  <code className="text-indigo-700 font-mono text-[11px] block mt-0.5">
                    ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
                  </code>
                  <span className="text-[10px] text-slate-400 block mt-1">Contains slash (/)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Expo Synchronization Guide */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Copy className="w-5 h-5 text-emerald-600" />
              <span>Expo Config Plugin Integration Guide</span>
            </h2>

            <p className="text-xs text-slate-600">
              When preparing a native production build with <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">eas build</code> or <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">npx expo run:android</code>, synchronize the desired App IDs into <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">app.json</code> under the <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">react-native-google-mobile-ads</code> plugin configuration:
            </p>

            <pre className="p-4 rounded-xl bg-slate-950 text-slate-100 text-xs font-mono overflow-x-auto leading-relaxed">
{`// mobile app/app.json
{
  "expo": {
    "plugins": [
      [
        "react-native-google-mobile-ads",
        {
          "androidAppId": "${androidSetting.desired_app_id || 'ca-app-pub-3940256099942544~3347511713'}",
          "iosAppId": "${iosSetting.desired_app_id || 'ca-app-pub-3940256099942544~1458002511'}"
        }
      ]
    ]
  }
}`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default MonetizationPage;

