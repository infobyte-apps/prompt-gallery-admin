// scripts/apply_migrations.js
import fs from 'fs';
import path from 'path';

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'nwpwnxcxpwwzajvqyygf';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error('Error: SUPABASE_ACCESS_TOKEN environment variable is required.');
  process.exit(1);
}

const migrationFiles = [
  'supabase/migrations/20261109000001_create_schema.sql',
  'supabase/migrations/20261109000002_rls_and_policies.sql',
  'supabase/migrations/20261109000003_storage_policies.sql',
  'supabase/migrations/20261109000004_seed_data.sql',
];

async function executeSql(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || JSON.stringify(body));
  }
  return body;
}

async function run() {
  console.log(`Applying migrations to live project: ${PROJECT_REF} ...\n`);

  for (const relPath of migrationFiles) {
    const fullPath = path.resolve(relPath);
    console.log(`Executing ${relPath}...`);
    const sql = fs.readFileSync(fullPath, 'utf8');

    try {
      const result = await executeSql(sql);
      console.log(`  -> SUCCESS! (${relPath})\n`);
    } catch (err) {
      console.error(`  -> FAILED (${relPath}):`, err.message);
      process.exit(1);
    }
  }

  console.log('All migrations executed successfully! Verifying schema...');
}

run();

