# Prompt Gallery Admin Panel

A private, responsive web administration panel for curating the public mobile prompt catalog against the **SRS v1.1** specification.

Built with **Vite**, **React 19 (JSX)**, **Tailwind CSS v4**, **React Router v7**, and **@supabase/supabase-js**.

---

## 1. Role Capabilities Matrix

| Capability | Super Admin | Publisher | Editor | Viewer |
|---|:---:|:---:|:---:|:---:|
| View dashboard, catalog and private previews | **Yes** | **Yes** | **Yes** | **Yes** |
| Create/edit drafts and upload draft media | **Yes** | **Yes** | **Yes** | Read-only |
| Publish, update live content, archive and republish | **Yes** | **Yes** | No | No |
| Manage categories, tags, and live collections | **Yes** | **Yes** | Read-only | Read-only |
| Manage team membership and roles | **Yes** | No | No | No |

---

## 2. Nine Database Tables & Schema

All SQL migrations are stored under `supabase/migrations/`:

1. `20261109000001_create_schema.sql`:
   - `prompts`: `id`, `slug`, `title`, `prompt_text`, `media_type` (`image`/`video`), `status` (`draft`/`published`/`archived`), `cover_media_id`, `published_at`, `created_by`, `updated_by`, `created_at`, `updated_at`.
   - `prompt_media`: `id`, `prompt_id`, `storage_path`, `thumbnail_path`, `preview_path`, `alt_text`, `width`, `height`, `byte_size`, `duration_ms`, `sort_order`, `created_at`.
   - Composite FK: `prompts(id, cover_media_id) REFERENCES prompt_media(prompt_id, id) ON DELETE RESTRICT`.
   - `categories`: `id`, `slug`, `name`, `cover_storage_path`, `sort_order`, `is_active`.
   - `prompt_categories`: `(prompt_id, category_id)` composite PK.
   - `tags`: `id`, `slug`, `name`.
   - `prompt_tags`: `(prompt_id, tag_id)` composite PK.
   - `collections`: `id`, `slug`, `title`, `status`, `sort_order`, `created_at`, `updated_at`.
   - `collection_items`: `(id, collection_id, prompt_id, media_id, sort_order)` with composite FK to `prompt_media(prompt_id, id)` and cover fallback.
   - `admin_members`: `(user_id PK REFERENCES auth.users, role, created_at)`.
   - Triggers:
     - `protect_last_super_admin`: Blocks deletion or role demotion of the last remaining Super Admin (with table locking against concurrent requests).
     - `validate_prompt_publish`: Validates cover, video duration, and preserves first `published_at` timestamp.
     - `handle_updated_at` & `handle_created_by`: Populates UTC timestamps and auth context.
   - Stored Procedure: `bootstrap_first_super_admin(operator_uuid UUID)`.

2. `20261109000002_rls_and_policies.sql`:
   - Row Level Security (RLS) policies for `super_admin`, `publisher`, `editor`, and `viewer`.
   - Editor publish denial & Viewer write denial.
   - Mobile anonymous public read projections (excluding internal audit fields and drafts).
   - Stored RPC `get_public_prompts`.

3. `20261109000003_storage_policies.sql`:
   - Buckets: `draft-media` (private) and `delivery-media` (public).
   - Storage RLS policies for upload, delivery, and authenticated draft preview.

4. `20261109000004_seed_data.sql`:
   - Seed collections: `featured` and `trending`.
   - Foundational categories: AI Art & Concept, Cinematic & Photography, Graphic & UI Design, Architecture, Character Design.
   - Default tags: Photorealistic, Cyberpunk, Isometric, Minimalist, FLUX.1, Midjourney v6, etc.

