Prompt Gallery Admin Panel
Software Requirements Specification · v1.1

1. Scope
   A private, responsive web admin for curating the public mobile prompt catalog. Stack: Vite, React JS (JavaScript/JSX), Tailwind CSS, React Router and Supabase JS. Use Supabase Auth, Postgres and Storage. The mobile app browses anonymously and stores Favorites on device. No mobile app build is part of this admin implementation.
2. Roles and access
   Capability Super Admin Publisher Editor Viewer
   View dashboard, catalog and private previews Yes Yes Yes Yes
   Create/edit drafts and upload draft media Yes Yes Yes Read only
   Publish, update live content, archive and republish Yes Yes No No
   Manage categories, tags, and live collections Yes Yes Read only Read only
   Manage team membership and roles Yes No No No

- Use role keys super_admin, publisher, editor, and viewer. Signed-in non-members see Access Denied. Disable public signup where appropriate. Bootstrap the first Super Admin using the operator's Auth user UUID. Prevent deletion or demotion of the last Super Admin, including concurrent requests.
- Editors may edit unpublished drafts and preview published records. Publishers and Super Admins can save live updates. Restrict direct writes to published records and public delivery assets by role. A Viewer may preview draft media through authorized private access.
- RLS enforces permissions for every table and storage operation. Routes and hidden buttons are UI affordances. Browser receives only the Supabase URL and publishable key. Privileged functions verify the caller before any privileged action and keep secrets server-side.

3. Screens and functional requirements
   ID Screen Requirements
   A01 Sign in / Reset password Email/password, reset-link request, recovery route, session restoration, sign out, access denied.
   A02 Dashboard Counts by prompt status/type, recent edits, shortcuts to create prompt and manage Featured. Use count queries rather than loading the catalog.
   A03 Prompts Server-paginated table with cover, title, type, status, categories and updated date. Search, filters and sorting. Row actions: edit, preview, publish or archive where allowed.
   A04 Prompt editor / preview Title, slug, full prompt, type, categories and tags. Manage samples, cover and order. Show the actual matching prompt under the active sample. Save draft and preview before publishing. Warn on unsaved changes. Prevent silent overwrite of a newer edit using an updated_at check.
   A05 Categories Create, edit, upload cover, order and deactivate. Show usage. Deactivation removes the Discover card while keeping prompt links intact.
   A06 Tags Create, edit, search, show usage. Block deletion of in-use tags until mappings are removed explicitly.
   A07 Collections Manage Featured and Trending, add prompts, choose an optional sample, preview and reorder. New Prompts is derived from first publish date.
   A08 Team Super Admin-only membership list, add existing Auth user, change role and revoke.

The editor supports images at launch and video when enabled by configuration. Video requires a playable clip, poster and duration. Video previews load on Play. Manage uploads within the editor, with progress, retry, file size, alt text for images and a clearly marked cover. Reordering supports drag and accessible Move up/down actions. Use a collapsible sidebar on desktop and a drawer on mobile. Wide tables become readable cards or scroll within their container. Keep editor actions reachable and provide loading, empty, error, retry and success states.
3.1 Visual design and responsive behavior

- Use a professional editorial dashboard: neutral page background, white surfaces, subtle borders, indigo primary actions, consistent typography and an 8px spacing scale. Status badges include text for Draft, Published and Archived.
- Desktop sidebar groups Dashboard, Prompts, Categories, Tags and Collections under Content, with Team under Administration for Super Admins. Top bar shows breadcrumbs, signed-in identity, role and sign-out menu. On mobile use an accessible navigation drawer.
- Dashboard shows real status totals and recent edits. Prompt list has a clear New Prompt action, search and filters, aligned columns and predictable row actions. Use a mobile card layout with visible status and primary action.
- Editor uses a two-column desktop layout with content fields on the left and publishing status and preview on the right. Stack sections on mobile. Show save state, field-level errors and confirmation before archive or access revocation. Provide visible keyboard focus, labeled controls and accessible dialogs.
- Review layouts at 360px, 768px and 1440px. Check for clipped labels, overlapping actions and page-wide horizontal overflow.

