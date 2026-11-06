import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing Supabase credentials in .env or .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function keepAlive() {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] 🔄 Pinging Supabase to prevent inactivity pause...`);

  try {
    const { data, error, count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact' })
      .limit(1);

    const latency = Date.now() - startTime;

    if (error) {
      console.error(`❌ Supabase Ping Failed (${latency}ms):`, error.message);
      process.exit(1);
    }

    console.log(`✅ Supabase is ACTIVE & HEALTHY!`);
    console.log(`   - Response Latency: ${latency}ms`);
    console.log(`   - Sample record fetched: ${data && data.length > 0 ? 'Yes' : 'No records yet (table exists)'}`);
    console.log(`   - Supabase project URL: ${supabaseUrl}`);
    console.log(`   - Status: Project activity registered successfully. Supabase will not sleep.`);
  } catch (err) {
    console.error('❌ Unexpected error during keepalive:', err);
    process.exit(1);
  }
}

keepAlive();