5. `20261109000005_imagekit_support.sql`:
   - `prompt_media`: Added `source_type` (`imagekit` / `external`), `image_url` (canonical delivery URL), and `imagekit_file_id` (null for external URLs). Made `storage_path` nullable for non-legacy images.
   - `categories`: Added `cover_source_type`, `cover_image_url`, and `cover_imagekit_file_id`.
   - Preserves compatibility with existing Supabase Storage records (`source_type = 'supabase'`) and video assets.
   - Updated RPC `get_public_prompts` with ImageKit canonical URL fallback.

6. `20261109000006_mobile_app_settings.sql`:
   - `app_settings`: Stores draft JSONB, published JSONB, previous published snapshot, monotonic version counter, and publish audit metadata.
   - Stored procedures: `save_mobile_app_settings_draft`, `publish_mobile_app_settings`, `restore_mobile_app_settings`.
   - Public contract: `get_public_mobile_settings` returns clean published configuration with automatic share URL fallback to Play Store URL, stripped of all internal audit and draft data.
   - RLS: Direct update restricted to `super_admin`; staff read-only access.

7. `20261110000007_monetization.sql`:
   - `ad_settings`: `platform` (`global`, `android`, `ios`), `enabled`, `desired_app_id` (build-time AdMob target), `config_version`, `updated_at`, `updated_by`.
   - `ad_placements`: `placement_key`, `platform`, `ad_format`, `ad_unit_id`, `enabled`, frequency caps (`min_interval_seconds`, `max_impressions_per_session`, `min_navigation_events`, `first_session_grace_seconds`), `updated_at`, `updated_by`.
   - Validation & Security: Enforces valid AdMob format regex (`ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX` for App IDs, `ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX` for Unit IDs).
   - Stored procedures: `save_monetization_config` (atomic updates with version concurrency check) and `get_public_monetization_config` (public mobile projection returning only active placements without admin identities or build-time secrets).
   - RLS: Super Admin write access; read-only for staff roles.

8. `20261110000008_monetization_app_open.sql`:
   - Extended `ad_placements` constraints to include `app_open` format and placement key.
   - Added App Open configuration columns: `show_on_cold_start`, `show_on_foreground_return`, `min_background_seconds`, and `skip_first_n_launches`.
   - Enhanced validation to enforce `skip_first_n_launches >= 1` (preventing first-ever launch ads) and valid background durations (5s - 3600s).
   - Seeded `app_open` test configurations for Android (`ca-app-pub-3940256099942544/9257390708`) and iOS (`ca-app-pub-3940256099942544/5575463023`).

9. `20261110000009_allow_delete_prompts.sql`:
   - Updated RLS policy `prompts_delete_publisher_above` on `public.prompts` to permit Publishers and Super Admins to permanently delete prompts directly regardless of draft/published/archived status.

---

## 3. ImageKit & Dual Image Input Workflow

The admin panel integrates with **ImageKit.io** for optimized image delivery while supporting direct external image URLs:

### Two Media Input Options (`ImageInputTabs.jsx`)
1. **Upload image (Direct-to-ImageKit)**:
   - File picker and drag-and-drop supporting JPEG, PNG, WebP, AVIF, and GIF up to 25 MB.
   - Uploads directly from the browser to ImageKit using short-lived upload authorizations (`token`, `expire`, `signature`) issued by the protected Supabase Edge Function `imagekit-auth`.
   - Server-side verification of asset metadata before final acceptance.
   - Retry capability if Supabase record save fails without re-uploading the asset to ImageKit.
   - Deletion protection: Deletes from ImageKit only if no other prompts, categories, or collections reference the `imagekit_file_id`.

2. **Paste image URL (External CDN / Web)**:
   - Accepts direct HTTPS image URLs (supports extensionless CDN URLs).
   - Validates URL syntax and verifies image rendering in the browser.
   - Stored directly in Supabase; never re-uploaded to ImageKit or charged against bandwidth.
   - Shows helper note: *"This image is hosted externally. It may stop loading if the source changes."*
   - Removing an external image simply unlinks the database record without attempting external deletion.

