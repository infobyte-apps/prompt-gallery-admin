-- Migration: 20261109000006_mobile_app_settings.sql
-- Description: Mobile App Settings module with draft/published workflow, versioning, rollback, and public mobile endpoint

-- 1. Create app_settings table
CREATE TABLE IF NOT EXISTS public.app_settings (
    environment VARCHAR(50) PRIMARY KEY DEFAULT 'production',
    draft_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    published_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    previous_published_config JSONB,
    version INT NOT NULL DEFAULT 1,
    draft_updated_at TIMESTAMPTZ DEFAULT now(),
    draft_updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,
    published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Authenticated staff (Super Admin, Publisher, Editor, Viewer) can view settings in the admin panel
DROP POLICY IF EXISTS "staff_view_app_settings" ON public.app_settings;
CREATE POLICY "staff_view_app_settings"
    ON public.app_settings
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_members
            WHERE admin_members.user_id = auth.uid()
        )
    );

-- Only Super Admin can mutate app_settings directly
DROP POLICY IF EXISTS "super_admin_manage_app_settings" ON public.app_settings;
CREATE POLICY "super_admin_manage_app_settings"
    ON public.app_settings
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

-- 4. Server-Side Validation Function
CREATE OR REPLACE FUNCTION public.validate_mobile_app_config(cfg JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    support_email TEXT;
    privacy_url TEXT;
    play_store_url TEXT;
    is_blocking BOOLEAN;
BEGIN
    IF cfg IS NULL OR jsonb_typeof(cfg) != 'object' THEN
        RAISE EXCEPTION 'Settings configuration must be a valid JSON object';
    END IF;

    -- Validate support email if provided
    support_email := cfg->'links_support'->>'support_email';
    IF support_email IS NOT NULL AND length(trim(support_email)) > 0 THEN
        IF support_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
            RAISE EXCEPTION 'Invalid support email address format: %', support_email;
        END IF;
    END IF;

    -- Validate URLs must use HTTPS if provided
    privacy_url := cfg->'links_support'->>'privacy_policy_url';
    IF privacy_url IS NOT NULL AND length(trim(privacy_url)) > 0 AND privacy_url !~* '^https://' THEN
        RAISE EXCEPTION 'Privacy policy URL must use secure HTTPS scheme';
    END IF;

    play_store_url := cfg->'links_support'->>'play_store_url';
    IF play_store_url IS NOT NULL AND length(trim(play_store_url)) > 0 AND play_store_url !~* '^(https://|market://)' THEN
        RAISE EXCEPTION 'Play Store URL must use HTTPS or market:// scheme';
    END IF;

    -- Check blocking update rule: blocking update requires valid store link
    is_blocking := COALESCE((cfg->'maintenance'->'update_notice'->>'is_blocking')::BOOLEAN, false);
    IF is_blocking THEN
        IF play_store_url IS NULL OR length(trim(play_store_url)) = 0 THEN
            RAISE EXCEPTION 'A blocking update requires a valid Play Store URL before publishing';
        END IF;
    END IF;

    RETURN TRUE;
END;
$$;

-- 5. RPC: Save Mobile App Settings Draft (Super Admin only, concurrency protected)
CREATE OR REPLACE FUNCTION public.save_mobile_app_settings_draft(
    p_draft JSONB,
    p_expected_version INT,
    p_env VARCHAR DEFAULT 'production'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_role VARCHAR(20);
    current_row public.app_settings%ROWTYPE;
BEGIN
    -- Check caller is super_admin
    SELECT role INTO caller_role FROM public.admin_members WHERE user_id = auth.uid();
    IF caller_role != 'super_admin' THEN
        RAISE EXCEPTION 'Permission denied: Only Super Admin can save Mobile App Settings drafts';
    END IF;

    -- Lock and retrieve current settings row
    SELECT * INTO current_row FROM public.app_settings WHERE environment = p_env FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Environment % not found in app_settings', p_env;
    END IF;

    -- Concurrency version check
    IF current_row.version != p_expected_version THEN
        RAISE EXCEPTION 'Concurrency conflict: Settings have been modified by another administrator (version % vs expected %)', current_row.version, p_expected_version;
    END IF;

    -- Update draft
    UPDATE public.app_settings
    SET draft_config = p_draft,
        draft_updated_at = now(),
        draft_updated_by = auth.uid()
    WHERE environment = p_env
    RETURNING * INTO current_row;

    RETURN to_jsonb(current_row);
END;
$$;

-- 6. RPC: Publish Mobile App Settings (Super Admin only, validated, atomic version bump)
CREATE OR REPLACE FUNCTION public.publish_mobile_app_settings(
    p_expected_version INT,
    p_env VARCHAR DEFAULT 'production'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_role VARCHAR(20);
    current_row public.app_settings%ROWTYPE;
BEGIN
    SELECT role INTO caller_role FROM public.admin_members WHERE user_id = auth.uid();
    IF caller_role != 'super_admin' THEN
        RAISE EXCEPTION 'Permission denied: Only Super Admin can publish Mobile App Settings';
    END IF;

    SELECT * INTO current_row FROM public.app_settings WHERE environment = p_env FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Environment % not found in app_settings', p_env;
    END IF;

    IF current_row.version != p_expected_version THEN
        RAISE EXCEPTION 'Concurrency conflict: Settings have changed (version % vs expected %)', current_row.version, p_expected_version;
    END IF;

    -- Validate draft before publishing
    PERFORM public.validate_mobile_app_config(current_row.draft_config);

    -- Atomic publish: backup published, apply draft, bump version
    UPDATE public.app_settings
    SET previous_published_config = current_row.published_config,
        published_config = current_row.draft_config,
        version = current_row.version + 1,
        published_at = now(),
        published_by = auth.uid()
    WHERE environment = p_env
    RETURNING * INTO current_row;

    RETURN to_jsonb(current_row);
END;
$$;

-- 7. RPC: Restore Previous Published Mobile App Settings (Super Admin only)
CREATE OR REPLACE FUNCTION public.restore_mobile_app_settings(
    p_expected_version INT,
    p_env VARCHAR DEFAULT 'production'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_role VARCHAR(20);
    current_row public.app_settings%ROWTYPE;
BEGIN
    SELECT role INTO caller_role FROM public.admin_members WHERE user_id = auth.uid();
    IF caller_role != 'super_admin' THEN
        RAISE EXCEPTION 'Permission denied: Only Super Admin can restore Mobile App Settings';
    END IF;

    SELECT * INTO current_row FROM public.app_settings WHERE environment = p_env FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Environment % not found in app_settings', p_env;
    END IF;

    IF current_row.version != p_expected_version THEN
        RAISE EXCEPTION 'Concurrency conflict: Settings have changed (version % vs expected %)', current_row.version, p_expected_version;
    END IF;

    IF current_row.previous_published_config IS NULL THEN
        RAISE EXCEPTION 'No previous published settings snapshot available to restore';
    END IF;

    -- Restore previous snapshot to both draft and published, and increment version
    UPDATE public.app_settings
    SET draft_config = current_row.previous_published_config,
        published_config = current_row.previous_published_config,
        version = current_row.version + 1,
        published_at = now(),
        published_by = auth.uid()
    WHERE environment = p_env
    RETURNING * INTO current_row;

    RETURN to_jsonb(current_row);
END;
$$;

-- 8. RPC: Public Mobile Safe Settings (Narrowly scoped, public/anon callable)
CREATE OR REPLACE FUNCTION public.get_public_mobile_settings(
    p_env VARCHAR DEFAULT 'production'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    rec RECORD;
    clean_config JSONB;
    play_store_url TEXT;
    share_url TEXT;
BEGIN
    SELECT published_config, version, published_at
    INTO rec
    FROM public.app_settings
    WHERE environment = p_env;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'version', 1,
            'status', 'fallback',
            'config', '{}'::jsonb
        );
    END IF;

    clean_config := rec.published_config;

    -- Share App URL fallback: If share_url is empty, fall back to play_store_url
    play_store_url := clean_config->'links_support'->>'play_store_url';
    share_url := clean_config->'links_support'->>'share_url';

    IF (share_url IS NULL OR length(trim(share_url)) = 0) AND play_store_url IS NOT NULL THEN
        clean_config := jsonb_set(
            clean_config,
            '{links_support,share_url}',
            to_jsonb(play_store_url)
        );
    END IF;

    -- Return strictly public-safe output (no drafts, no audit user IDs, no secrets)
    RETURN jsonb_build_object(
        'version', rec.version,
        'published_at', rec.published_at,
        'config', clean_config
    );
END;
$$;

-- Grant execution to anon and authenticated
GRANT EXECUTE ON FUNCTION public.get_public_mobile_settings(VARCHAR) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_mobile_app_settings_draft(JSONB, INT, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_mobile_app_settings(INT, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_mobile_app_settings(INT, VARCHAR) TO authenticated;

-- 9. Seed Safe Initial Defaults (No fake URLs, actual structure)
INSERT INTO public.app_settings (
    environment,
    draft_config,
    published_config,
    previous_published_config,
    version,
    published_at
)
VALUES (
    'production',
    '{
        "links_support": {
            "privacy_policy_url": "",
            "support_email": "",
            "support_page_url": "",
            "website_url": "",
            "play_store_url": "",
            "share_url": "",
            "share_message": "Explore inspiring AI image and video prompts on Prompt Gallery!",
            "social_links": [
                { "id": "x", "label": "X / Twitter", "url": "", "is_visible": false },
                { "id": "discord", "label": "Discord", "url": "", "is_visible": false },
                { "id": "instagram", "label": "Instagram", "url": "", "is_visible": false }
            ],
            "visible_more_links": {
                "privacy_policy": true,
                "terms": false,
                "website": false,
                "support": true,
                "share_app": true,
                "rate_app": true
            }
        },
        "home_discover": {
            "sections": [
                { "id": "featured", "type": "collection", "title": "Featured Prompts", "is_visible": true, "order": 1 },
                { "id": "trending", "type": "collection", "title": "Trending Now", "is_visible": true, "order": 2 },
                { "id": "new_prompts", "type": "recent", "title": "New Prompts", "is_visible": true, "order": 3 }
            ]
        },
        "app_experience": {
            "app_name": "Prompt Gallery",
            "tagline": "Curated AI Prompts for Creators",
            "banner": {
                "enabled": false,
                "text": "",
                "source_type": "imagekit",
                "image_url": "",
                "imagekit_file_id": null,
                "action_url": ""
            },
            "features": {
                "video_prompts": false,
                "favorite_prompts": true,
                "copy_prompt_action": true
            }
        },
        "maintenance": {
            "is_enabled": false,
            "title": "Scheduled Maintenance",
            "message": "We are currently optimizing Prompt Gallery. We will be back online shortly.",
            "update_notice": {
                "is_enabled": false,
                "is_blocking": false,
                "title": "New Version Available",
                "message": "A new version of Prompt Gallery is available on Google Play.",
                "min_build_number": 1,
                "cta_label": "Update Now"
            }
        }
    }'::jsonb,
    '{
        "links_support": {
            "privacy_policy_url": "",
            "support_email": "",
            "support_page_url": "",
            "website_url": "",
            "play_store_url": "",
            "share_url": "",
            "share_message": "Explore inspiring AI image and video prompts on Prompt Gallery!",
            "social_links": [
                { "id": "x", "label": "X / Twitter", "url": "", "is_visible": false },
                { "id": "discord", "label": "Discord", "url": "", "is_visible": false },
                { "id": "instagram", "label": "Instagram", "url": "", "is_visible": false }
            ],
            "visible_more_links": {
                "privacy_policy": true,
                "terms": false,
                "website": false,
                "support": true,
                "share_app": true,
                "rate_app": true
            }
        },
        "home_discover": {
            "sections": [
                { "id": "featured", "type": "collection", "title": "Featured Prompts", "is_visible": true, "order": 1 },
                { "id": "trending", "type": "collection", "title": "Trending Now", "is_visible": true, "order": 2 },
                { "id": "new_prompts", "type": "recent", "title": "New Prompts", "is_visible": true, "order": 3 }
            ]
        },
        "app_experience": {
            "app_name": "Prompt Gallery",
            "tagline": "Curated AI Prompts for Creators",
            "banner": {
                "enabled": false,
                "text": "",
                "source_type": "imagekit",
                "image_url": "",
                "imagekit_file_id": null,
                "action_url": ""
            },
            "features": {
                "video_prompts": false,
                "favorite_prompts": true,
                "copy_prompt_action": true
            }
        },
        "maintenance": {
            "is_enabled": false,
            "title": "Scheduled Maintenance",
            "message": "We are currently optimizing Prompt Gallery. We will be back online shortly.",
            "update_notice": {
                "is_enabled": false,
                "is_blocking": false,
                "title": "New Version Available",
                "message": "A new version of Prompt Gallery is available on Google Play.",
                "min_build_number": 1,
                "cta_label": "Update Now"
            }
        }
    }'::jsonb,
    NULL,
    1,
    now()
)
ON CONFLICT (environment) DO NOTHING;

