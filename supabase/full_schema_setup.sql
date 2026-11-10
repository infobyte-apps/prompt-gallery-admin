-- =========================================================================
-- PROMPT GALLERY ADMIN PANEL · COMPLETE DATABASE & STORAGE SETUP
-- Project: nwpwnxcxpwwzajvqyygf (https://nwpwnxcxpwwzajvqyygf.supabase.co)
-- Execute this script in: https://supabase.com/dashboard/project/nwpwnxcxpwwzajvqyygf/sql/new
-- =========================================================================

-- -------------------------------------------------------------------------
-- PART 1: EXTENSIONS & APP TABLES
-- -------------------------------------------------------------------------
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

-- Composite FK for cover_media_id on prompts
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

-- Indexes for public feeds and reverse lookups
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
CREATE OR REPLACE FUNCTION public.validate_prompt_publish()
RETURNS TRIGGER AS $$
DECLARE
    v_cover_duration INT;
    v_cover_preview TEXT;
BEGIN
    IF NEW.status = 'published' THEN
        IF NEW.cover_media_id IS NULL THEN
            RAISE EXCEPTION 'A published prompt must have an assigned cover_media_id';
        END IF;

        SELECT duration_ms, preview_path INTO v_cover_duration, v_cover_preview
        FROM public.prompt_media
        WHERE id = NEW.cover_media_id AND prompt_id = NEW.id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Cover media does not exist or does not belong to this prompt';
        END IF;

        IF NEW.media_type = 'video' THEN
            IF v_cover_duration IS NULL OR v_cover_duration <= 0 THEN
                RAISE EXCEPTION 'Published video prompt requires valid positive duration_ms';
            END IF;
            IF v_cover_preview IS NULL OR char_length(trim(v_cover_preview)) = 0 THEN
                RAISE EXCEPTION 'Published video prompt requires preview/poster image path';
            END IF;
        END IF;

        IF OLD IS NULL OR OLD.published_at IS NULL THEN
            NEW.published_at = timezone('utc'::text, now());
        ELSE
            NEW.published_at = OLD.published_at;
        END IF;
    END IF;

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

-- Protect last super_admin trigger
CREATE OR REPLACE FUNCTION public.protect_last_super_admin()
RETURNS TRIGGER AS $$
DECLARE
    v_count INT;
BEGIN
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

-- Bootstrap First Super Admin RPC
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
GRANT EXECUTE ON FUNCTION public.bootstrap_first_super_admin(UUID) TO service_role, authenticated, anon;

-- -------------------------------------------------------------------------
-- PART 2: ROW LEVEL SECURITY (RLS) POLICIES
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_role()
RETURNS TEXT AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role FROM public.admin_members WHERE user_id = auth.uid();
    RETURN v_role;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (SELECT role = 'super_admin' FROM public.admin_members WHERE user_id = auth.uid());
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_publisher_or_above()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (SELECT role IN ('super_admin', 'publisher') FROM public.admin_members WHERE user_id = auth.uid());
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_editor_or_above()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (SELECT role IN ('super_admin', 'publisher', 'editor') FROM public.admin_members WHERE user_id = auth.uid());
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin_member()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.admin_members WHERE user_id = auth.uid());
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

ALTER TABLE public.admin_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_items ENABLE ROW LEVEL SECURITY;

-- Grants for PostgREST Data API exposure
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Policies on admin_members
CREATE POLICY "admin_members_select_policy" ON public.admin_members FOR SELECT TO authenticated USING (public.is_admin_member());
CREATE POLICY "admin_members_insert_policy" ON public.admin_members FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY "admin_members_update_policy" ON public.admin_members FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "admin_members_delete_policy" ON public.admin_members FOR DELETE TO authenticated USING (public.is_super_admin());

