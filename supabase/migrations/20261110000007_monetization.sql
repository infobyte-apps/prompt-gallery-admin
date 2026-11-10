-- Migration: 20261110000007_monetization.sql
-- Description: Dedicated monetization configuration (AdMob App IDs, ad settings, placement controls, and public mobile endpoint)

-- 1. Create ad_settings table (stores global master switch, platform toggles, and desired build-time App IDs)
CREATE TABLE IF NOT EXISTS public.ad_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform VARCHAR(10) NOT NULL UNIQUE CHECK (platform IN ('global', 'android', 'ios')),
    enabled BOOLEAN NOT NULL DEFAULT false,
    desired_app_id VARCHAR(100),
    config_version INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. Create ad_placements table (stores runtime placement configs)
CREATE TABLE IF NOT EXISTS public.ad_placements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    placement_key VARCHAR(50) NOT NULL CHECK (placement_key IN ('home_feed_banner', 'prompt_details_banner', 'navigation_interstitial')),
    platform VARCHAR(10) NOT NULL CHECK (platform IN ('android', 'ios')),
    ad_format VARCHAR(20) NOT NULL CHECK (ad_format IN ('banner', 'interstitial')),
    ad_unit_id VARCHAR(100),
    enabled BOOLEAN NOT NULL DEFAULT false,
    min_interval_seconds INT CHECK (min_interval_seconds IS NULL OR (min_interval_seconds >= 10 AND min_interval_seconds <= 3600)),
    max_impressions_per_session INT CHECK (max_impressions_per_session IS NULL OR (max_impressions_per_session >= 1 AND max_impressions_per_session <= 100)),
    min_navigation_events INT CHECK (min_navigation_events IS NULL OR (min_navigation_events >= 0 AND min_navigation_events <= 50)),
    first_session_grace_seconds INT CHECK (first_session_grace_seconds IS NULL OR (first_session_grace_seconds >= 0 AND first_session_grace_seconds <= 1800)),
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT unique_placement_platform UNIQUE (placement_key, platform)
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.ad_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_placements ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Authenticated staff can view monetization settings in the admin panel
DROP POLICY IF EXISTS "staff_view_ad_settings" ON public.ad_settings;
CREATE POLICY "staff_view_ad_settings"
    ON public.ad_settings
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_members
            WHERE admin_members.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "super_admin_manage_ad_settings" ON public.ad_settings;
CREATE POLICY "super_admin_manage_ad_settings"
    ON public.ad_settings
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_members
            WHERE admin_members.user_id = auth.uid()
              AND admin_members.role = 'super_admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admin_members
            WHERE admin_members.user_id = auth.uid()
              AND admin_members.role = 'super_admin'
        )
    );

DROP POLICY IF EXISTS "staff_view_ad_placements" ON public.ad_placements;
CREATE POLICY "staff_view_ad_placements"
    ON public.ad_placements
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_members
            WHERE admin_members.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "super_admin_manage_ad_placements" ON public.ad_placements;
CREATE POLICY "super_admin_manage_ad_placements"
    ON public.ad_placements
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_members
            WHERE admin_members.user_id = auth.uid()
              AND admin_members.role = 'super_admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admin_members
            WHERE admin_members.user_id = auth.uid()
              AND admin_members.role = 'super_admin'
        )
    );

