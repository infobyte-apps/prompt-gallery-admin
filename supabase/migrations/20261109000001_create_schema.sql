-- Migration: 20261109000001_create_schema.sql
-- Description: Creates the 9 core tables, constraints, composite FKs, triggers, and RPCs for Prompt Gallery

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Prompts Table
CREATE TABLE IF NOT EXISTS public.prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    prompt_text TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    cover_media_id UUID,
    published_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT prompts_slug_key UNIQUE (slug),
    CONSTRAINT prompts_title_nonempty CHECK (char_length(trim(title)) > 0),
    CONSTRAINT prompts_prompt_text_nonempty CHECK (char_length(trim(prompt_text)) > 0)
);

-- 2. Prompt Media Table
CREATE TABLE IF NOT EXISTS public.prompt_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_id UUID NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    thumbnail_path TEXT,
    preview_path TEXT,
    alt_text TEXT,
    width INT CHECK (width IS NULL OR width > 0),
    height INT CHECK (height IS NULL OR height > 0),
    byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
    duration_ms INT CHECK (duration_ms IS NULL OR duration_ms > 0),
    sort_order INT NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT prompt_media_prompt_id_id_key UNIQUE (prompt_id, id)
);

-- Add composite FK for cover_media_id on prompts to ensure ownership
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'prompts_cover_media_fkey'
    ) THEN
        ALTER TABLE public.prompts
        ADD CONSTRAINT prompts_cover_media_fkey
        FOREIGN KEY (id, cover_media_id)
        REFERENCES public.prompt_media(prompt_id, id)
        ON DELETE RESTRICT;
    END IF;
END $$;

-- 3. Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    cover_storage_path TEXT,
    sort_order INT NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT categories_name_nonempty CHECK (char_length(trim(name)) > 0)
);

-- 4. Prompt Categories (Composite PK)
CREATE TABLE IF NOT EXISTS public.prompt_categories (
    prompt_id UUID NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
    PRIMARY KEY (prompt_id, category_id)
);

-- 5. Tags Table
CREATE TABLE IF NOT EXISTS public.tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    CONSTRAINT tags_name_nonempty CHECK (char_length(trim(name)) > 0)
);

-- 6. Prompt Tags (Composite PK)
CREATE TABLE IF NOT EXISTS public.prompt_tags (
    prompt_id UUID NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE RESTRICT,
    PRIMARY KEY (prompt_id, tag_id)
);

-- 7. Collections Table
CREATE TABLE IF NOT EXISTS public.collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    sort_order INT NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT collections_title_nonempty CHECK (char_length(trim(title)) > 0)
);

-- 8. Collection Items Table
CREATE TABLE IF NOT EXISTS public.collection_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
    prompt_id UUID NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
    media_id UUID,
    sort_order INT NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    CONSTRAINT collection_items_unique_prompt_in_col UNIQUE (collection_id, prompt_id),
    CONSTRAINT collection_items_media_fkey
        FOREIGN KEY (prompt_id, media_id)
        REFERENCES public.prompt_media(prompt_id, id)
        ON DELETE SET NULL
);

