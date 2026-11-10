-- Migration: 20261109000003_storage_policies.sql
-- Description: Creates Storage buckets (draft-media, delivery-media) and sets up RLS policies

-- Create buckets if not already existing
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('delivery-media', 'delivery-media', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']),
    ('draft-media', 'draft-media', false, 104857600, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'])
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage object policies for delivery-media (public bucket)
CREATE POLICY "delivery_media_public_select"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'delivery-media');

CREATE POLICY "delivery_media_publisher_insert"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'delivery-media' AND
        public.is_publisher_or_above()
    );

CREATE POLICY "delivery_media_publisher_update"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'delivery-media' AND
        public.is_publisher_or_above()
    );

CREATE POLICY "delivery_media_publisher_delete"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'delivery-media' AND
        public.is_publisher_or_above()
    );

-- Storage object policies for draft-media (private bucket)
CREATE POLICY "draft_media_admin_select"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'draft-media' AND
        public.is_admin_member()
    );

CREATE POLICY "draft_media_editor_insert"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'draft-media' AND
        public.is_editor_or_above()
    );

CREATE POLICY "draft_media_editor_update"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'draft-media' AND
        public.is_editor_or_above()
    );

CREATE POLICY "draft_media_editor_delete"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'draft-media' AND
        public.is_editor_or_above()
    );

