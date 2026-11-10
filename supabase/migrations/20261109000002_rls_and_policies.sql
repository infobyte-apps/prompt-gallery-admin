-- Migration: 20261109000002_rls_and_policies.sql
-- Description: Enables RLS on all tables and creates granular policies for super_admin, publisher, editor, viewer, and public clients

-- Helper functions to get admin status without recursive policy lookups
CREATE OR REPLACE FUNCTION public.get_admin_role()
RETURNS TEXT AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role 
    FROM public.admin_members 
    WHERE user_id = auth.uid();
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

-- 1. Enable RLS on all tables
ALTER TABLE public.admin_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_items ENABLE ROW LEVEL SECURITY;

-- 2. Policies for admin_members
-- Any authenticated admin member can view the team
CREATE POLICY "admin_members_select_policy"
    ON public.admin_members
    FOR SELECT
    TO authenticated
    USING (public.is_admin_member());

-- Only super_admin can insert, update, or delete team members
CREATE POLICY "admin_members_insert_policy"
    ON public.admin_members
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_super_admin());

CREATE POLICY "admin_members_update_policy"
    ON public.admin_members
    FOR UPDATE
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

CREATE POLICY "admin_members_delete_policy"
    ON public.admin_members
    FOR DELETE
    TO authenticated
    USING (public.is_super_admin());

-- 3. Policies for prompts
-- SELECT:
-- Admins can view all prompts. Public can only view published prompts.
CREATE POLICY "prompts_select_admin"
    ON public.prompts
    FOR SELECT
    TO authenticated
    USING (public.is_admin_member());

CREATE POLICY "prompts_select_public"
    ON public.prompts
    FOR SELECT
    TO anon
    USING (status = 'published');

-- INSERT:
-- Publishers and Super Admins can insert any prompt.
-- Editors can insert only drafts.
-- Viewers cannot insert.
CREATE POLICY "prompts_insert_editor_above"
    ON public.prompts
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (public.is_publisher_or_above()) OR
        (public.is_editor_or_above() AND status = 'draft')
    );

-- UPDATE:
-- Publishers and Super Admins can update any prompt.
-- Editors can only update draft prompts to draft status.
CREATE POLICY "prompts_update_editor_above"
    ON public.prompts
    FOR UPDATE
    TO authenticated
    USING (
        (public.is_publisher_or_above()) OR
        (public.is_editor_or_above() AND status = 'draft')
    )
    WITH CHECK (
        (public.is_publisher_or_above()) OR
        (public.is_editor_or_above() AND status = 'draft')
    );

-- DELETE:
-- Only Super Admins and Publishers can delete drafts or archived prompts.
CREATE POLICY "prompts_delete_publisher_above"
    ON public.prompts
    FOR DELETE
    TO authenticated
    USING (
        public.is_publisher_or_above() AND status IN ('draft', 'archived')
    );

-- 4. Policies for prompt_media
-- SELECT:
-- Admins can view all media. Public can view media of published prompts.
CREATE POLICY "prompt_media_select_admin"
    ON public.prompt_media
    FOR SELECT
    TO authenticated
    USING (public.is_admin_member());

CREATE POLICY "prompt_media_select_public"
    ON public.prompt_media
    FOR SELECT
    TO anon
    USING (
        EXISTS (
            SELECT 1 FROM public.prompts 
            WHERE prompts.id = prompt_media.prompt_id AND prompts.status = 'published'
        )
    );

-- INSERT / UPDATE:
-- Editors, publishers, super admins can upload media for draft prompts.
-- Live update media is allowed for publishers and super admins.
CREATE POLICY "prompt_media_insert_policy"
    ON public.prompt_media
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_publisher_or_above() OR
        (
            public.is_editor_or_above() AND
            EXISTS (
                SELECT 1 FROM public.prompts
                WHERE prompts.id = prompt_media.prompt_id AND prompts.status = 'draft'
            )
        )
    );

CREATE POLICY "prompt_media_update_policy"
    ON public.prompt_media
    FOR UPDATE
    TO authenticated
    USING (
        public.is_publisher_or_above() OR
        (
            public.is_editor_or_above() AND
            EXISTS (
                SELECT 1 FROM public.prompts
                WHERE prompts.id = prompt_media.prompt_id AND prompts.status = 'draft'
            )
        )
    );

CREATE POLICY "prompt_media_delete_policy"
    ON public.prompt_media
    FOR DELETE
    TO authenticated
    USING (
        public.is_publisher_or_above() OR
        (
            public.is_editor_or_above() AND
            EXISTS (
                SELECT 1 FROM public.prompts
                WHERE prompts.id = prompt_media.prompt_id AND prompts.status = 'draft'
            )
        )
    );

-- 5. Policies for categories
CREATE POLICY "categories_select_admin"
    ON public.categories
    FOR SELECT
    TO authenticated
    USING (public.is_admin_member());

CREATE POLICY "categories_select_public"
    ON public.categories
    FOR SELECT
    TO anon
    USING (is_active = true);

CREATE POLICY "categories_insert_publisher"
    ON public.categories
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_publisher_or_above());

CREATE POLICY "categories_update_publisher"
    ON public.categories
    FOR UPDATE
    TO authenticated
    USING (public.is_publisher_or_above())
    WITH CHECK (public.is_publisher_or_above());

CREATE POLICY "categories_delete_publisher"
    ON public.categories
    FOR DELETE
    TO authenticated
    USING (public.is_publisher_or_above());

-- 6. Policies for prompt_categories
CREATE POLICY "prompt_categories_select_admin"
    ON public.prompt_categories
    FOR SELECT
    TO authenticated
    USING (public.is_admin_member());