-- 9. Admin Members Table
CREATE TABLE IF NOT EXISTS public.admin_members (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'publisher', 'editor', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for performance and deterministic sorting
CREATE INDEX IF NOT EXISTS idx_prompts_published_feed 
    ON public.prompts (media_type, published_at DESC, id DESC) 
    WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_prompts_status_updated 
    ON public.prompts (status, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_prompt_media_order 
    ON public.prompt_media (prompt_id, sort_order ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_categories_active_order 
    ON public.categories (sort_order ASC, id ASC) 
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_prompt_categories_cat_lookup 
    ON public.prompt_categories (category_id, prompt_id);

CREATE INDEX IF NOT EXISTS idx_prompt_tags_tag_lookup 
    ON public.prompt_tags (tag_id, prompt_id);

CREATE INDEX IF NOT EXISTS idx_collections_status_order 
    ON public.collections (status, sort_order ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_collection_items_order 
    ON public.collection_items (collection_id, sort_order ASC, id ASC);

-- Automatic updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    IF auth.uid() IS NOT NULL THEN
        NEW.updated_by = auth.uid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_prompts_updated_at ON public.prompts;
CREATE TRIGGER set_prompts_updated_at
    BEFORE UPDATE ON public.prompts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_collections_updated_at ON public.collections;
CREATE TRIGGER set_collections_updated_at
    BEFORE UPDATE ON public.collections
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Populate created_by and updated_by on insert
CREATE OR REPLACE FUNCTION public.handle_created_by()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.uid() IS NOT NULL THEN
        IF NEW.created_by IS NULL THEN
            NEW.created_by = auth.uid();
        END IF;
        NEW.updated_by = auth.uid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_prompts_created_by ON public.prompts;
CREATE TRIGGER set_prompts_created_by
    BEFORE INSERT ON public.prompts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_created_by();

-- Validation Trigger for Publishing Prompts
-- Enforces:
-- 1. Must have valid cover_media_id when status = 'published'
-- 2. First published_at is set once and preserved on edits and republish
-- 3. If video: duration_ms must be positive and media exists
CREATE OR REPLACE FUNCTION public.validate_prompt_publish()
RETURNS TRIGGER AS $$
DECLARE
    v_media_count INT;
    v_cover_duration INT;
    v_cover_preview TEXT;
BEGIN
    IF NEW.status = 'published' THEN
        -- Cover required
        IF NEW.cover_media_id IS NULL THEN
            RAISE EXCEPTION 'A published prompt must have an assigned cover_media_id';
        END IF;

        -- Verify cover details
        SELECT duration_ms, preview_path INTO v_cover_duration, v_cover_preview
        FROM public.prompt_media
        WHERE id = NEW.cover_media_id AND prompt_id = NEW.id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Cover media does not exist or does not belong to this prompt';
        END IF;

        -- Video validation: requires duration and poster/preview
        IF NEW.media_type = 'video' THEN
            IF v_cover_duration IS NULL OR v_cover_duration <= 0 THEN
                RAISE EXCEPTION 'Published video prompt requires valid positive duration_ms';
            END IF;
            IF v_cover_preview IS NULL OR char_length(trim(v_cover_preview)) = 0 THEN
                RAISE EXCEPTION 'Published video prompt requires preview/poster image path';
            END IF;
        END IF;

        -- Set published_at once, preserve existing if previously published
        IF OLD IS NULL OR OLD.published_at IS NULL THEN
            NEW.published_at = timezone('utc'::text, now());
        ELSE
            NEW.published_at = OLD.published_at;
        END IF;
    END IF;

    -- Block removing last cover from published prompt
    IF OLD IS NOT NULL AND OLD.status = 'published' AND NEW.status = 'published' THEN
        IF NEW.cover_media_id IS NULL THEN
            RAISE EXCEPTION 'Cannot remove cover from an already published prompt';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_prompt_publish_trigger ON public.prompts;
CREATE TRIGGER check_prompt_publish_trigger
    BEFORE INSERT OR UPDATE ON public.prompts
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_prompt_publish();

-- Prevent deletion or demotion of the last Super Admin
CREATE OR REPLACE FUNCTION public.protect_last_super_admin()
RETURNS TRIGGER AS $$
DECLARE
    v_count INT;
BEGIN
    -- Acquire an exclusive lock on admin_members to guard concurrent requests
    LOCK TABLE public.admin_members IN EXCLUSIVE MODE;

    IF TG_OP = 'DELETE' THEN
        IF OLD.role = 'super_admin' THEN
            SELECT COUNT(*) INTO v_count FROM public.admin_members WHERE role = 'super_admin' AND user_id <> OLD.user_id;
            IF v_count = 0 THEN
                RAISE EXCEPTION 'Cannot delete the last super_admin member';
            END IF;
        END IF;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.role = 'super_admin' AND NEW.role <> 'super_admin' THEN
            SELECT COUNT(*) INTO v_count FROM public.admin_members WHERE role = 'super_admin' AND user_id <> OLD.user_id;
            IF v_count = 0 THEN
                RAISE EXCEPTION 'Cannot demote the last super_admin member';
            END IF;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS guard_last_super_admin_trigger ON public.admin_members;
CREATE TRIGGER guard_last_super_admin_trigger
    BEFORE UPDATE OR DELETE ON public.admin_members
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_last_super_admin();

-- Bootstrap First Super Admin RPC function
CREATE OR REPLACE FUNCTION public.bootstrap_first_super_admin(operator_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    v_admin_count INT;
BEGIN
    LOCK TABLE public.admin_members IN EXCLUSIVE MODE;

    SELECT COUNT(*) INTO v_admin_count FROM public.admin_members WHERE role = 'super_admin';
    IF v_admin_count > 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Super admin already exists');
    END IF;

    -- Verify user exists in auth.users
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = operator_uuid) THEN
        RETURN jsonb_build_object('success', false, 'message', 'User UUID not found in auth.users');
    END IF;

    INSERT INTO public.admin_members (user_id, role)
    VALUES (operator_uuid, 'super_admin')
    ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';

    RETURN jsonb_build_object('success', true, 'message', 'Super admin bootstrapped successfully', 'user_id', operator_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.bootstrap_first_super_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_super_admin(UUID) TO service_role, authenticated;