-- Policies on prompts
CREATE POLICY "prompts_select_admin" ON public.prompts FOR SELECT TO authenticated USING (public.is_admin_member());
CREATE POLICY "prompts_select_public" ON public.prompts FOR SELECT TO anon USING (status = 'published');
CREATE POLICY "prompts_insert_editor_above" ON public.prompts FOR INSERT TO authenticated WITH CHECK (public.is_publisher_or_above() OR (public.is_editor_or_above() AND status = 'draft'));
CREATE POLICY "prompts_update_editor_above" ON public.prompts FOR UPDATE TO authenticated USING (public.is_publisher_or_above() OR (public.is_editor_or_above() AND status = 'draft')) WITH CHECK (public.is_publisher_or_above() OR (public.is_editor_or_above() AND status = 'draft'));
CREATE POLICY "prompts_delete_publisher_above" ON public.prompts FOR DELETE TO authenticated USING (public.is_publisher_or_above() AND status IN ('draft', 'archived'));

-- Policies on prompt_media
CREATE POLICY "prompt_media_select_admin" ON public.prompt_media FOR SELECT TO authenticated USING (public.is_admin_member());
CREATE POLICY "prompt_media_select_public" ON public.prompt_media FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM public.prompts WHERE prompts.id = prompt_media.prompt_id AND prompts.status = 'published'));
CREATE POLICY "prompt_media_insert_policy" ON public.prompt_media FOR INSERT TO authenticated WITH CHECK (public.is_publisher_or_above() OR (public.is_editor_or_above() AND EXISTS (SELECT 1 FROM public.prompts WHERE prompts.id = prompt_media.prompt_id AND prompts.status = 'draft')));
CREATE POLICY "prompt_media_update_policy" ON public.prompt_media FOR UPDATE TO authenticated USING (public.is_publisher_or_above() OR (public.is_editor_or_above() AND EXISTS (SELECT 1 FROM public.prompts WHERE prompts.id = prompt_media.prompt_id AND prompts.status = 'draft')));
CREATE POLICY "prompt_media_delete_policy" ON public.prompt_media FOR DELETE TO authenticated USING (public.is_publisher_or_above() OR (public.is_editor_or_above() AND EXISTS (SELECT 1 FROM public.prompts WHERE prompts.id = prompt_media.prompt_id AND prompts.status = 'draft')));

-- Categories & Tags
CREATE POLICY "categories_select_admin" ON public.categories FOR SELECT TO authenticated USING (public.is_admin_member());
CREATE POLICY "categories_select_public" ON public.categories FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "categories_insert_publisher" ON public.categories FOR INSERT TO authenticated WITH CHECK (public.is_publisher_or_above());
CREATE POLICY "categories_update_publisher" ON public.categories FOR UPDATE TO authenticated USING (public.is_publisher_or_above()) WITH CHECK (public.is_publisher_or_above());
CREATE POLICY "categories_delete_publisher" ON public.categories FOR DELETE TO authenticated USING (public.is_publisher_or_above());

CREATE POLICY "prompt_categories_select_admin" ON public.prompt_categories FOR SELECT TO authenticated USING (public.is_admin_member());
CREATE POLICY "prompt_categories_select_public" ON public.prompt_categories FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM public.prompts WHERE prompts.id = prompt_categories.prompt_id AND prompts.status = 'published'));
CREATE POLICY "prompt_categories_write_policy" ON public.prompt_categories FOR ALL TO authenticated USING (public.is_publisher_or_above() OR (public.is_editor_or_above() AND EXISTS (SELECT 1 FROM public.prompts WHERE prompts.id = prompt_categories.prompt_id AND prompts.status = 'draft')));

CREATE POLICY "tags_select_all" ON public.tags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "tags_insert_publisher" ON public.tags FOR INSERT TO authenticated WITH CHECK (public.is_publisher_or_above());
CREATE POLICY "tags_update_publisher" ON public.tags FOR UPDATE TO authenticated USING (public.is_publisher_or_above());
CREATE POLICY "tags_delete_publisher" ON public.tags FOR DELETE TO authenticated USING (public.is_publisher_or_above());