### ImageKit Transformations Derived Centrally (`src/lib/imagekit.js`)
- **Grid Thumbnail**: `tr=w-400,h-300,fo-auto,q-80`
- **Detail Preview**: `tr=w-1200,h-800,fo-auto,q-85`
- **Fullscreen**: `tr=w-1920,q-90`
- External URLs are delivered untouched without transformation parameters.

### Required ImageKit Configuration
1. Client Variables (`.env`):
   ```env
   VITE_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/<your-id>
   VITE_IMAGEKIT_PUBLIC_KEY=public_<your-public-key>
   ```
2. Supabase Edge Function Secrets (Project Settings -> Edge Functions -> Secrets, or Supabase CLI):
   ```bash
   supabase secrets set IMAGEKIT_PRIVATE_KEY=private_<your-private-key>
   supabase secrets set IMAGEKIT_PUBLIC_KEY=public_<your-public-key>
   supabase secrets set IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/<your-id>
   ```

---

## 4. Quick Start & Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Copy the example environment configuration:
```bash
cp .env.example .env
```
Configure your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-anon-key
VITE_ENABLE_VIDEO_PUBLISHING=false
VITE_USE_LOCAL_DEMO=false
```

*(Note: When `VITE_USE_LOCAL_DEMO=true` or when placeholder credentials are used, the admin runs in full local fixture mode with complete in-memory mock repository, pre-seeded collections, and a built-in topbar Role Tester to verify all four roles immediately without backend dependencies).*

### 3. Run Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```

### 5. Execute Acceptance Test Suite
```bash
npm run test:acceptance
```

---

## 5. Bootstrapping the First Super Admin

To bootstrap the first Super Admin without hardcoding credentials:
1. Create a user account in Supabase Auth (or via Email/Password signup).
2. Retrieve the user's Auth UUID.
3. Call the secure RPC function in PostgreSQL:
   ```sql
   SELECT public.bootstrap_first_super_admin('YOUR-AUTH-USER-UUID'::UUID);
   ```
   Or use the **"Bootstrap First Super Admin"** utility modal on the sign-in screen (`/auth/signin`).

---

## 6. Screen Inventory & Route List

- `A01 /auth/signin`: Sign In, quick role testing entries, Super Admin bootstrapping modal.
- `A01 /auth/reset-password`: Request password recovery link.
- `A01 /auth/recovery`: Secure password reset route.
- `A01 /auth/access-denied`: Access Denied screen for non-members and unauthorized roles.
- `A02 /`: Editorial Dashboard with count queries, media ratios, and recent edits.
- `A03 /prompts`: Server-paginated Prompts catalog table, search, multi-filter, sorting, and mobile card view.
- `A04 /prompts/new` & `/prompts/:id`: 2-column editorial prompt editor with sample uploader, optimistic concurrency check, and live 360px mobile card preview.
- `A05 /categories`: Category CRUD, cover upload, sort order, and Discover deactivation.
- `A06 /tags`: Tag management with strict in-use deletion protection.
- `A07 /collections`: Curation for Featured and Trending feeds, prompt assignment, sample selection, and ordering.
- `A08 /team`: Super Admin-only team membership and role governance with last Super Admin protection.
- `A09 /settings/mobile`: Mobile App Settings module with Links & Support, Home feed section ordering, App Experience with ImageKit/external promotional banner, Maintenance Mode, update notice, and interactive 360×640 mobile preview modal. Super Admin can save drafts, publish, and restore; Publisher, Editor, and Viewer have read-only access.
- `A10 /monetization`: Dedicated Monetization management page. Master ad switch, platform controls (Android/iOS), placement configurations (`home_feed_banner`, `prompt_details_banner`, `navigation_interstitial`, `app_open`), frequency capping controls for interstitials and App Open ads (cold start, foreground return, min background duration, launch threshold gating, cooldown interval, session caps), Google AdMob test ID pre-fill buttons, build-time App ID notices, and Expo config plugin copy snippet. Super Admin can save changes; other roles view read-only.