4. Database contract · nine app tables
   Use UUID IDs, UTC timestamps, snake_case names, unique normalized slugs and enforced foreign keys. Choose consistent timestamp defaults and update triggers. Record creator and last editor from the authenticated server context.
   Table Fields
   prompts id, slug, title, prompt_text, media_type (image/video), status (draft/published/archived), cover_media_id, published_at, created_by, updated_by, created_at, updated_at
   prompt_media id, prompt_id, storage_path, thumbnail_path, preview_path, alt_text, width, height, byte_size, duration_ms, sort_order, created_at
   categories id, slug, name, cover_storage_path, sort_order, is_active
   prompt_categories prompt_id, category_id; composite PK
   tags id, slug, name
   prompt_tags prompt_id, tag_id; composite PK
   collections id, slug, title, status (draft/published/archived), sort_order, created_at, updated_at
   collection_items id, collection_id, prompt_id, media_id (nullable), sort_order
   admin_members user_id (PK referencing auth.users), role (super_admin/publisher/editor/viewer), created_at

- Enforce cover and selected collection media ownership using composite FKs keyed by prompt ID and media ID. Add the referenced unique key. A nullable collection media ID falls back to the prompt cover. Restrict deletion of referenced media until it is reassigned. Block removing the last valid cover from a published prompt.
- Validate nonempty title and prompt, nonnegative order and sizes, and positive dimensions/duration when present. Validate video poster and duration at publish. A prompt's sample types follow its media_type. Changing type after attaching media requires clearing/replacing incompatible samples.
- Publish only with valid content and prepared cover. Set published_at once and preserve it on edits and republish. Archive hides the prompt from all public lists and collection joins. Draft edits to an already published prompt are staged in the form until explicitly saved as a live update. No revision-history module is required.
- Public reads must exclude unpublished prompts, hidden collections, inactive categories and their corresponding mappings. Public payloads must exclude internal audit fields and private paths. Use narrowly scoped projections/RPCs, grants and RLS together. Lock down default function execution grants and secure privileged functions.
- Index published feeds by type and publish date, reverse category/tag lookups, and ordered media/collection items. Use deterministic ordering with an ID tie breaker. Do not add duplicate indexes already supplied by constraints.

5. Media lifecycle and cost

- Use a private draft bucket and a public delivery bucket with separate permissions. Store object paths, not binaries, in Postgres. Establish deterministic draft/delivery path mapping for image variants and category covers.
- Prepare thumbnail and preview before publish. Start with an approximate 50 KB grid thumbnail target, subject to quality, and configurable limits for original uploads and video. Preserve aspect ratio and validate file type and size server-side. Load fullscreen media only on expand and video only on Play. Show per-file sizes to editors.
- Publish prepares delivery assets before making catalog rows visible. Use versioned keys when replacing media. Storage and DB writes are separate operations. Make publish/archive retries idempotent, guard concurrent changes, compensate for failed publishes and surface cleanup failures. Archive hides catalog rows first, then removes delivery objects. Previously cached public copies may persist until caches expire. Retain one private copy when needed for republish. Track cleanup state in existing records if needed and document any additional operational columns.
- Catalog lists use compact projections, approximately 20 results per page, and no Realtime. Carousel reads a short prompt preview. Full text is fetched on details or copy, with an error state if it cannot load. Debounce search and cache results. Start with SQL search over title, category and tags. Keep video filters supported by the data contract.

6. Acceptance and handoff
   Verify on desktop and narrow mobile: role boundaries, reset and sign out, draft invisibility, valid and invalid publish, first-publish date preservation, cross-prompt media rejection, collection reorder, archive/unpublish, upload and retry, and catalog visibility for anonymous and authenticated non-admin users. Check direct API requests as well as UI. Exercise a video fixture with the feature enabled and confirm no autoplay. Deliver source, migrations, configuration example, setup and first Super Admin instructions, and an implementation report.
