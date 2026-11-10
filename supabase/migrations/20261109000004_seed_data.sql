-- Migration: 20261109000004_seed_data.sql
-- Description: Seeds system collections (featured, trending), standard categories, and foundational tags

-- 1. Seed Collections (Featured and Trending)
INSERT INTO public.collections (slug, title, status, sort_order)
VALUES
    ('featured', 'Featured Prompts', 'published', 1),
    ('trending', 'Trending Prompts', 'published', 2)
ON CONFLICT (slug) DO NOTHING;

-- 2. Seed Default Categories
INSERT INTO public.categories (slug, name, sort_order, is_active)
VALUES
    ('ai-art', 'AI Art & Concept', 1, true),
    ('photography', 'Cinematic & Photography', 2, true),
    ('graphic-design', 'Graphic & UI Design', 3, true),
    ('architecture', 'Architecture & Interior', 4, true),
    ('character-design', 'Character Design', 5, true),
    ('anime-manga', 'Anime & Illustration', 6, true)
ON CONFLICT (slug) DO NOTHING;

-- 3. Seed Default Tags
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