CREATE POLICY "prompt_categories_select_public"
    ON public.prompt_categories
    FOR SELECT
    TO anon
    USING (
        EXISTS (
            SELECT 1 FROM public.prompts 
            WHERE prompts.id = prompt_categories.prompt_id AND prompts.status = 'published'
        )
    );

CREATE POLICY "prompt_categories_write_policy"
    ON public.prompt_categories
    FOR ALL
    TO authenticated
    USING (
        public.is_publisher_or_above() OR
        (
            public.is_editor_or_above() AND
            EXISTS (
                SELECT 1 FROM public.prompts
                WHERE prompts.id = prompt_categories.prompt_id AND prompts.status = 'draft'
            )
        )
    );

-- 7. Policies for tags
CREATE POLICY "tags_select_all"
    ON public.tags
    FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "tags_insert_publisher"
    ON public.tags
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_publisher_or_above());

CREATE POLICY "tags_update_publisher"
    ON public.tags
    FOR UPDATE
    TO authenticated
    USING (public.is_publisher_or_above())
    WITH CHECK (public.is_publisher_or_above());

CREATE POLICY "tags_delete_publisher"
    ON public.tags
    FOR DELETE
    TO authenticated
    USING (public.is_publisher_or_above());

-- 8. Policies for prompt_tags
CREATE POLICY "prompt_tags_select_admin"
    ON public.prompt_tags
    FOR SELECT
    TO authenticated
    USING (public.is_admin_member());

CREATE POLICY "prompt_tags_select_public"
    ON public.prompt_tags
    FOR SELECT
    TO anon
    USING (
        EXISTS (
            SELECT 1 FROM public.prompts 
            WHERE prompts.id = prompt_tags.prompt_id AND prompts.status = 'published'
        )
    );

CREATE POLICY "prompt_tags_write_policy"
    ON public.prompt_tags
    FOR ALL
    TO authenticated
    USING (
        public.is_publisher_or_above() OR
        (
            public.is_editor_or_above() AND
            EXISTS (
                SELECT 1 FROM public.prompts
                WHERE prompts.id = prompt_tags.prompt_id AND prompts.status = 'draft'
            )
        )
    );

-- 9. Policies for collections and collection_items
CREATE POLICY "collections_select_admin"
    ON public.collections
    FOR SELECT
    TO authenticated
    USING (public.is_admin_member());

CREATE POLICY "collections_select_public"
    ON public.collections
    FOR SELECT
    TO anon
    USING (status = 'published');

CREATE POLICY "collections_write_publisher"
    ON public.collections
    FOR ALL
    TO authenticated
    USING (public.is_publisher_or_above())
    WITH CHECK (public.is_publisher_or_above());

CREATE POLICY "collection_items_select_admin"
    ON public.collection_items
    FOR SELECT
    TO authenticated
    USING (public.is_admin_member());

CREATE POLICY "collection_items_select_public"
    ON public.collection_items
    FOR SELECT
    TO anon
    USING (
        EXISTS (
            SELECT 1 FROM public.collections 
            WHERE collections.id = collection_items.collection_id AND collections.status = 'published'
        )
    );

CREATE POLICY "collection_items_write_publisher"
    ON public.collection_items
    FOR ALL
    TO authenticated
    USING (public.is_publisher_or_above())
    WITH CHECK (public.is_publisher_or_above());

-- Public RPCs for mobile app catalog projections (strip created_by / updated_by / internal fields)
CREATE OR REPLACE FUNCTION public.get_public_prompts(
    p_media_type TEXT DEFAULT NULL,
    p_category_slug TEXT DEFAULT NULL,
    p_tag_slug TEXT DEFAULT NULL,
    p_search TEXT DEFAULT NULL,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    slug TEXT,
    title TEXT,
    media_type TEXT,
    published_at TIMESTAMPTZ,
    cover_storage_path TEXT,
    cover_thumbnail_path TEXT,
    cover_preview_path TEXT,
    cover_alt_text TEXT,
    cover_width INT,
    cover_height INT,
    cover_duration_ms INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.slug,
        p.title,
        p.media_type,
        p.published_at,
        pm.storage_path AS cover_storage_path,
        pm.thumbnail_path AS cover_thumbnail_path,
        pm.preview_path AS cover_preview_path,
        pm.alt_text AS cover_alt_text,
        pm.width AS cover_width,
        pm.height AS cover_height,
        pm.duration_ms AS cover_duration_ms
    FROM public.prompts p
    LEFT JOIN public.prompt_media pm ON p.cover_media_id = pm.id
    WHERE p.status = 'published'
      AND (p_media_type IS NULL OR p.media_type = p_media_type)
      AND (
          p_category_slug IS NULL OR EXISTS (
              SELECT 1 FROM public.prompt_categories pc
              JOIN public.categories c ON pc.category_id = c.id
              WHERE pc.prompt_id = p.id AND c.slug = p_category_slug AND c.is_active = true
          )
      )
      AND (
          p_tag_slug IS NULL OR EXISTS (
              SELECT 1 FROM public.prompt_tags pt
              JOIN public.tags t ON pt.tag_id = t.id
              WHERE pt.prompt_id = p.id AND t.slug = p_tag_slug
          )
      )
      AND (
          p_search IS NULL OR 
          p.title ILIKE '%' || p_search || '%' OR
          p.prompt_text ILIKE '%' || p_search || '%'
      )
    ORDER BY p.published_at DESC, p.id DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_public_prompts(TEXT, TEXT, TEXT, TEXT, INT, INT) TO anon, authenticated;

