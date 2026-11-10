// scripts/verify_connection.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nwpwnxcxpwwzajvqyygf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_d4O-GtMnrScPZ8dMs-wgjg_jISHWXLW';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testConnection() {
  console.log(`Checking connection to: ${SUPABASE_URL}`);

  const tables = ['prompts', 'categories', 'tags', 'collections', 'admin_members'];
  const results = {};

  for (const t of tables) {
    try {
      const { data, error, count } = await supabase.from(t).select('*', { count: 'exact', head: true });
      if (error) {
        results[t] = { exists: false, error: error.message, code: error.code };
      } else {
        results[t] = { exists: true, count: count || 0 };
      }
    } catch (err) {
      results[t] = { exists: false, error: err.message };
    }
  }

  console.log('\nTable Inspection Results:');
  console.table(results);

  const allExist = Object.values(results).every(r => r.exists);
  if (allExist) {
    console.log('\n[SUCCESS] All core tables exist and are accessible via Data API!');
  } else {
    console.log('\n[PENDING] Tables not found yet in schema cache.');
    console.log('Execute `supabase/full_schema_setup.sql` in your Supabase SQL Editor:');
    console.log(`https://supabase.com/dashboard/project/nwpwnxcxpwwzajvqyygf/sql/new`);
  }
}

testConnection();

