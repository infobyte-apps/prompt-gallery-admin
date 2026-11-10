// Mock store for local dev & testing when Supabase backend is not yet provisioned
const STORAGE_KEY = 'prompt_gallery_admin_state_v1';

const INITIAL_STATE = {
  admin_members: [
    {
      user_id: 'usr-super-admin-01',
      email: 'admin@promptgallery.internal',
      role: 'super_admin',
      created_at: '2026-11-01T10:00:00Z',
    },
    {
      user_id: 'usr-publisher-02',
      email: 'publisher@promptgallery.internal',
      role: 'publisher',
      created_at: '2026-11-02T11:00:00Z',
    },
    {
      user_id: 'usr-editor-03',
      email: 'editor@promptgallery.internal',
      role: 'editor',
      created_at: '2026-11-03T12:00:00Z',
    },
    {
      user_id: 'usr-viewer-04',
      email: 'viewer@promptgallery.internal',
      role: 'viewer',
      created_at: '2026-11-04T13:00:00Z',
    },
  ],
  categories: [
    { id: 'cat-1', slug: 'ai-art', name: 'AI Art & Concept', sort_order: 1, is_active: true, cover_storage_path: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80' },
    { id: 'cat-2', slug: 'photography', name: 'Cinematic & Photography', sort_order: 2, is_active: true, cover_storage_path: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&q=80' },
    { id: 'cat-3', slug: 'graphic-design', name: 'Graphic & UI Design', sort_order: 3, is_active: true, cover_storage_path: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=400&q=80' },
    { id: 'cat-4', slug: 'architecture', name: 'Architecture & Interior', sort_order: 4, is_active: true, cover_storage_path: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&q=80' },
    { id: 'cat-5', slug: 'character-design', name: 'Character Design', sort_order: 5, is_active: true, cover_storage_path: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80' },
    { id: 'cat-6', slug: 'anime-manga', name: 'Anime & Illustration', sort_order: 6, is_active: false, cover_storage_path: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&q=80' },
  ],
  app_settings: {
    environment: 'production',
    draft_config: {
      links_support: {
        privacy_policy_url: '',
        support_email: '',
        support_page_url: '',
        website_url: '',
        play_store_url: '',
        share_url: '',
        share_message: 'Explore inspiring AI image and video prompts on Prompt Gallery!',
        social_links: [
          { id: 'x', label: 'X / Twitter', url: '', is_visible: false },
          { id: 'discord', label: 'Discord', url: '', is_visible: false },
          { id: 'instagram', label: 'Instagram', url: '', is_visible: false },
        ],
        visible_more_links: {
          privacy_policy: true,
          terms: false,
          website: false,
          support: true,
          share_app: true,
          rate_app: true,
        },
      },
      home_discover: {
        sections: [
          { id: 'featured', type: 'collection', title: 'Featured Prompts', is_visible: true, order: 1 },
          { id: 'trending', type: 'collection', title: 'Trending Now', is_visible: true, order: 2 },
          { id: 'new_prompts', type: 'recent', title: 'New Prompts', is_visible: true, order: 3 },
        ],
      },
      app_experience: {
        app_name: 'Prompt Gallery',
        tagline: 'Curated AI Prompts for Creators',
        banner: {
          enabled: false,
          text: '',
          source_type: 'imagekit',
          image_url: '',
          imagekit_file_id: null,
          action_url: '',
        },
        features: {
          video_prompts: false,
          favorite_prompts: true,
          copy_prompt_action: true,
        },
      },
      maintenance: {
        is_enabled: false,
        title: 'Scheduled Maintenance',
        message: 'We are currently optimizing Prompt Gallery. We will be back online shortly.',
        update_notice: {
          is_enabled: false,
          is_blocking: false,
          title: 'New Version Available',
          message: 'A new version of Prompt Gallery is available on Google Play.',
          min_build_number: 1,
          cta_label: 'Update Now',
        },
      },
    },
    published_config: {
      links_support: {
        privacy_policy_url: '',
        support_email: '',
        support_page_url: '',
        website_url: '',
        play_store_url: '',
        share_url: '',
        share_message: 'Explore inspiring AI image and video prompts on Prompt Gallery!',
        social_links: [
          { id: 'x', label: 'X / Twitter', url: '', is_visible: false },
          { id: 'discord', label: 'Discord', url: '', is_visible: false },
          { id: 'instagram', label: 'Instagram', url: '', is_visible: false },
        ],
        visible_more_links: {
          privacy_policy: true,
          terms: false,
          website: false,
          support: true,
          share_app: true,
          rate_app: true,
        },
      },
      home_discover: {
        sections: [
          { id: 'featured', type: 'collection', title: 'Featured Prompts', is_visible: true, order: 1 },
          { id: 'trending', type: 'collection', title: 'Trending Now', is_visible: true, order: 2 },
          { id: 'new_prompts', type: 'recent', title: 'New Prompts', is_visible: true, order: 3 },
        ],
      },
      app_experience: {
        app_name: 'Prompt Gallery',
        tagline: 'Curated AI Prompts for Creators',
        banner: {
          enabled: false,
          text: '',
          source_type: 'imagekit',
          image_url: '',
          imagekit_file_id: null,
          action_url: '',
        },
        features: {
          video_prompts: false,
          favorite_prompts: true,
          copy_prompt_action: true,
        },
      },
      maintenance: {
        is_enabled: false,
        title: 'Scheduled Maintenance',
        message: 'We are currently optimizing Prompt Gallery. We will be back online shortly.',
        update_notice: {
          is_enabled: false,
          is_blocking: false,
          title: 'New Version Available',
          message: 'A new version of Prompt Gallery is available on Google Play.',
          min_build_number: 1,
          cta_label: 'Update Now',
        },
      },
    },
    previous_published_config: null,
    version: 1,
    draft_updated_at: '2026-11-09T18:00:00Z',
    draft_updated_by: 'usr-super-admin-01',
    published_at: '2026-11-09T18:00:00Z',
    published_by: 'usr-super-admin-01',
  },
  ad_settings: [
    { platform: 'global', enabled: false, desired_app_id: null, config_version: 1, updated_at: '2026-11-10T10:00:00Z', updated_by: 'usr-super-admin-01' },
    { platform: 'android', enabled: false, desired_app_id: 'ca-app-pub-3940256099942544~3347511713', config_version: 1, updated_at: '2026-11-10T10:00:00Z', updated_by: 'usr-super-admin-01' },
    { platform: 'ios', enabled: false, desired_app_id: 'ca-app-pub-3940256099942544~1458002511', config_version: 1, updated_at: '2026-11-10T10:00:00Z', updated_by: 'usr-super-admin-01' },
  ],
  ad_placements: [
    {
      id: 'pl-1',
      placement_key: 'home_feed_banner',
      platform: 'android',
      ad_format: 'banner',
      ad_unit_id: 'ca-app-pub-3940256099942544/6300978111',
      enabled: false,
      min_interval_seconds: null,
      max_impressions_per_session: null,
      min_navigation_events: null,
      first_session_grace_seconds: null,
      updated_at: '2026-11-10T10:00:00Z',
      updated_by: 'usr-super-admin-01',
    },
    {
      id: 'pl-2',
      placement_key: 'home_feed_banner',
      platform: 'ios',
      ad_format: 'banner',
      ad_unit_id: 'ca-app-pub-3940256099942544/2934735716',
      enabled: false,
      min_interval_seconds: null,
      max_impressions_per_session: null,
      min_navigation_events: null,
      first_session_grace_seconds: null,
      updated_at: '2026-11-10T10:00:00Z',
      updated_by: 'usr-super-admin-01',
    },
    {
      id: 'pl-3',
      placement_key: 'prompt_details_banner',
      platform: 'android',
      ad_format: 'banner',
      ad_unit_id: 'ca-app-pub-3940256099942544/6300978111',
      enabled: false,
      min_interval_seconds: null,
      max_impressions_per_session: null,
      min_navigation_events: null,
      first_session_grace_seconds: null,
      updated_at: '2026-11-10T10:00:00Z',
      updated_by: 'usr-super-admin-01',
    },
    {
      id: 'pl-4',
      placement_key: 'prompt_details_banner',
      platform: 'ios',
      ad_format: 'banner',
      ad_unit_id: 'ca-app-pub-3940256099942544/2934735716',
      enabled: false,
      min_interval_seconds: null,
      max_impressions_per_session: null,
      min_navigation_events: null,
      first_session_grace_seconds: null,
      updated_at: '2026-11-10T10:00:00Z',
      updated_by: 'usr-super-admin-01',
    },
    {
      id: 'pl-5',
      placement_key: 'navigation_interstitial',
      platform: 'android',
      ad_format: 'interstitial',
      ad_unit_id: 'ca-app-pub-3940256099942544/1033173712',
      enabled: false,
      min_interval_seconds: 180,
      max_impressions_per_session: 3,
      min_navigation_events: 4,
      first_session_grace_seconds: 60,
      updated_at: '2026-11-10T10:00:00Z',
      updated_by: 'usr-super-admin-01',
    },
    {
      id: 'pl-6',
      placement_key: 'navigation_interstitial',
      platform: 'ios',
      ad_format: 'interstitial',
      ad_unit_id: 'ca-app-pub-3940256099942544/4411468910',
      enabled: false,
      min_interval_seconds: 180,
      max_impressions_per_session: 3,
      min_navigation_events: 4,
      first_session_grace_seconds: 60,
      updated_at: '2026-11-10T10:00:00Z',
      updated_by: 'usr-super-admin-01',
    },
    {
      id: 'pl-7',
      placement_key: 'app_open',
      platform: 'android',
      ad_format: 'app_open',
      ad_unit_id: 'ca-app-pub-3940256099942544/9257390708',
      enabled: false,
      min_interval_seconds: 300,
      max_impressions_per_session: 2,
      min_navigation_events: null,
      first_session_grace_seconds: null,
      show_on_cold_start: true,
      show_on_foreground_return: true,
      min_background_seconds: 60,
      skip_first_n_launches: 2,
      updated_at: '2026-11-10T10:00:00Z',
      updated_by: 'usr-super-admin-01',
    },
    {
      id: 'pl-8',
      placement_key: 'app_open',
      platform: 'ios',
      ad_format: 'app_open',
      ad_unit_id: 'ca-app-pub-3940256099942544/5575463023',
      enabled: false,
      min_interval_seconds: 300,
      max_impressions_per_session: 2,
      min_navigation_events: null,
      first_session_grace_seconds: null,
      show_on_cold_start: true,
      show_on_foreground_return: true,
      min_background_seconds: 60,
      skip_first_n_launches: 2,
      updated_at: '2026-11-10T10:00:00Z',
      updated_by: 'usr-super-admin-01',
    },
  ],
  tags: [
    { id: 'tag-1', slug: 'photorealistic', name: 'Photorealistic' },
    { id: 'tag-2', slug: 'cyberpunk', name: 'Cyberpunk' },
    { id: 'tag-3', slug: 'isometric', name: 'Isometric' },
    { id: 'tag-4', slug: 'minimalist', name: 'Minimalist' },
    { id: 'tag-5', slug: 'midjourney-v6', name: 'Midjourney v6' },
    { id: 'tag-6', slug: 'flux-1', name: 'FLUX.1' },
    { id: 'tag-7', slug: 'volumetric-lighting', name: 'Volumetric Lighting' },
  ],
  prompts: [
    {
      id: 'prm-001',
      slug: 'ethereal-cyberpunk-metropolis',
      title: 'Ethereal Cyberpunk Metropolis at Twilight',
      prompt_text: 'Vast futuristic cityscape shrouded in neon mist, holographic billboards reflecting on wet asphalt, volumetric cyan and magenta god-rays, 8k resolution, cinematic composition, shot on 35mm lens --ar 16:9 --v 6.0',
      media_type: 'image',
      status: 'published',
      cover_media_id: 'med-001',
      published_at: '2026-11-05T08:30:00Z',
      created_by: 'usr-super-admin-01',
      updated_by: 'usr-super-admin-01',
      created_at: '2026-11-05T08:00:00Z',
      updated_at: '2026-11-05T08:30:00Z',
      categories: ['cat-1', 'cat-2'],
      tags: ['tag-1', 'tag-2', 'tag-5'],
    },
    {
      id: 'prm-002',
      slug: 'minimalist-concrete-villa',
      title: 'Minimalist Concrete Villa in Nordic Pine Forest',
      prompt_text: 'Brutalist modern architecture residence surrounded by misty pine trees, expansive floor-to-ceiling glass windows, warm interior lighting, morning dew, hyper-realistic architectural photography --ar 3:2',
      media_type: 'image',
      status: 'draft',
      cover_media_id: 'med-003',
      published_at: null,
      created_by: 'usr-editor-03',
      updated_by: 'usr-editor-03',
      created_at: '2026-11-08T14:15:00Z',
      updated_at: '2026-11-08T14:15:00Z',
      categories: ['cat-4'],
      tags: ['tag-1', 'tag-4', 'tag-6'],
    },
    {
      id: 'prm-003',
      slug: 'surreal-floating-crystal-islands',
      title: 'Surreal Floating Crystal Islands in Aurora Sky',
      prompt_text: 'Majestic crystalline landmasses levitating above emerald cloudscapes, ethereal waterfalls cascading into the void, vibrant aurora borealis sky, fantasy matte painting --ar 16:9',
      media_type: 'image',
      status: 'archived',
      cover_media_id: 'med-004',
      published_at: '2026-11-02T09:00:00Z',
      created_by: 'usr-publisher-02',
      updated_by: 'usr-publisher-02',
      created_at: '2026-11-02T08:00:00Z',
      updated_at: '2026-11-06T16:00:00Z',
      categories: ['cat-1'],
      tags: ['tag-7'],
    },
  ],
  prompt_media: [
    {
      id: 'med-001',
      prompt_id: 'prm-001',
      storage_path: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1200&q=80',
      thumbnail_path: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=300&q=70',
      preview_path: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&q=80',
      alt_text: 'Futuristic neon skyline at night',
      width: 1920,
      height: 1080,
      byte_size: 450230,
      duration_ms: null,
      sort_order: 1,
      created_at: '2026-11-05T08:05:00Z',
    },
    {
      id: 'med-002',
      prompt_id: 'prm-001',
      storage_path: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1200&q=80',
      thumbnail_path: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=300&q=70',
      preview_path: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&q=80',
      alt_text: 'Cyberpunk alley with neon reflections',
      width: 1920,
      height: 1080,
      byte_size: 382100,
      duration_ms: null,
      sort_order: 2,
      created_at: '2026-11-05T08:10:00Z',
    },
    {
      id: 'med-003',
      prompt_id: 'prm-002',
      storage_path: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80',
      thumbnail_path: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=300&q=70',
      preview_path: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
      alt_text: 'Concrete modern house exterior',
      width: 1800,
      height: 1200,
      byte_size: 512000,
      duration_ms: null,
      sort_order: 1,
      created_at: '2026-11-08T14:16:00Z',
    },
    {
      id: 'med-004',
      prompt_id: 'prm-003',
      storage_path: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&q=80',
      thumbnail_path: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&q=70',
      preview_path: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&q=80',
      alt_text: 'Crystal landscape floating',
      width: 1920,
      height: 1080,
      byte_size: 420000,
      duration_ms: null,
      sort_order: 1,
      created_at: '2026-11-02T08:05:00Z',
    },
  ],
  collections: [
    {
      id: 'col-001',
      slug: 'featured',
      title: 'Featured Prompts',
      status: 'published',
      sort_order: 1,
      created_at: '2026-11-01T00:00:00Z',
      updated_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 'col-002',
      slug: 'trending',
      title: 'Trending Prompts',
      status: 'published',
      sort_order: 2,
      created_at: '2026-11-01T00:00:00Z',
      updated_at: '2026-11-01T00:00:00Z',
    },
  ],
  collection_items: [
    {
      id: 'item-001',
      collection_id: 'col-001',
      prompt_id: 'prm-001',
      media_id: 'med-001',
      sort_order: 1,
    },
  ],
};

let memoryState = null;

function loadState() {
  if (typeof localStorage === 'undefined') {
    if (!memoryState) {
      memoryState = JSON.parse(JSON.stringify(INITIAL_STATE));
    }
    return memoryState;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_STATE));
      return INITIAL_STATE;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_STATE;
  }
}

function saveState(state) {
  if (typeof localStorage === 'undefined') {
    memoryState = state;
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save state to localStorage', err);
  }
}

export const mockStore = {
  getState: loadState,
  resetState: () => {
    saveState(INITIAL_STATE);
    return INITIAL_STATE;
  },

  // Auth Users & Team
  getAdminMembers: () => {
    return loadState().admin_members;
  },
  getMemberByUserId: (userId) => {
    return loadState().admin_members.find((m) => m.user_id === userId) || null;
  },
  getMemberByEmail: (email) => {
    return loadState().admin_members.find((m) => m.email.toLowerCase() === email.toLowerCase()) || null;
  },
  bootstrapFirstSuperAdmin: (userId, email) => {
    const state = loadState();
    const existingAdmins = state.admin_members.filter((m) => m.role === 'super_admin');
    if (existingAdmins.length > 0) {
      throw new Error('A super admin already exists in the system.');
    }
    const newMember = {
      user_id: userId,
      email: email || `admin-${userId.slice(0, 6)}@promptgallery.internal`,
      role: 'super_admin',
      created_at: new Date().toISOString(),
    };
    state.admin_members.push(newMember);
    saveState(state);
    return newMember;
  },
  addMember: (userId, email, role) => {
    const state = loadState();
    if (state.admin_members.some((m) => m.user_id === userId)) {
      throw new Error(`Member with user ID ${userId} already exists.`);
    }
    const newMember = {
      user_id: userId,
      email: email || `${userId.slice(0, 8)}@promptgallery.internal`,
      role,
      created_at: new Date().toISOString(),
    };
    state.admin_members.push(newMember);
    saveState(state);
    return newMember;
  },
  updateMemberRole: (userId, newRole) => {
    const state = loadState();
    const member = state.admin_members.find((m) => m.user_id === userId);
    if (!member) throw new Error('Member not found');

    if (member.role === 'super_admin' && newRole !== 'super_admin') {
      const remainingSuperAdmins = state.admin_members.filter((m) => m.role === 'super_admin' && m.user_id !== userId);
      if (remainingSuperAdmins.length === 0) {
        throw new Error('Cannot demote the last super_admin member');
      }
    }

    member.role = newRole;
    saveState(state);
    return member;
  },
  removeMember: (userId) => {
    const state = loadState();
    const member = state.admin_members.find((m) => m.user_id === userId);
    if (!member) throw new Error('Member not found');

    if (member.role === 'super_admin') {
      const remainingSuperAdmins = state.admin_members.filter((m) => m.role === 'super_admin' && m.user_id !== userId);
      if (remainingSuperAdmins.length === 0) {
        throw new Error('Cannot delete the last super_admin member');
      }
    }

    state.admin_members = state.admin_members.filter((m) => m.user_id !== userId);
    saveState(state);
    return true;
  },

  // Prompts
  getPrompts: ({ search, status, media_type, category_id, page = 1, limit = 20, sortField = 'updated_at', sortDir = 'desc' } = {}) => {
    const state = loadState();
    let list = [...state.prompts];

    if (status && status !== 'all') {
      list = list.filter((p) => p.status === status);
    }
    if (media_type && media_type !== 'all') {
      list = list.filter((p) => p.media_type === media_type);
    }
    if (category_id && category_id !== 'all') {
      list = list.filter((p) => p.categories && p.categories.includes(category_id));
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q) ||
          p.prompt_text.toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      // Deterministic tie breaker by ID
      return a.id.localeCompare(b.id);
    });

    const total = list.length;
    const startIndex = (page - 1) * limit;
    const paged = list.slice(startIndex, startIndex + limit);

    // Enrich with cover media and category names
    const enriched = paged.map((p) => {
      const cover = state.prompt_media.find((m) => m.id === p.cover_media_id && m.prompt_id === p.id) || null;
      const cats = state.categories.filter((c) => p.categories && p.categories.includes(c.id));
      const tags = state.tags.filter((t) => p.tags && p.tags.includes(t.id));
      return {
        ...p,
        cover,
        categoryObjects: cats,
        tagObjects: tags,
      };
    });

    return {
      data: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  },

  getPromptById: (id) => {
    const state = loadState();
    const p = state.prompts.find((item) => item.id === id);
    if (!p) return null;

    const media = state.prompt_media
      .filter((m) => m.prompt_id === id)
      .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));

    const cover = media.find((m) => m.id === p.cover_media_id) || null;

    return {
      ...p,
      media,
      cover,
    };
  },

  savePrompt: (promptData, currentUser) => {
    const state = loadState();
    const now = new Date().toISOString();

    // Validate fields
    if (!promptData.title || !promptData.title.trim()) {
      throw new Error('Title cannot be empty');
    }
    if (!promptData.prompt_text || !promptData.prompt_text.trim()) {
      throw new Error('Prompt text cannot be empty');
    }

    // Check slug uniqueness
    const existingWithSlug = state.prompts.find(
      (p) => p.slug === promptData.slug && p.id !== promptData.id
    );
    if (existingWithSlug) {
      throw new Error(`A prompt with slug "${promptData.slug}" already exists`);
    }

    let savedPrompt;
    if (promptData.id) {
      // Update existing
      const index = state.prompts.findIndex((p) => p.id === promptData.id);
      if (index === -1) throw new Error('Prompt not found');
      const existing = state.prompts[index];

      // Optimistic concurrency check: updated_at check
      if (promptData.original_updated_at && promptData.original_updated_at !== existing.updated_at) {
        throw new Error('Concurrency Conflict: This prompt was updated by another session. Please reload to see the latest changes.');
      }

      // If status is published, enforce publishing constraints
      if (promptData.status === 'published') {
        if (!promptData.cover_media_id) {
          throw new Error('A published prompt must have an assigned cover_media_id');
        }
        const coverMedia = state.prompt_media.find(
          (m) => m.id === promptData.cover_media_id && m.prompt_id === existing.id
        );
        if (!coverMedia) {
          throw new Error('Cover media does not exist or does not belong to this prompt');
        }
        if (promptData.media_type === 'video') {
          if (!coverMedia.duration_ms || coverMedia.duration_ms <= 0) {
            throw new Error('Published video prompt requires valid positive duration_ms');
          }
          if (!coverMedia.preview_path) {
            throw new Error('Published video prompt requires preview/poster image path');
          }
        }
      }

      // Preserve first published_at
      let published_at = existing.published_at;
      if (promptData.status === 'published' && !published_at) {
        published_at = now;
      }

      savedPrompt = {
        ...existing,
        slug: promptData.slug,
        title: promptData.title.trim(),
        prompt_text: promptData.prompt_text.trim(),
        media_type: promptData.media_type,
        status: promptData.status,
        cover_media_id: promptData.cover_media_id,
        categories: promptData.categories || [],
        tags: promptData.tags || [],
        published_at,
        updated_by: currentUser?.id || 'usr-system',
        updated_at: now,
      };

      state.prompts[index] = savedPrompt;
    } else {
      // Create new
      const newId = `prm-${Date.now().toString(36)}`;
      savedPrompt = {
        id: newId,
        slug: promptData.slug,
        title: promptData.title.trim(),
        prompt_text: promptData.prompt_text.trim(),
        media_type: promptData.media_type,
        status: promptData.status || 'draft',
        cover_media_id: null,
        categories: promptData.categories || [],
        tags: promptData.tags || [],
        published_at: promptData.status === 'published' ? now : null,
        created_by: currentUser?.id || 'usr-system',
        updated_by: currentUser?.id || 'usr-system',
        created_at: now,
        updated_at: now,
      };

      state.prompts.unshift(savedPrompt);
    }

    saveState(state);
    return savedPrompt;
  },

  deletePrompt: (id, operatorRole = 'publisher') => {
    if (operatorRole === 'viewer') {
      throw new Error('Permission denied: Viewers cannot delete prompts');
    }
    const state = loadState();
    const index = state.prompts.findIndex((p) => p.id === id);
    if (index === -1) throw new Error('Prompt not found');

    const [deleted] = state.prompts.splice(index, 1);
    state.prompt_media = (state.prompt_media || []).filter((m) => m.prompt_id !== id);
    state.collection_items = (state.collection_items || []).filter((ci) => ci.prompt_id !== id);

    saveState(state);
    return { success: true, deleted };
  },

  // Prompt Media
  addMedia: (promptId, mediaItem) => {
    const state = loadState();
    const newMedia = {
      id: `med-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      prompt_id: promptId,
      source_type: mediaItem.source_type || 'imagekit',
      image_url: mediaItem.image_url || mediaItem.storage_path,
      imagekit_file_id: mediaItem.imagekit_file_id || null,
      storage_path: mediaItem.storage_path || mediaItem.image_url,
      thumbnail_path: mediaItem.thumbnail_path || mediaItem.storage_path || mediaItem.image_url,
      preview_path: mediaItem.preview_path || mediaItem.storage_path || mediaItem.image_url,
      alt_text: mediaItem.alt_text || '',
      width: mediaItem.width || 1200,
      height: mediaItem.height || 800,
      byte_size: mediaItem.byte_size || 150000,
      duration_ms: mediaItem.duration_ms || null,
      sort_order: mediaItem.sort_order || 0,
      created_at: new Date().toISOString(),
    };

    state.prompt_media.push(newMedia);

    // If prompt has no cover yet, assign this media as cover
    const prompt = state.prompts.find((p) => p.id === promptId);
    if (prompt && !prompt.cover_media_id) {
      prompt.cover_media_id = newMedia.id;
    }

    saveState(state);
    return newMedia;
  },

  updateMedia: (mediaId, updates) => {
    const state = loadState();
    const media = state.prompt_media.find((m) => m.id === mediaId);
    if (!media) throw new Error('Media not found');

    Object.assign(media, updates);
    saveState(state);
    return media;
  },

  deleteMedia: (promptId, mediaId) => {
    const state = loadState();
    const prompt = state.prompts.find((p) => p.id === promptId);

    // If published and this is the cover, block removal
    if (prompt && prompt.status === 'published' && prompt.cover_media_id === mediaId) {
      const remainingMedia = state.prompt_media.filter((m) => m.prompt_id === promptId && m.id !== mediaId);
      if (remainingMedia.length === 0) {
        throw new Error('Cannot remove the last valid cover from a published prompt');
      }
      // Reassign to first remaining
      prompt.cover_media_id = remainingMedia[0].id;
    }

    // Check collection items
    state.collection_items.forEach((item) => {
      if (item.media_id === mediaId) {
        item.media_id = null; // fallback to prompt cover
      }
    });

    state.prompt_media = state.prompt_media.filter((m) => m.id !== mediaId);
    saveState(state);
    return true;
  },

  // Categories
  getCategories: () => {
    const state = loadState();
    return state.categories.map((cat) => {
      const usageCount = state.prompts.filter(
        (p) => p.categories && p.categories.includes(cat.id)
      ).length;
      return {
        ...cat,
        usage_count: usageCount,
      };
    }).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  },

  saveCategory: (categoryData) => {
    const state = loadState();
    if (!categoryData.name || !categoryData.name.trim()) {
      throw new Error('Category name cannot be empty');
    }
    if (!categoryData.slug || !categoryData.slug.trim()) {
      throw new Error('Category slug cannot be empty');
    }

    const existingWithSlug = state.categories.find(
      (c) => c.slug === categoryData.slug && c.id !== categoryData.id
    );
    if (existingWithSlug) {
      throw new Error(`A category with slug "${categoryData.slug}" already exists`);
    }

    if (categoryData.id) {
      const index = state.categories.findIndex((c) => c.id === categoryData.id);
      if (index === -1) throw new Error('Category not found');
      state.categories[index] = {
        ...state.categories[index],
        name: categoryData.name.trim(),
        slug: categoryData.slug.trim(),
        sort_order: Number(categoryData.sort_order) || 0,
        is_active: categoryData.is_active !== undefined ? categoryData.is_active : true,
        cover_storage_path: categoryData.cover_storage_path || categoryData.cover_image_url || state.categories[index].cover_storage_path,
        cover_image_url: categoryData.cover_image_url || categoryData.cover_storage_path || state.categories[index].cover_image_url,
        cover_source_type: categoryData.cover_source_type || state.categories[index].cover_source_type || 'imagekit',
        cover_imagekit_file_id: categoryData.cover_imagekit_file_id !== undefined ? categoryData.cover_imagekit_file_id : state.categories[index].cover_imagekit_file_id,
      };
      saveState(state);
      return state.categories[index];
    } else {
      const newCat = {
        id: `cat-${Date.now().toString(36)}`,
        name: categoryData.name.trim(),
        slug: categoryData.slug.trim(),
        sort_order: Number(categoryData.sort_order) || 0,
        is_active: categoryData.is_active !== undefined ? categoryData.is_active : true,
        cover_storage_path: categoryData.cover_storage_path || categoryData.cover_image_url || null,
        cover_image_url: categoryData.cover_image_url || categoryData.cover_storage_path || null,
        cover_source_type: categoryData.cover_source_type || 'imagekit',
        cover_imagekit_file_id: categoryData.cover_imagekit_file_id || null,
      };
      state.categories.push(newCat);
      saveState(state);
      return newCat;
    }
  },

  deleteCategory: (id) => {
    const state = loadState();
    const inUseCount = state.prompts.filter(
      (p) => p.categories && p.categories.includes(id)
    ).length;
    if (inUseCount > 0) {
      throw new Error(`Cannot delete category: it is currently attached to ${inUseCount} prompt(s). Remove mappings or deactivate it instead.`);
    }
    state.categories = state.categories.filter((c) => c.id !== id);
    saveState(state);
    return true;
  },

  // Tags
  getTags: (search) => {
    const state = loadState();
    let list = state.tags.map((tag) => {
      const usageCount = state.prompts.filter(
        (p) => p.tags && p.tags.includes(tag.id)
      ).length;
      return {
        ...tag,
        usage_count: usageCount,
      };
    });
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q));
    }
    return list.sort((a, b) => b.usage_count - a.usage_count || a.name.localeCompare(b.name));
  },

  saveTag: (tagData) => {
    const state = loadState();
    if (!tagData.name || !tagData.name.trim()) throw new Error('Tag name cannot be empty');
    if (!tagData.slug || !tagData.slug.trim()) throw new Error('Tag slug cannot be empty');

    const existingWithSlug = state.tags.find((t) => t.slug === tagData.slug && t.id !== tagData.id);
    if (existingWithSlug) throw new Error(`A tag with slug "${tagData.slug}" already exists`);

    if (tagData.id) {
      const index = state.tags.findIndex((t) => t.id === tagData.id);
      if (index === -1) throw new Error('Tag not found');
      state.tags[index] = {
        ...state.tags[index],
        name: tagData.name.trim(),
        slug: tagData.slug.trim(),
      };
      saveState(state);
      return state.tags[index];
    } else {
      const newTag = {
        id: `tag-${Date.now().toString(36)}`,
        name: tagData.name.trim(),
        slug: tagData.slug.trim(),
      };
      state.tags.push(newTag);
      saveState(state);
      return newTag;
    }
  },

  deleteTag: (id) => {
    const state = loadState();
    const inUseCount = state.prompts.filter((p) => p.tags && p.tags.includes(id)).length;
    if (inUseCount > 0) {
      throw new Error(`Cannot delete tag: it is currently attached to ${inUseCount} prompt(s). Remove the tag from those prompts first.`);
    }
    state.tags = state.tags.filter((t) => t.id !== id);
    saveState(state);
    return true;
  },

  // Collections
  getCollections: () => {
    const state = loadState();
    return state.collections.map((col) => {
      const items = state.collection_items
        .filter((ci) => ci.collection_id === col.id)
        .sort((a, b) => a.sort_order - b.sort_order);

      const itemsEnriched = items.map((item) => {
        const prompt = state.prompts.find((p) => p.id === item.prompt_id);
        const selectedMedia = item.media_id ? state.prompt_media.find((m) => m.id === item.media_id) : null;
        const coverMedia = prompt ? state.prompt_media.find((m) => m.id === prompt.cover_media_id) : null;
        return {
          ...item,
          prompt,
          media: selectedMedia || coverMedia,
        };
      });

      return {
        ...col,
        items: itemsEnriched,
        itemCount: items.length,
      };
    }).sort((a, b) => a.sort_order - b.sort_order);
  },

  saveCollection: (colData) => {
    const state = loadState();
    if (!colData.title || !colData.title.trim()) throw new Error('Collection title cannot be empty');
    if (!colData.slug || !colData.slug.trim()) throw new Error('Collection slug cannot be empty');

    const existingWithSlug = state.collections.find((c) => c.slug === colData.slug && c.id !== colData.id);
    if (existingWithSlug) throw new Error(`Collection with slug "${colData.slug}" already exists`);

    const now = new Date().toISOString();

    if (colData.id) {
      const index = state.collections.findIndex((c) => c.id === colData.id);
      if (index === -1) throw new Error('Collection not found');
      state.collections[index] = {
        ...state.collections[index],
        title: colData.title.trim(),
        slug: colData.slug.trim(),
        status: colData.status || state.collections[index].status,
        sort_order: Number(colData.sort_order) || 0,
        updated_at: now,
      };
      saveState(state);
      return state.collections[index];
    } else {
      const newCol = {
        id: `col-${Date.now().toString(36)}`,
        title: colData.title.trim(),
        slug: colData.slug.trim(),
        status: colData.status || 'draft',
        sort_order: Number(colData.sort_order) || 0,
        created_at: now,
        updated_at: now,
      };
      state.collections.push(newCol);
      saveState(state);
      return newCol;
    }
  },

  addPromptToCollection: (collectionId, promptId, mediaId = null) => {
    const state = loadState();
    const existing = state.collection_items.find(
      (ci) => ci.collection_id === collectionId && ci.prompt_id === promptId
    );
    if (existing) {
      throw new Error('This prompt is already in the collection');
    }

    const currentItems = state.collection_items.filter((ci) => ci.collection_id === collectionId);
    const maxOrder = currentItems.reduce((max, i) => Math.max(max, i.sort_order || 0), 0);

    const newItem = {
      id: `item-${Date.now().toString(36)}`,
      collection_id: collectionId,
      prompt_id: promptId,
      media_id: mediaId || null,
      sort_order: maxOrder + 1,
    };

    state.collection_items.push(newItem);
    saveState(state);
    return newItem;
  },

  updateCollectionItemOrder: (collectionId, itemIdsOrdered) => {
    const state = loadState();
    itemIdsOrdered.forEach((id, index) => {
      const item = state.collection_items.find((ci) => ci.id === id && ci.collection_id === collectionId);
      if (item) {
        item.sort_order = index + 1;
      }
    });
    saveState(state);
    return true;
  },

  removePromptFromCollection: (collectionId, promptId) => {
    const state = loadState();
    state.collection_items = state.collection_items.filter(
      (ci) => !(ci.collection_id === collectionId && ci.prompt_id === promptId)
    );
    saveState(state);
    return true;
  },

  // Dashboard Aggregates (Count queries)
  getDashboardStats: () => {
    const state = loadState();
    const prompts = state.prompts;

    const stats = {
      total: prompts.length,
      published: prompts.filter((p) => p.status === 'published').length,
      draft: prompts.filter((p) => p.status === 'draft').length,
      archived: prompts.filter((p) => p.status === 'archived').length,
      imageCount: prompts.filter((p) => p.media_type === 'image').length,
      videoCount: prompts.filter((p) => p.media_type === 'video').length,
      categoryCount: state.categories.length,
      activeCategoryCount: state.categories.filter((c) => c.is_active).length,
      collectionCount: state.collections.length,
      recentEdits: [...prompts]
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
        .slice(0, 5)
        .map((p) => {
          const cover = state.prompt_media.find((m) => m.id === p.cover_media_id);
          return {
            id: p.id,
            title: p.title,
            slug: p.slug,
            status: p.status,
            media_type: p.media_type,
            updated_at: p.updated_at,
            cover_thumb: cover?.thumbnail_path || null,
          };
        }),
    };

    return stats;
  },

  // Mobile App Settings
  getMobileSettings: () => {
    const state = loadState();
    return { ...state.app_settings };
  },

  saveMobileSettingsDraft: (draft, expectedVersion, operatorRole = 'super_admin') => {
    if (operatorRole !== 'super_admin') {
      throw new Error('Permission denied: Only Super Admin can save Mobile App Settings drafts');
    }
    const state = loadState();
    if (state.app_settings.version !== expectedVersion) {
      throw new Error(`Concurrency conflict: Settings have been modified (version ${state.app_settings.version} vs expected ${expectedVersion})`);
    }

    state.app_settings.draft_config = JSON.parse(JSON.stringify(draft));
    state.app_settings.draft_updated_at = new Date().toISOString();
    state.app_settings.draft_updated_by = 'usr-super-admin-01';
    saveState(state);
    return { ...state.app_settings };
  },

  publishMobileSettings: (expectedVersion, operatorRole = 'super_admin') => {
    if (operatorRole !== 'super_admin') {
      throw new Error('Permission denied: Only Super Admin can publish Mobile App Settings');
    }
    const state = loadState();
    if (state.app_settings.version !== expectedVersion) {
      throw new Error(`Concurrency conflict: Settings have changed (version ${state.app_settings.version} vs expected ${expectedVersion})`);
    }

    const draft = state.app_settings.draft_config;

    // Validate email
    const email = draft.links_support?.support_email;
    if (email && email.trim() && !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email.trim())) {
      throw new Error(`Invalid support email address format: ${email}`);
    }

    // Validate HTTPS for web links
    const privacy = draft.links_support?.privacy_policy_url;
    if (privacy && privacy.trim() && !privacy.trim().startsWith('https://')) {
      throw new Error('Privacy policy URL must use secure HTTPS scheme');
    }

    const playStore = draft.links_support?.play_store_url;
    if (playStore && playStore.trim() && !playStore.trim().startsWith('https://') && !playStore.trim().startsWith('market://')) {
      throw new Error('Play Store URL must use HTTPS or market:// scheme');
    }

    const isBlocking = Boolean(draft.maintenance?.update_notice?.is_blocking);
    if (isBlocking && (!playStore || !playStore.trim())) {
      throw new Error('A blocking update requires a valid Play Store URL before publishing');
    }

    // Atomic publish
    state.app_settings.previous_published_config = JSON.parse(JSON.stringify(state.app_settings.published_config));
    state.app_settings.published_config = JSON.parse(JSON.stringify(draft));
    state.app_settings.version += 1;
    state.app_settings.published_at = new Date().toISOString();
    state.app_settings.published_by = 'usr-super-admin-01';
    saveState(state);
    return { ...state.app_settings };
  },

  restoreMobileSettings: (expectedVersion, operatorRole = 'super_admin') => {
    if (operatorRole !== 'super_admin') {
      throw new Error('Permission denied: Only Super Admin can restore Mobile App Settings');
    }
    const state = loadState();
    if (state.app_settings.version !== expectedVersion) {
      throw new Error(`Concurrency conflict: Settings have changed (version ${state.app_settings.version} vs expected ${expectedVersion})`);
    }
    if (!state.app_settings.previous_published_config) {
      throw new Error('No previous published settings snapshot available to restore');
    }

    const snapshot = JSON.parse(JSON.stringify(state.app_settings.previous_published_config));
    state.app_settings.draft_config = snapshot;
    state.app_settings.published_config = snapshot;
    state.app_settings.version += 1;
    state.app_settings.published_at = new Date().toISOString();
    state.app_settings.published_by = 'usr-super-admin-01';
    saveState(state);
    return { ...state.app_settings };
  },

  getPublicMobileSettings: () => {
    const state = loadState();
    const cleanConfig = JSON.parse(JSON.stringify(state.app_settings.published_config));

    // Share URL fallback
    const playStoreUrl = cleanConfig.links_support?.play_store_url;
    const shareUrl = cleanConfig.links_support?.share_url;
    if ((!shareUrl || !shareUrl.trim()) && playStoreUrl && playStoreUrl.trim()) {
      cleanConfig.links_support.share_url = playStoreUrl.trim();
    }

    return {
      version: state.app_settings.version,
      published_at: state.app_settings.published_at,
      config: cleanConfig,
    };
  },

  // Monetization (AdMob)
  getMonetizationConfig: () => {
    const state = loadState();
    const globalSetting = (state.ad_settings || []).find((s) => s.platform === 'global') || {
      enabled: false,
      config_version: 1,
      updated_at: new Date().toISOString(),
    };
    const platformSettings = (state.ad_settings || []).filter((s) => s.platform !== 'global');
    const placements = state.ad_placements || [];

    return {
      global_enabled: Boolean(globalSetting.enabled),
      config_version: globalSetting.config_version || 1,
      updated_at: globalSetting.updated_at,
      settings: JSON.parse(JSON.stringify(platformSettings)),
      placements: JSON.parse(JSON.stringify(placements)),
    };
  },

  saveMonetizationConfig: (payload, operatorRole = 'super_admin') => {
    if (operatorRole !== 'super_admin') {
      throw new Error('Permission denied: Only Super Admin can modify monetization settings');
    }
    const state = loadState();
    let globalSetting = (state.ad_settings || []).find((s) => s.platform === 'global');
    if (!globalSetting) {
      globalSetting = { platform: 'global', enabled: false, config_version: 1 };
      state.ad_settings.push(globalSetting);
    }

    if (payload.expected_version && globalSetting.config_version !== payload.expected_version) {
      throw new Error(`Concurrency conflict: Monetization settings have been modified (version ${globalSetting.config_version} vs expected ${payload.expected_version})`);
    }

    // 1. Validate platform settings FIRST
    if (Array.isArray(payload.settings)) {
      payload.settings.forEach((set) => {
        if (set.desired_app_id && set.desired_app_id.trim()) {
          const appId = set.desired_app_id.trim();
          if (!/^ca-app-pub-[0-9]{16}~[0-9]{10}$/i.test(appId)) {
            throw new Error(`Invalid AdMob App ID format (expected ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX): ${appId}`);
          }
        }
      });
    }

    // 2. Validate placements FIRST
    if (Array.isArray(payload.placements)) {
      payload.placements.forEach((plc) => {
        const unitId = plc.ad_unit_id ? plc.ad_unit_id.trim() : '';
        if (unitId) {
          if (!/^ca-app-pub-[0-9]{16}\/[0-9]{10}$/i.test(unitId)) {
            throw new Error(`Invalid AdMob Ad Unit ID format (expected ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX): ${unitId}`);
          }
        }
        if (plc.enabled && !unitId) {
          throw new Error(`Placement ${plc.placement_key} for ${plc.platform} cannot be enabled without a valid Ad Unit ID`);
        }
        if (plc.placement_key === 'app_open') {
          if (plc.skip_first_n_launches !== null && plc.skip_first_n_launches !== undefined && Number(plc.skip_first_n_launches) < 1) {
            throw new Error('skip_first_n_launches must be at least 1 to prevent first-ever-launch ads');
          }
          if (plc.min_background_seconds !== null && plc.min_background_seconds !== undefined) {
            const bg = Number(plc.min_background_seconds);
            if (bg < 5 || bg > 3600) {
              throw new Error('min_background_seconds must be between 5 and 3600 seconds');
            }
          }
        }
      });
    }

    // 3. Apply mutations atomically
    const newVersion = (globalSetting.config_version || 1) + 1;
    const nowIso = new Date().toISOString();

    globalSetting.enabled = Boolean(payload.global_enabled);
    globalSetting.config_version = newVersion;
    globalSetting.updated_at = nowIso;
    globalSetting.updated_by = 'usr-super-admin-01';

    if (Array.isArray(payload.settings)) {
      payload.settings.forEach((set) => {
        let existing = state.ad_settings.find((s) => s.platform === set.platform);
        if (!existing) {
          existing = { platform: set.platform };
          state.ad_settings.push(existing);
        }
        existing.desired_app_id = set.desired_app_id && set.desired_app_id.trim() ? set.desired_app_id.trim() : null;
        existing.enabled = Boolean(set.enabled);
        existing.config_version = newVersion;
        existing.updated_at = nowIso;
        existing.updated_by = 'usr-super-admin-01';
      });
    }

    if (Array.isArray(payload.placements)) {
      payload.placements.forEach((plc) => {
        let existingPlc = state.ad_placements.find(
          (p) => p.placement_key === plc.placement_key && p.platform === plc.platform
        );
        if (!existingPlc) {
          existingPlc = { placement_key: plc.placement_key, platform: plc.platform };
          state.ad_placements.push(existingPlc);
        }
        existingPlc.ad_unit_id = plc.ad_unit_id && plc.ad_unit_id.trim() ? plc.ad_unit_id.trim() : null;
        existingPlc.ad_format = plc.ad_format;
        existingPlc.enabled = Boolean(plc.enabled);
        existingPlc.min_interval_seconds = plc.min_interval_seconds ?? null;
        existingPlc.max_impressions_per_session = plc.max_impressions_per_session ?? null;
        existingPlc.min_navigation_events = plc.min_navigation_events ?? null;
        existingPlc.first_session_grace_seconds = plc.first_session_grace_seconds ?? null;
        existingPlc.show_on_cold_start = plc.show_on_cold_start !== undefined ? Boolean(plc.show_on_cold_start) : true;
        existingPlc.show_on_foreground_return = plc.show_on_foreground_return !== undefined ? Boolean(plc.show_on_foreground_return) : true;
        existingPlc.min_background_seconds = plc.min_background_seconds ?? null;
        existingPlc.skip_first_n_launches = plc.skip_first_n_launches ?? null;
        existingPlc.updated_at = nowIso;
        existingPlc.updated_by = 'usr-super-admin-01';
      });
    }

    saveState(state);
    return {
      success: true,
      config_version: newVersion,
      updated_at: nowIso,
    };
  },

  getPublicMonetizationConfig: (platform = 'android') => {
    const state = loadState();
    const targetPlatform = platform.toLowerCase() === 'ios' ? 'ios' : 'android';
    const globalSetting = (state.ad_settings || []).find((s) => s.platform === 'global');
    const platSetting = (state.ad_settings || []).find((s) => s.platform === targetPlatform);

    const globalEnabled = Boolean(globalSetting?.enabled);
    const platformEnabled = Boolean(platSetting?.enabled);
    const adsActive = globalEnabled && platformEnabled;
    const version = globalSetting?.config_version || 1;

    const placementsObj = {};
    (state.ad_placements || [])
      .filter((p) => p.platform === targetPlatform)
      .forEach((p) => {
        if (p.ad_format === 'app_open') {
          placementsObj[p.placement_key] = {
            format: p.ad_format,
            ad_unit_id: p.ad_unit_id || '',
            enabled: adsActive && Boolean(p.enabled) && Boolean(p.ad_unit_id),
            cooldown_seconds: p.min_interval_seconds ?? 300,
            min_interval_seconds: p.min_interval_seconds ?? 300,
            max_impressions_per_session: p.max_impressions_per_session ?? 2,
            show_on_cold_start: p.show_on_cold_start !== false,
            show_on_foreground_return: p.show_on_foreground_return !== false,
            min_background_seconds: p.min_background_seconds ?? 60,
            skip_first_n_launches: p.skip_first_n_launches ?? 2,
          };
        } else {
          placementsObj[p.placement_key] = {
            format: p.ad_format,
            ad_unit_id: p.ad_unit_id || '',
            enabled: adsActive && Boolean(p.enabled) && Boolean(p.ad_unit_id),
            min_interval_seconds: p.min_interval_seconds ?? 180,
            max_impressions_per_session: p.max_impressions_per_session ?? 3,
            min_navigation_events: p.min_navigation_events ?? 4,
            first_session_grace_seconds: p.first_session_grace_seconds ?? 60,
          };
        }
      });

    return {
      version,
      global_enabled: globalEnabled,
      platform_enabled: platformEnabled,
      ads_active: adsActive,
      placements: placementsObj,
    };
  },
};