-- 5. Validation Function for App ID and Ad Unit ID formats
CREATE OR REPLACE FUNCTION public.validate_admob_format(val TEXT, val_type TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF val IS NULL OR length(trim(val)) = 0 THEN
        RETURN TRUE;
    END IF;

    IF val_type = 'app_id' THEN
        -- Standard AdMob App ID pattern: ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX
        IF val !~* '^ca-app-pub-[0-9]{16}~[0-9]{10}$' THEN
            RAISE EXCEPTION 'Invalid AdMob App ID format (expected ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX): %', val;
        END IF;
    ELSIF val_type = 'ad_unit_id' THEN
        -- Standard AdMob Ad Unit ID pattern: ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
        IF val !~* '^ca-app-pub-[0-9]{16}/[0-9]{10}$' THEN
            RAISE EXCEPTION 'Invalid AdMob Ad Unit ID format (expected ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX): %', val;
        END IF;
    END IF;

    RETURN TRUE;
END;
$$;

-- 6. RPC: Save Monetization Configuration Atomically
CREATE OR REPLACE FUNCTION public.save_monetization_config(
    p_global_enabled BOOLEAN,
    p_settings JSONB,
    p_placements JSONB,
    p_expected_version INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_role VARCHAR(20);
    global_row public.ad_settings%ROWTYPE;
    new_version INT;
    setting_elem JSONB;
    placement_elem JSONB;
    p_key TEXT;
    p_plat TEXT;
    p_fmt TEXT;
    p_unit TEXT;
    p_en BOOLEAN;
    p_min_int INT;
    p_max_imp INT;
    p_min_nav INT;
    p_grace INT;
    desired_id TEXT;
BEGIN
    -- Verify caller is super_admin
    SELECT role INTO caller_role FROM public.admin_members WHERE user_id = auth.uid();
    IF caller_role != 'super_admin' THEN
        RAISE EXCEPTION 'Permission denied: Only Super Admin can modify monetization settings';
    END IF;

    -- Retrieve and lock global settings row
    SELECT * INTO global_row FROM public.ad_settings WHERE platform = 'global' FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Global ad_settings record missing';
    END IF;

    -- Concurrency version check
    IF global_row.config_version != p_expected_version THEN
        RAISE EXCEPTION 'Concurrency conflict: Monetization settings have been modified (version % vs expected %)', global_row.config_version, p_expected_version;
    END IF;

    new_version := global_row.config_version + 1;

    -- Update global master switch
    UPDATE public.ad_settings
    SET enabled = p_global_enabled,
        config_version = new_version,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE platform = 'global';

    -- Update platform settings (android, ios)
    IF p_settings IS NOT NULL AND jsonb_typeof(p_settings) = 'array' THEN
        FOR setting_elem IN SELECT * FROM jsonb_array_elements(p_settings)
        LOOP
            p_plat := setting_elem->>'platform';
            p_en := COALESCE((setting_elem->>'enabled')::BOOLEAN, false);
            desired_id := setting_elem->>'desired_app_id';

            IF desired_id IS NOT NULL AND length(trim(desired_id)) > 0 THEN
                PERFORM public.validate_admob_format(desired_id, 'app_id');
            END IF;

            UPDATE public.ad_settings
            SET enabled = p_en,
                desired_app_id = NULLIF(trim(desired_id), ''),
                config_version = new_version,
                updated_at = now(),
                updated_by = auth.uid()
            WHERE platform = p_plat;
        END LOOP;
    END IF;

    -- Update placements
    IF p_placements IS NOT NULL AND jsonb_typeof(p_placements) = 'array' THEN
        FOR placement_elem IN SELECT * FROM jsonb_array_elements(p_placements)
        LOOP
            p_key := placement_elem->>'placement_key';
            p_plat := placement_elem->>'platform';
            p_fmt := placement_elem->>'ad_format';
            p_unit := placement_elem->>'ad_unit_id';
            p_en := COALESCE((placement_elem->>'enabled')::BOOLEAN, false);

            IF p_unit IS NOT NULL AND length(trim(p_unit)) > 0 THEN
                PERFORM public.validate_admob_format(p_unit, 'ad_unit_id');
            END IF;

            -- If enabled is set to true, require a valid ad_unit_id
            IF p_en AND (p_unit IS NULL OR length(trim(p_unit)) = 0) THEN
                RAISE EXCEPTION 'Placement % for % cannot be enabled without a valid Ad Unit ID', p_key, p_plat;
            END IF;

            p_min_int := (placement_elem->>'min_interval_seconds')::INT;
            p_max_imp := (placement_elem->>'max_impressions_per_session')::INT;
            p_min_nav := (placement_elem->>'min_navigation_events')::INT;
            p_grace := (placement_elem->>'first_session_grace_seconds')::INT;

            INSERT INTO public.ad_placements (
                placement_key,
                platform,
                ad_format,
                ad_unit_id,
                enabled,
                min_interval_seconds,
                max_impressions_per_session,
                min_navigation_events,
                first_session_grace_seconds,
                updated_at,
                updated_by
            )
            VALUES (
                p_key,
                p_plat,
                p_fmt,
                NULLIF(trim(p_unit), ''),
                p_en,
                p_min_int,
                p_max_imp,
                p_min_nav,
                p_grace,
                now(),
                auth.uid()
            )
            ON CONFLICT (placement_key, platform) DO UPDATE
            SET ad_format = EXCLUDED.ad_format,
                ad_unit_id = EXCLUDED.ad_unit_id,
                enabled = EXCLUDED.enabled,
                min_interval_seconds = EXCLUDED.min_interval_seconds,
                max_impressions_per_session = EXCLUDED.max_impressions_per_session,
                min_navigation_events = EXCLUDED.min_navigation_events,
                first_session_grace_seconds = EXCLUDED.first_session_grace_seconds,
                updated_at = now(),
                updated_by = auth.uid();
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'config_version', new_version,
        'updated_at', now()
    );
END;
$$;

-- 7. RPC: Public Mobile Safe Monetization Configuration
CREATE OR REPLACE FUNCTION public.get_public_monetization_config(
    p_platform VARCHAR DEFAULT 'android'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    global_enabled BOOLEAN := false;
    plat_enabled BOOLEAN := false;
    current_version INT := 1;
    placements_obj JSONB := '{}'::jsonb;
    rec RECORD;
    target_platform VARCHAR := LOWER(TRIM(p_platform));
BEGIN
    IF target_platform NOT IN ('android', 'ios') THEN
        target_platform := 'android';
    END IF;

    -- Fetch global switch & version
    SELECT enabled, config_version INTO global_enabled, current_version
    FROM public.ad_settings
    WHERE platform = 'global';

    -- Fetch platform switch
    SELECT enabled INTO plat_enabled
    FROM public.ad_settings
    WHERE platform = target_platform;

    -- Fetch all placements for this platform
    FOR rec IN
        SELECT placement_key, ad_format, ad_unit_id, enabled,
               min_interval_seconds, max_impressions_per_session,
               min_navigation_events, first_session_grace_seconds
        FROM public.ad_placements
        WHERE platform = target_platform
    LOOP
        placements_obj := jsonb_set(
            placements_obj,
            ARRAY[rec.placement_key],
            jsonb_build_object(
                'format', rec.ad_format,
                'ad_unit_id', COALESCE(rec.ad_unit_id, ''),
                'enabled', (global_enabled AND COALESCE(plat_enabled, false) AND rec.enabled AND (rec.ad_unit_id IS NOT NULL)),
                'min_interval_seconds', COALESCE(rec.min_interval_seconds, 180),
                'max_impressions_per_session', COALESCE(rec.max_impressions_per_session, 3),
                'min_navigation_events', COALESCE(rec.min_navigation_events, 4),
                'first_session_grace_seconds', COALESCE(rec.first_session_grace_seconds, 60)
            )
        );
    END LOOP;

    -- Strictly return sanitized runtime config (NO desired_app_id, NO updated_by, NO secrets)
    RETURN jsonb_build_object(
        'version', COALESCE(current_version, 1),
        'global_enabled', COALESCE(global_enabled, false),
        'platform_enabled', COALESCE(plat_enabled, false),
        'ads_active', (COALESCE(global_enabled, false) AND COALESCE(plat_enabled, false)),
        'placements', placements_obj
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_public_monetization_config(VARCHAR) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_monetization_config(BOOLEAN, JSONB, JSONB, INT) TO authenticated;

-- 8. Seed Initial Data with Safe Defaults (Disabled by default, standard test IDs available)
INSERT INTO public.ad_settings (platform, enabled, desired_app_id, config_version)
VALUES
    ('global', false, NULL, 1),
    ('android', false, 'ca-app-pub-3940256099942544~3347511713', 1),
    ('ios', false, 'ca-app-pub-3940256099942544~1458002511', 1)
ON CONFLICT (platform) DO NOTHING;

INSERT INTO public.ad_placements (
    placement_key, platform, ad_format, ad_unit_id, enabled,
    min_interval_seconds, max_impressions_per_session, min_navigation_events, first_session_grace_seconds
)
VALUES
    -- Home feed banner
    ('home_feed_banner', 'android', 'banner', 'ca-app-pub-3940256099942544/6300978111', false, NULL, NULL, NULL, NULL),
    ('home_feed_banner', 'ios', 'banner', 'ca-app-pub-3940256099942544/2934735716', false, NULL, NULL, NULL, NULL),

    -- Prompt details banner
    ('prompt_details_banner', 'android', 'banner', 'ca-app-pub-3940256099942544/6300978111', false, NULL, NULL, NULL, NULL),
    ('prompt_details_banner', 'ios', 'banner', 'ca-app-pub-3940256099942544/2934735716', false, NULL, NULL, NULL, NULL),

    -- Navigation interstitial
    ('navigation_interstitial', 'android', 'interstitial', 'ca-app-pub-3940256099942544/1033173712', false, 180, 3, 4, 60),
    ('navigation_interstitial', 'ios', 'interstitial', 'ca-app-pub-3940256099942544/4411468910', false, 180, 3, 4, 60)
ON CONFLICT (placement_key, platform) DO NOTHING;

