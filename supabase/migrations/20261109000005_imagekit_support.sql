-- Migration: 20261109000005_imagekit_support.sql
-- Description: Adds ImageKit and external image URL support to prompt_media and categories while preserving backwards compatibility

-- 1. Extend prompt_media for ImageKit and external URLs
ALTER TABLE public.prompt_media 
    ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'storage' CHECK (source_type IN ('imagekit', 'external', 'storage', 'video')),
    ADD COLUMN IF NOT EXISTS image_url TEXT,
    ADD COLUMN IF NOT EXISTS imagekit_file_id TEXT;

-- Make storage_path nullable to allow modern records that use image_url canonical field
ALTER TABLE public.prompt_media ALTER COLUMN storage_path DROP NOT NULL;

-- Backfill legacy records
UPDATE public.prompt_media
SET image_url = storage_path,
    source_type = CASE 
        WHEN duration_ms IS NOT NULL AND duration_ms > 0 THEN 'video'
        ELSE 'storage'
    END
WHERE image_url IS NULL AND storage_path IS NOT NULL;

ALTER TABLE public.prompt_media DROP CONSTRAINT IF EXISTS prompt_media_source_consistency;
ALTER TABLE public.prompt_media ADD CONSTRAINT prompt_media_source_consistency
    CHECK (
        (source_type = 'external' AND imagekit_file_id IS NULL) OR
        (source_type = 'imagekit') OR
        (source_type = 'storage') OR
        (source_type = 'video')
    );

-- 2. Extend categories for ImageKit and external covers
ALTER TABLE public.categories 
    ADD COLUMN IF NOT EXISTS cover_source_type TEXT DEFAULT 'storage' CHECK (cover_source_type IN ('imagekit', 'external', 'storage')),
    ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
    ADD COLUMN IF NOT EXISTS cover_imagekit_file_id TEXT;

-- Backfill existing categories
UPDATE public.categories 
SET cover_image_url = cover_storage_path,
    cover_source_type = 'storage'
WHERE cover_image_url IS NULL AND cover_storage_path IS NOT NULL;

-- 3. Update public projection RPC: get_public_prompts
CREATE OR REPLACE FUNCTION public.get_public_prompts(
    p_media_type TEXT DEFAULT NULL,
    p_category_slug TEXT DEFAULT NULL,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    slug TEXT,
    title TEXT,
    prompt_text TEXT,
    media_type TEXT,
    published_at TIMESTAMPTZ,
    cover_media_id UUID,
    cover_preview_path TEXT,
    cover_thumbnail_path TEXT,
    cover_image_url TEXT,
    cover_source_type TEXT,
    categories JSONB,
    tags JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.slug,
        p.title,
        p.prompt_text,
        p.media_type,
        p.published_at,
        p.cover_media_id,
        COALESCE(pm.preview_path, pm.image_url, pm.storage_path) AS cover_preview_path,
        COALESCE(pm.thumbnail_path, pm.image_url, pm.storage_path) AS cover_thumbnail_path,
        COALESCE(pm.image_url, pm.storage_path) AS cover_image_url,
        COALESCE(pm.source_type, 'storage') AS cover_source_type,
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('id', c.id, 'slug', c.slug, 'name', c.name))
             FROM public.prompt_categories pc
             JOIN public.categories c ON c.id = pc.category_id
             WHERE pc.prompt_id = p.id AND c.is_active = true),
            '[]'::jsonb
        ) AS categories,
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('id', t.id, 'slug', t.slug, 'name', t.name))
             FROM public.prompt_tags pt
             JOIN public.tags t ON t.id = pt.tag_id
             WHERE pt.prompt_id = p.id),
            '[]'::jsonb
        ) AS tags
    FROM public.prompts p
    LEFT JOIN public.prompt_media pm ON pm.id = p.cover_media_id AND pm.prompt_id = p.id
    WHERE p.status = 'published'
      AND (p_media_type IS NULL OR p.media_type = p_media_type)
      AND (
          p_category_slug IS NULL OR 
          EXISTS (
              SELECT 1 FROM public.prompt_categories pc2
              JOIN public.categories c2 ON c2.id = pc2.category_id
              WHERE pc2.prompt_id = p.id AND c2.slug = p_category_slug AND c2.is_active = true
          )
      )
    ORDER BY p.published_at DESC, p.id DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

