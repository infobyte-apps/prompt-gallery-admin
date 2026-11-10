// scripts/bootstrap_admin.js
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'nwpwnxcxpwwzajvqyygf';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const OPERATOR_UUID = process.env.OPERATOR_UUID || '4e09b48f-da2b-4f34-930d-6ce0b6b6da27';

if (!ACCESS_TOKEN) {
  console.error('Error: SUPABASE_ACCESS_TOKEN environment variable is required.');
  process.exit(1);
}

async function bootstrap() {
  const query = `SELECT public.bootstrap_first_super_admin('${OPERATOR_UUID}'::UUID);`;

  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  const data = await res.json();
  console.log('Bootstrap Result:', data);

  // Check admin_members table
  const checkRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: 'SELECT * FROM public.admin_members;' }),
  });
  const members = await checkRes.json();
  console.log('Admin Members in database:', members);
}

bootstrap();

