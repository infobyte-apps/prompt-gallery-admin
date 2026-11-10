import { supabase, isLiveSupabaseConfigured } from '../lib/supabaseClient.js';
import { mockStore } from '../lib/mockStore.js';
import { getImageVariant, deleteImageKitAsset } from '../lib/imagekit.js';

export const api = {
  // Authentication & Membership
  auth: {
    async getSession() {
      if (isLiveSupabaseConfigured && supabase) {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!session) return null;

        // Fetch user's role from admin_members (using maybeSingle to handle non-members cleanly)
        const { data: member } = await supabase
          .from('admin_members')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle();

        return {
          user: session.user,
          role: member ? member.role : null,
        };
      }
      return null;
    },

    onAuthStateChange(callback) {
      if (isLiveSupabaseConfigured && supabase) {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (!session) {
            callback(null);
            return;
          }
          try {
            const { data: member } = await supabase
              .from('admin_members')
              .select('role')
              .eq('user_id', session.user.id)
              .maybeSingle();

            callback({
              user: session.user,
              role: member?.role || null,
            });
          } catch {
            callback({
              user: session.user,
              role: null,
            });
          }
        });
        return subscription;
      }
      return { unsubscribe: () => {} };
    },

    async signIn(email, password) {
      if (isLiveSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const { data: member } = await supabase
          .from('admin_members')
          .select('role')
          .eq('user_id', data.user.id)
          .maybeSingle();

        return {
          user: data.user,
          role: member ? member.role : null,
        };
      }
      throw new Error('Supabase client is not configured');
    },

    async signOut() {
      if (isLiveSupabaseConfigured) {
        await supabase.auth.signOut();
      } else {
        localStorage.removeItem('demo_auth_session');
      }
    },

    async resetPassword(email) {
      if (isLiveSupabaseConfigured) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/recovery`,
        });
        if (error) throw error;
      }
      return { success: true };
    },

    async updatePassword(newPassword) {
      if (isLiveSupabaseConfigured) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
      }
      return { success: true };
    },

    async bootstrapSuperAdmin(userId, email) {
      if (isLiveSupabaseConfigured) {
        const { data, error } = await supabase.rpc('bootstrap_first_super_admin', {
          operator_uuid: userId,
        });
        if (error) throw error;
        return data;
      } else {
        return mockStore.bootstrapFirstSuperAdmin(userId, email);
      }
    },
  },

  // Dashboard Aggregates
  dashboard: {
    async getStats() {
      if (isLiveSupabaseConfigured) {
        // Run count queries without loading the full catalog as mandated by SRS A02
        const [
          { count: totalCount },
          { count: publishedCount },
          { count: draftCount },
          { count: archivedCount },
          { count: imageCount },
          { count: videoCount },
          { count: categoryCount },
          { data: recentPrompts },
        ] = await Promise.all([
          supabase.from('prompts').select('*', { count: 'exact', head: true }),
          supabase.from('prompts').select('*', { count: 'exact', head: true }).eq('status', 'published'),
          supabase.from('prompts').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
          supabase.from('prompts').select('*', { count: 'exact', head: true }).eq('status', 'archived'),
          supabase.from('prompts').select('*', { count: 'exact', head: true }).eq('media_type', 'image'),
          supabase.from('prompts').select('*', { count: 'exact', head: true }).eq('media_type', 'video'),
          supabase.from('categories').select('*', { count: 'exact', head: true }),
          supabase.from('prompts').select('id, title, slug, status, media_type, updated_at').order('updated_at', { ascending: false }).limit(5),
        ]);

        return {
          total: totalCount || 0,
          published: publishedCount || 0,
          draft: draftCount || 0,
          archived: archivedCount || 0,
          imageCount: imageCount || 0,
          videoCount: videoCount || 0,
          categoryCount: categoryCount || 0,
          recentEdits: recentPrompts || [],
        };
      } else {
        return mockStore.getDashboardStats();
      }
    },
  },

  // Prompts CRUD
  prompts: {
    async list(params) {
      if (isLiveSupabaseConfigured) {
        const { page = 1, limit = 20, search, status, media_type, sortField = 'updated_at', sortDir = 'desc' } = params || {};
        let query = supabase.from('prompts').select(`
          id, slug, title, media_type, status, cover_media_id, published_at, updated_at,
          cover:prompt_media!prompts_cover_media_fkey(thumbnail_path, preview_path, image_url, source_type),
          prompt_categories(category:categories(id, name, slug))
        `, { count: 'exact' });

        if (status && status !== 'all') query = query.eq('status', status);
        if (media_type && media_type !== 'all') query = query.eq('media_type', media_type);
        if (search) query = query.ilike('title', `%${search}%`);

        query = query.order(sortField, { ascending: sortDir === 'asc' });
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        query = query.range(from, to);

        const { data, count, error } = await query;
        if (error) throw error;

        return {
          data: data.map((d) => ({
            ...d,
            cover: d.cover,
            categoryObjects: d.prompt_categories?.map((pc) => pc.category) || [],
          })),
          total: count || 0,
          page,
          limit,
          totalPages: Math.ceil((count || 0) / limit) || 1,
        };
      } else {
        return mockStore.getPrompts(params);
      }
    },

    async getById(id) {
      if (isLiveSupabaseConfigured) {
        const { data: prompt, error } = await supabase
          .from('prompts')
          .select(`
            *,
            media:prompt_media!prompt_media_prompt_id_fkey(*),
            prompt_categories(category_id),
            prompt_tags(tag_id)
          `)
          .eq('id', id)
          .single();

        if (error) throw error;
        return {
          ...prompt,
          categories: prompt.prompt_categories?.map((pc) => pc.category_id) || [],
          tags: prompt.prompt_tags?.map((pt) => pt.tag_id) || [],
          cover: prompt.media?.find((m) => m.id === prompt.cover_media_id) || null,
        };
      } else {
        return mockStore.getPromptById(id);
      }
    },

    async save(promptData, currentUser) {
      if (isLiveSupabaseConfigured) {
        // Enforce optimistic concurrency check
        if (promptData.id && promptData.original_updated_at) {
          const { data: currentRecord } = await supabase
            .from('prompts')
            .select('updated_at')
            .eq('id', promptData.id)
            .single();

          if (currentRecord && currentRecord.updated_at !== promptData.original_updated_at) {
            throw new Error('Concurrency Conflict: This prompt was updated by another session. Please reload to see the latest changes.');
          }
        }

        const isUuid = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

        const payload = {};
        if (promptData.slug !== undefined) payload.slug = promptData.slug;
        if (promptData.title !== undefined) payload.title = promptData.title;
        if (promptData.prompt_text !== undefined) payload.prompt_text = promptData.prompt_text;
        if (promptData.media_type !== undefined) payload.media_type = promptData.media_type;
        if (promptData.status !== undefined) payload.status = promptData.status;
        if (promptData.cover_media_id !== undefined) {
          payload.cover_media_id = isUuid(promptData.cover_media_id) ? promptData.cover_media_id : null;
        }

        let result;
        if (promptData.id) {
          const { data, error } = await supabase
            .from('prompts')
            .update(payload)
            .eq('id', promptData.id)
            .select()
            .single();
          if (error) throw error;
          result = data;
        } else {
          const { data, error } = await supabase
            .from('prompts')
            .insert(payload)
            .select()
            .single();
          if (error) throw error;
          result = data;
        }

        // Sync categories & tags
        if (promptData.categories) {
          await supabase.from('prompt_categories').delete().eq('prompt_id', result.id);
          if (promptData.categories.length > 0) {
            const rows = promptData.categories.map((cId) => ({ prompt_id: result.id, category_id: cId }));
            await supabase.from('prompt_categories').insert(rows);
          }
        }
        if (promptData.tags) {
          await supabase.from('prompt_tags').delete().eq('prompt_id', result.id);
          if (promptData.tags.length > 0) {
            const rows = promptData.tags.map((tId) => ({ prompt_id: result.id, tag_id: tId }));
            await supabase.from('prompt_tags').insert(rows);
          }
        }

        return result;
      } else {
        return mockStore.savePrompt(promptData, currentUser);
      }
    },

    async archive(id, currentUser) {
      return this.save({ id, status: 'archived' }, currentUser);
    },

    async publish(id, currentUser) {
      return this.save({ id, status: 'published' }, currentUser);
    },

    async addMedia(promptId, mediaItem) {
      if (isLiveSupabaseConfigured && supabase) {
        const sourceType = mediaItem.source_type || 'imagekit';
        const imageUrl = mediaItem.image_url || mediaItem.storage_path;
        const fileId = mediaItem.imagekit_file_id || null;

        let storagePath = imageUrl;
        let thumbnailPath = mediaItem.thumbnail_path || getImageVariant(imageUrl, sourceType, 'thumbnail');
        let previewPath = mediaItem.preview_path || getImageVariant(imageUrl, sourceType, 'preview');

        // Legacy / Video file upload fallback to Supabase Storage if binary file attached
        if (mediaItem.file) {
          try {
            const ext = mediaItem.file.name.split('.').pop() || 'jpg';
            const uploadName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;
            const remotePath = `${promptId}/${uploadName}`;

            const { error: uploadErr } = await supabase.storage
              .from('delivery-media')
              .upload(remotePath, mediaItem.file, { upsert: true });

            if (uploadErr) {
              await supabase.storage
                .from('draft-media')
                .upload(remotePath, mediaItem.file, { upsert: true });
            }

            const { data: { publicUrl } } = supabase.storage
              .from('delivery-media')
              .getPublicUrl(remotePath);

            storagePath = publicUrl;
            thumbnailPath = publicUrl;
            previewPath = publicUrl;
          } catch (storageErr) {
            console.warn('Storage upload error, using local preview URL:', storageErr);
          }
        }

        const { data, error } = await supabase
          .from('prompt_media')
          .insert({
            prompt_id: promptId,
            source_type: sourceType,
            image_url: imageUrl || storagePath,
            imagekit_file_id: fileId,
            storage_path: storagePath || imageUrl,
            thumbnail_path: thumbnailPath,
            preview_path: previewPath,
            alt_text: mediaItem.alt_text || '',
            width: mediaItem.width || 1200,
            height: mediaItem.height || 800,
            byte_size: mediaItem.byte_size || 0,
            duration_ms: mediaItem.duration_ms || null,
            sort_order: mediaItem.sort_order || 1,
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        return mockStore.addMedia(promptId, mediaItem);
      }
    },

    async updateMedia(mediaId, updates) {
      if (isLiveSupabaseConfigured) {
        const { data, error } = await supabase
          .from('prompt_media')
          .update(updates)
          .eq('id', mediaId)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        return mockStore.updateMedia(mediaId, updates);
      }
    },

    async deleteMedia(promptId, mediaId, fallbackCoverId = null) {
      if (isLiveSupabaseConfigured) {
        // 1. Inspect target media row for ImageKit file ID
        const { data: targetMedia } = await supabase
          .from('prompt_media')
          .select('id, imagekit_file_id')
          .eq('id', mediaId)
          .maybeSingle();

        const fileIdToCleanup = targetMedia?.imagekit_file_id;

        // 2. Disassociate cover_media_id if it references this media item first
        const { data: currentPrompt } = await supabase
          .from('prompts')
          .select('cover_media_id')
          .eq('id', promptId)
          .maybeSingle();

        if (currentPrompt && currentPrompt.cover_media_id === mediaId) {
          await supabase
            .from('prompts')
            .update({ cover_media_id: fallbackCoverId })
            .eq('id', promptId);
        }

        // 3. Delete from prompt_media table
        const { error } = await supabase
          .from('prompt_media')
          .delete()
          .eq('id', mediaId);
        if (error) throw error;

        // 4. Protected deletion: Clean up ImageKit asset only if not referenced elsewhere
        if (fileIdToCleanup) {
          try {
            await deleteImageKitAsset(fileIdToCleanup);
          } catch (cleanErr) {
            console.warn('ImageKit cleanup notice:', cleanErr.message);
          }
        }

        return true;
      } else {
        return mockStore.deleteMedia(promptId, mediaId);
      }
    },
  },

  // Categories CRUD
  categories: {
    async list() {
      if (isLiveSupabaseConfigured) {
        const { data, error } = await supabase
          .from('categories')
          .select('id, slug, name, sort_order, is_active, cover_storage_path, cover_source_type, cover_image_url, cover_imagekit_file_id, prompt_categories(count)')
          .order('sort_order', { ascending: true });
        if (error) throw error;
        return data.map((d) => ({
          ...d,
          usage_count: d.prompt_categories?.[0]?.count || 0,
        }));
      } else {
        return mockStore.getCategories();
      }
    },

    async save(categoryData) {
      if (isLiveSupabaseConfigured) {
        const coverUrl = categoryData.cover_image_url || categoryData.cover_storage_path || null;
        const payload = {
          name: categoryData.name,
          slug: categoryData.slug,
          sort_order: categoryData.sort_order,
          is_active: categoryData.is_active,
          cover_source_type: categoryData.cover_source_type || 'imagekit',
          cover_image_url: coverUrl,
          cover_imagekit_file_id: categoryData.cover_imagekit_file_id || null,
          cover_storage_path: coverUrl,
        };

        if (categoryData.id) {
          const { data, error } = await supabase
            .from('categories')
            .update(payload)
            .eq('id', categoryData.id)
            .select()
            .single();
          if (error) throw error;
          return data;
        } else {
          const { data, error } = await supabase
            .from('categories')
            .insert(payload)
            .select()
            .single();
          if (error) throw error;
          return data;
        }
      } else {
        return mockStore.saveCategory(categoryData);
      }
    },

    async delete(id) {
      if (isLiveSupabaseConfigured) {
        // Fetch category to get cover file ID for cleanup
        const { data: cat } = await supabase
          .from('categories')
          .select('cover_imagekit_file_id')
          .eq('id', id)
          .maybeSingle();

        const fileIdToCleanup = cat?.cover_imagekit_file_id;

        const { error } = await supabase.from('categories').delete().eq('id', id);
        if (error) throw error;

        if (fileIdToCleanup) {
          try {
            await deleteImageKitAsset(fileIdToCleanup);
          } catch (cleanErr) {
            console.warn('ImageKit category asset cleanup notice:', cleanErr.message);
          }
        }

        return true;
        return true;
      } else {
        return mockStore.deleteCategory(id);
      }
    },
  },

  // Tags CRUD
  tags: {
    async list(search) {
      if (isLiveSupabaseConfigured) {
        let query = supabase.from('tags').select('*, prompt_tags(count)');
        if (search) query = query.ilike('name', `%${search}%`);
        const { data, error } = await query;
        if (error) throw error;
        return data.map((d) => ({
          ...d,
          usage_count: d.prompt_tags?.[0]?.count || 0,
        }));
      } else {
        return mockStore.getTags(search);
      }
    },

    async save(tagData) {
      if (isLiveSupabaseConfigured) {
        if (tagData.id) {
          const { data, error } = await supabase
            .from('tags')
            .update({ name: tagData.name, slug: tagData.slug })
            .eq('id', tagData.id)
            .select()
            .single();
          if (error) throw error;
          return data;
        } else {
          const { data, error } = await supabase
            .from('tags')
            .insert({ name: tagData.name, slug: tagData.slug })
            .select()
            .single();
          if (error) throw error;
          return data;
        }
      } else {
        return mockStore.saveTag(tagData);
      }
    },

    async delete(id) {
      if (isLiveSupabaseConfigured) {
        const { error } = await supabase.from('tags').delete().eq('id', id);
        if (error) throw error;
        return true;
      } else {
        return mockStore.deleteTag(id);
      }
    },
  },

  // Collections CRUD
  collections: {
    async list() {
      if (isLiveSupabaseConfigured) {
        const { data, error } = await supabase
          .from('collections')
          .select(`
            *,
            items:collection_items(
              id, sort_order, prompt_id, media_id,
              prompt:prompts(id, title, slug, cover_media_id),
              media:prompt_media(id, thumbnail_path, preview_path, image_url, source_type)
            )
          `)
          .order('sort_order', { ascending: true });
        if (error) throw error;
        return data.map((c) => ({
          ...c,
          itemCount: c.items?.length || 0,
        }));
      } else {
        return mockStore.getCollections();
      }
    },

    async save(colData) {
      if (isLiveSupabaseConfigured) {
        if (colData.id) {
          const { data, error } = await supabase
            .from('collections')
            .update({
              title: colData.title,
              slug: colData.slug,
              status: colData.status,
              sort_order: colData.sort_order,
            })
            .eq('id', colData.id)
            .select()
            .single();
          if (error) throw error;
          return data;
        } else {
          const { data, error } = await supabase
            .from('collections')
            .insert({
              title: colData.title,
              slug: colData.slug,
              status: colData.status,
              sort_order: colData.sort_order,
            })
            .select()
            .single();
          if (error) throw error;
          return data;
        }
      } else {
        return mockStore.saveCollection(colData);
      }
    },

    async addPrompt(collectionId, promptId, mediaId = null) {
      if (isLiveSupabaseConfigured) {
        const isUuid = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

        const { count } = await supabase
          .from('collection_items')
          .select('*', { count: 'exact', head: true })
          .eq('collection_id', collectionId);

        const { data, error } = await supabase
          .from('collection_items')
          .insert({
            collection_id: collectionId,
            prompt_id: promptId,
            media_id: isUuid(mediaId) ? mediaId : null,
            sort_order: (count || 0) + 1,
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        return mockStore.addPromptToCollection(collectionId, promptId, mediaId);
      }
    },

    async removePrompt(collectionId, promptId) {
      if (isLiveSupabaseConfigured) {
        const { error } = await supabase
          .from('collection_items')
          .delete()
          .match({ collection_id: collectionId, prompt_id: promptId });
        if (error) throw error;
        return true;
      } else {
        return mockStore.removePromptFromCollection(collectionId, promptId);
      }
    },

    async updateOrder(collectionId, orderedIds) {
      if (isLiveSupabaseConfigured) {
        for (let i = 0; i < orderedIds.length; i++) {
          await supabase
            .from('collection_items')
            .update({ sort_order: i + 1 })
            .eq('id', orderedIds[i]);
        }
        return true;
      } else {
        return mockStore.updateCollectionItemOrder(collectionId, orderedIds);
      }
    },
  },

  // Team CRUD (Super Admin only)
  team: {
    async list() {
      if (isLiveSupabaseConfigured) {
        const { data, error } = await supabase
          .from('admin_members')
          .select('*')
          .order('created_at', { ascending: true });
        if (error) throw error;
        return data;
      } else {
        return mockStore.getAdminMembers();
      }
    },

    async addMember(userId, email, role) {
      if (isLiveSupabaseConfigured) {
        const { data, error } = await supabase
          .from('admin_members')
          .insert({ user_id: userId, role })
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        return mockStore.addMember(userId, email, role);
      }
    },

    async updateRole(userId, newRole) {
      if (isLiveSupabaseConfigured) {
        const { data, error } = await supabase
          .from('admin_members')
          .update({ role: newRole })
          .eq('user_id', userId)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        return mockStore.updateMemberRole(userId, newRole);
      }
    },

    async removeMember(userId) {
      if (isLiveSupabaseConfigured) {
        const { error } = await supabase
          .from('admin_members')
          .delete()
          .eq('user_id', userId);
        if (error) throw error;
        return true;
      } else {
        return mockStore.removeMember(userId);
      }
    },
  },

  // Mobile App Settings Module
  mobileSettings: {
    async get(env = 'production') {
      if (isLiveSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('app_settings')
          .select('*')
          .eq('environment', env)
          .maybeSingle();
        if (error) throw error;
        if (!data) return mockStore.getMobileSettings();
        return data;
      }
      return mockStore.getMobileSettings();
    },

    async saveDraft(draftConfig, expectedVersion, env = 'production') {
      if (isLiveSupabaseConfigured && supabase) {
        const { data, error } = await supabase.rpc('save_mobile_app_settings_draft', {
          p_draft: draftConfig,
          p_expected_version: expectedVersion,
          p_env: env,
        });
        if (error) throw error;
        return data;
      }
      return mockStore.saveMobileSettingsDraft(draftConfig, expectedVersion);
    },

    async publish(expectedVersion, env = 'production') {
      if (isLiveSupabaseConfigured && supabase) {
        const { data, error } = await supabase.rpc('publish_mobile_app_settings', {
          p_expected_version: expectedVersion,
          p_env: env,
        });
        if (error) throw error;
        return data;
      }
      return mockStore.publishMobileSettings(expectedVersion);
    },

    async restore(expectedVersion, env = 'production') {
      if (isLiveSupabaseConfigured && supabase) {
        const { data, error } = await supabase.rpc('restore_mobile_app_settings', {
          p_expected_version: expectedVersion,
          p_env: env,
        });
        if (error) throw error;
        return data;
      }
      return mockStore.restoreMobileSettings(expectedVersion);
    },

    async getPublicConfig(env = 'production') {
      if (isLiveSupabaseConfigured && supabase) {
        const { data, error } = await supabase.rpc('get_public_mobile_settings', {
          p_env: env,
        });
        if (error) throw error;
        return data;
      }
      return mockStore.getPublicMobileSettings();
    },
  },

  // Monetization Module
  monetization: {
    async getConfig() {
      if (isLiveSupabaseConfigured && supabase) {
        const [settingsRes, placementsRes] = await Promise.all([
          supabase.from('ad_settings').select('*'),
          supabase.from('ad_placements').select('*'),
        ]);

        if (settingsRes.error) throw settingsRes.error;
        if (placementsRes.error) throw placementsRes.error;

        const allSettings = settingsRes.data || [];
        const globalSetting = allSettings.find((s) => s.platform === 'global') || {
          enabled: false,
          config_version: 1,
          updated_at: new Date().toISOString(),
        };
        const platformSettings = allSettings.filter((s) => s.platform !== 'global');

        return {
          global_enabled: Boolean(globalSetting.enabled),
          config_version: globalSetting.config_version || 1,
          updated_at: globalSetting.updated_at,
          settings: platformSettings,
          placements: placementsRes.data || [],
        };
      }
      return mockStore.getMonetizationConfig();
    },

    async saveConfig(payload) {
      if (isLiveSupabaseConfigured && supabase) {
        const { data, error } = await supabase.rpc('save_monetization_config', {
          p_global_enabled: Boolean(payload.global_enabled),
          p_settings: payload.settings || [],
          p_placements: payload.placements || [],
          p_expected_version: payload.expected_version || 1,
        });
        if (error) throw error;
        return data;
      }
      return mockStore.saveMonetizationConfig(payload);
    },

    async getPublicConfig(platform = 'android') {
      if (isLiveSupabaseConfigured && supabase) {
        const { data, error } = await supabase.rpc('get_public_monetization_config', {
          p_platform: platform,
        });
        if (error) throw error;
        return data;
      }
      return mockStore.getPublicMonetizationConfig(platform);
    },
  },
};

