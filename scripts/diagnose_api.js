// scripts/diagnose_api.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nwpwnxcxpwwzajvqyygf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_d4O-GtMnrScPZ8dMs-wgjg_jISHWXLW';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runDiagnostics() {
  console.log('=== RUNNING LIVE API QUERY DIAGNOSTICS ===\n');

  // 1. Categories
  const catRes = await sb.from('categories').select('*, prompt_categories(count)').order('sort_order', { ascending: true });
  console.log('1. Categories:', catRes.error ? catRes.error.message : `OK (${catRes.data.length})`);

  // 2. Tags
  const tagRes = await sb.from('tags').select('*, prompt_tags(count)');
  console.log('2. Tags:', tagRes.error ? tagRes.error.message : `OK (${tagRes.data.length})`);

  // 3. Collections
  const colRes = await sb.from('collections').select(`
    *,
    items:collection_items(
      id, sort_order, prompt_id, media_id,
      prompt:prompts(id, title, slug, cover_media_id),
      media:prompt_media(id, thumbnail_path, preview_path)
    )
  `);
  console.log('3. Collections:', colRes.error ? colRes.error.message : `OK (${colRes.data.length})`);

  // 4. Prompts list
  const promptRes = await sb.from('prompts').select(`
    id, slug, title, media_type, status, cover_media_id, published_at, updated_at,
    cover:prompt_media!prompts_cover_media_fkey(thumbnail_path, preview_path),
    prompt_categories(category:categories(id, name, slug))
  `, { count: 'exact' });
  console.log('4. Prompts list:', promptRes.error ? promptRes.error.message : `OK (${promptRes.data.length})`);

  // 5. If prompts exist, test getById
  if (promptRes.data && promptRes.data.length > 0) {
    const testId = promptRes.data[0].id;
    const detailRes = await sb.from('prompts').select(`
      *,
      media:prompt_media!prompt_media_prompt_id_fkey(*),
      prompt_categories(category_id),
      prompt_tags(tag_id)
    `).eq('id', testId).single();

    if (detailRes.error) {
      console.error('5. Prompt getById [FAIL]:', detailRes.error);
    } else {
      console.log('5. Prompt getById [PASS]:', detailRes.data.title, 'media items:', detailRes.data.media?.length);
    }
  }

  // 6. Test Team member list
  const memberRes = await sb.from('admin_members').select('*');
  console.log('6. Admin members:', memberRes.error ? memberRes.error.message : `OK (${memberRes.data.length})`);
}

runDiagnostics();
