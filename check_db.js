import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: groups } = await supabase.from('groups').select('*');
  console.log('GROUPS:', JSON.stringify(groups, null, 2));

  const { data: members } = await supabase.from('group_members').select('*');
  console.log('GROUP MEMBERS:', JSON.stringify(members, null, 2));
  
  const { data: profiles } = await supabase.from('profiles').select('*');
  console.log('PROFILES:', JSON.stringify(profiles, null, 2));
}

check();