CREATE POLICY "prompt_tags_select_admin" ON public.prompt_tags FOR SELECT TO authenticated USING (public.is_admin_member());
CREATE POLICY "prompt_tags_select_public" ON public.prompt_tags FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM public.prompts WHERE prompts.id = prompt_tags.prompt_id AND prompts.status = 'published'));
CREATE POLICY "prompt_tags_write_policy" ON public.prompt_tags FOR ALL TO authenticated USING (public.is_publisher_or_above() OR (public.is_editor_or_above() AND EXISTS (SELECT 1 FROM public.prompts WHERE prompts.id = prompt_tags.prompt_id AND prompts.status = 'draft')));

-- Collections
CREATE POLICY "collections_select_admin" ON public.collections FOR SELECT TO authenticated USING (public.is_admin_member());
CREATE POLICY "collections_select_public" ON public.collections FOR SELECT TO anon USING (status = 'published');
CREATE POLICY "collections_write_publisher" ON public.collections FOR ALL TO authenticated USING (public.is_publisher_or_above()) WITH CHECK (public.is_publisher_or_above());

CREATE POLICY "collection_items_select_admin" ON public.collection_items FOR SELECT TO authenticated USING (public.is_admin_member());
CREATE POLICY "collection_items_select_public" ON public.collection_items FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM public.collections WHERE collections.id = collection_items.collection_id AND collections.status = 'published'));
CREATE POLICY "collection_items_write_publisher" ON public.collection_items FOR ALL TO authenticated USING (public.is_publisher_or_above()) WITH CHECK (public.is_publisher_or_above());

-- -------------------------------------------------------------------------
-- PART 3: STORAGE BUCKETS & STORAGE POLICIES
-- -------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('delivery-media', 'delivery-media', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']),
    ('draft-media', 'draft-media', false, 104857600, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'])
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "delivery_media_public_select" ON storage.objects FOR SELECT TO public USING (bucket_id = 'delivery-media');
CREATE POLICY "delivery_media_publisher_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'delivery-media' AND public.is_publisher_or_above());
CREATE POLICY "delivery_media_publisher_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'delivery-media' AND public.is_publisher_or_above());
CREATE POLICY "delivery_media_publisher_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'delivery-media' AND public.is_publisher_or_above());

CREATE POLICY "draft_media_admin_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'draft-media' AND public.is_admin_member());
CREATE POLICY "draft_media_editor_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'draft-media' AND public.is_editor_or_above());
CREATE POLICY "draft_media_editor_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'draft-media' AND public.is_editor_or_above());
CREATE POLICY "draft_media_editor_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'draft-media' AND public.is_editor_or_above());

-- -------------------------------------------------------------------------
-- PART 4: SYSTEM SEED DATA (Featured, Trending, Categories & Tags)
-- -------------------------------------------------------------------------
INSERT INTO public.collections (slug, title, status, sort_order)
VALUES
    ('featured', 'Featured Prompts', 'published', 1),
    ('trending', 'Trending Prompts', 'published', 2)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.categories (slug, name, sort_order, is_active)
VALUES
    ('ai-art', 'AI Art & Concept', 1, true),
    ('photography', 'Cinematic & Photography', 2, true),
    ('graphic-design', 'Graphic & UI Design', 3, true),
    ('architecture', 'Architecture & Interior', 4, true),
    ('character-design', 'Character Design', 5, true),
    ('anime-manga', 'Anime & Illustration', 6, true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.tags (slug, name)
VALUES
    ('photorealistic', 'Photorealistic'),
    ('cyberpunk', 'Cyberpunk'),
    ('isometric', 'Isometric'),
    ('minimalist', 'Minimalist'),
    ('surrealism', 'Surrealism'),
    ('midjourney-v6', 'Midjourney v6'),
    ('flux-1', 'FLUX.1'),
    ('stable-diffusion', 'Stable Diffusion'),
    ('8k', '8K Resolution'),
    ('volumetric-lighting', 'Volumetric Lighting')
ON CONFLICT (slug) DO NOTHING;

