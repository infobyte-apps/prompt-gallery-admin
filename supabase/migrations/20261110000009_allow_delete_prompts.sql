-- Migration: 20261110000009_allow_delete_prompts.sql
-- Description: Allow Super Admin and Publisher to delete prompts directly regardless of status

DROP POLICY IF EXISTS "prompts_delete_publisher_above" ON public.prompts;

CREATE POLICY "prompts_delete_publisher_above"
    ON public.prompts
    FOR DELETE
    TO authenticated
    USING (
        public.is_publisher_or_above()
    );

