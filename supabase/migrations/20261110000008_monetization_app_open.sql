-- Migration: 20261110000008_monetization_app_open.sql
-- Description: Extend monetization schema with AdMob App Open ads support

-- 1. Update check constraints on ad_placements for placement_key and ad_format
ALTER TABLE public.ad_placements DROP CONSTRAINT IF EXISTS ad_placements_placement_key_check;
ALTER TABLE public.ad_placements ADD CONSTRAINT ad_placements_placement_key_check
    CHECK (placement_key IN ('home_feed_banner', 'prompt_details_banner', 'navigation_interstitial', 'app_open'));

ALTER TABLE public.ad_placements DROP CONSTRAINT IF EXISTS ad_placements_ad_format_check;
ALTER TABLE public.ad_placements ADD CONSTRAINT ad_placements_ad_format_check
    CHECK (ad_format IN ('banner', 'interstitial', 'app_open'));

-- 2. Add app_open specific frequency/trigger configuration columns
ALTER TABLE public.ad_placements
    ADD COLUMN IF NOT EXISTS show_on_cold_start BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS show_on_foreground_return BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS min_background_seconds INT CHECK (min_background_seconds IS NULL OR (min_background_seconds >= 5 AND min_background_seconds <= 3600)),
    ADD COLUMN IF NOT EXISTS skip_first_n_launches INT CHECK (skip_first_n_launches IS NULL OR (skip_first_n_launches >= 1 AND skip_first_n_launches <= 100));

-- 3. Update save_monetization_config RPC
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
    p_cold_start BOOLEAN;
    p_foreground_return BOOLEAN;
    p_min_bg INT;
    p_skip_launches INT;
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

            p_cold_start := COALESCE((placement_elem->>'show_on_cold_start')::BOOLEAN, true);
            p_foreground_return := COALESCE((placement_elem->>'show_on_foreground_return')::BOOLEAN, true);
            p_min_bg := (placement_elem->>'min_background_seconds')::INT;
            p_skip_launches := (placement_elem->>'skip_first_n_launches')::INT;

            -- Extra validation for app_open placement
            IF p_key = 'app_open' THEN
                IF p_skip_launches IS NOT NULL AND p_skip_launches < 1 THEN
                    RAISE EXCEPTION 'skip_first_n_launches must be at least 1 to prevent first-ever-launch ads';
                END IF;
                IF p_min_bg IS NOT NULL AND (p_min_bg < 5 OR p_min_bg > 3600) THEN
                    RAISE EXCEPTION 'min_background_seconds must be between 5 and 3600 seconds';
                END IF;
            END IF;

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
                show_on_cold_start,
                show_on_foreground_return,
                min_background_seconds,
                skip_first_n_launches,
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
                p_cold_start,
                p_foreground_return,
                p_min_bg,
                p_skip_launches,
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
                show_on_cold_start = EXCLUDED.show_on_cold_start,
                show_on_foreground_return = EXCLUDED.show_on_foreground_return,
                min_background_seconds = EXCLUDED.min_background_seconds,
                skip_first_n_launches = EXCLUDED.skip_first_n_launches,
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

-- 4. Update get_public_monetization_config RPC
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
    placement_data JSONB;
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
               min_navigation_events, first_session_grace_seconds,
               show_on_cold_start, show_on_foreground_return,
               min_background_seconds, skip_first_n_launches
        FROM public.ad_placements
        WHERE platform = target_platform
    LOOP
        placement_data := jsonb_build_object(
            'format', rec.ad_format,
            'ad_unit_id', COALESCE(rec.ad_unit_id, ''),
            'enabled', (global_enabled AND COALESCE(plat_enabled, false) AND rec.enabled AND (rec.ad_unit_id IS NOT NULL))
        );

        IF rec.ad_format = 'interstitial' THEN
            placement_data := placement_data || jsonb_build_object(
                'min_interval_seconds', COALESCE(rec.min_interval_seconds, 180),
                'max_impressions_per_session', COALESCE(rec.max_impressions_per_session, 3),
                'min_navigation_events', COALESCE(rec.min_navigation_events, 4),
                'first_session_grace_seconds', COALESCE(rec.first_session_grace_seconds, 60)
            );
        ELSIF rec.ad_format = 'app_open' THEN
            placement_data := placement_data || jsonb_build_object(
                'cooldown_seconds', COALESCE(rec.min_interval_seconds, 300),
                'min_interval_seconds', COALESCE(rec.min_interval_seconds, 300),
                'max_impressions_per_session', COALESCE(rec.max_impressions_per_session, 2),
                'show_on_cold_start', COALESCE(rec.show_on_cold_start, true),
                'show_on_foreground_return', COALESCE(rec.show_on_foreground_return, true),
                'min_background_seconds', COALESCE(rec.min_background_seconds, 60),
                'skip_first_n_launches', COALESCE(rec.skip_first_n_launches, 2)
            );
        END IF;

        placements_obj := jsonb_set(
            placements_obj,
            ARRAY[rec.placement_key],
            placement_data
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

-- 5. Seed app_open placements for Android and iOS
INSERT INTO public.ad_placements (
    placement_key, platform, ad_format, ad_unit_id, enabled,
    min_interval_seconds, max_impressions_per_session,
    show_on_cold_start, show_on_foreground_return, min_background_seconds, skip_first_n_launches
)
VALUES
    ('app_open', 'android', 'app_open', 'ca-app-pub-3940256099942544/9257390708', false, 300, 2, true, true, 60, 2),
    ('app_open', 'ios', 'app_open', 'ca-app-pub-3940256099942544/5575463023', false, 300, 2, true, true, 60, 2)
ON CONFLICT (placement_key, platform) DO UPDATE
SET ad_format = EXCLUDED.ad_format,
    show_on_cold_start = COALESCE(public.ad_placements.show_on_cold_start, EXCLUDED.show_on_cold_start),
    show_on_foreground_return = COALESCE(public.ad_placements.show_on_foreground_return, EXCLUDED.show_on_foreground_return),
    min_background_seconds = COALESCE(public.ad_placements.min_background_seconds, EXCLUDED.min_background_seconds),
    skip_first_n_launches = COALESCE(public.ad_placements.skip_first_n_launches, EXCLUDED.skip_first_n_launches);
