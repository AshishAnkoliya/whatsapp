import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Ensure this route is never cached by Next.js or CDN
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Use service role key if available, fallback to anon key
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function GET(request: Request) {
  const startTime = Date.now();
  const url = new URL(request.url);
  const isDetailed = url.searchParams.get('detailed') === 'true';

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  // Masked URL for safe display
  const maskedUrl = supabaseUrl
    ? supabaseUrl.replace(/https:\/\/(.{4}).*?(\.supabase\.co.*)/, 'https://$1***$2')
    : 'Not configured';

  const client = getSupabaseClient();

  if (!client) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Supabase credentials missing in environment variables',
        timestamp: new Date().toISOString(),
        supabase: {
          connected: false,
          error: 'Missing NEXT_PUBLIC_SUPABASE_URL or keys',
        },
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  }

  try {
    // Perform an active, lightweight query to register activity on Supabase.
    // Querying 'profiles' table ensures PostgreSQL executes a read query.
    const { data, error, count } = await client
      .from('profiles')
      .select('id', { count: 'exact' })
      .limit(1);

    const latencyMs = Date.now() - startTime;

    if (error) {
      console.error('[Health API] Supabase query error:', error.message);
      return NextResponse.json(
        {
          status: 'degraded',
          message: 'Supabase connection attempted but encountered an error. The database may be paused or initializing.',
          timestamp: new Date().toISOString(),
          latencyMs,
          supabase: {
            connected: false,
            url: maskedUrl,
            error: error.message,
            code: error.code,
            hint: 'If paused on Supabase free tier, log into https://supabase.com/dashboard to restore.',
          },
        },
        {
          status: 503,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
        }
      );
    }

    return NextResponse.json(
      {
        status: 'healthy',
        message: 'Supabase is active and responsive. Keep-alive ping successful.',
        timestamp: new Date().toISOString(),
        latencyMs,
        supabase: {
          connected: true,
          status: 'active',
          url: maskedUrl,
          recordCount: count ?? (data ? data.length : 0),
        },
        system: isDetailed
          ? {
              uptimeSeconds: Math.floor(process.uptime()),
              nodeVersion: process.version,
              environment: process.env.NODE_ENV || 'development',
            }
          : undefined,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : 'Unknown server error';
    console.error('[Health API] Unexpected error during keep-alive:', err);

    return NextResponse.json(
      {
        status: 'error',
        message: 'Health check failed unexpectedly',
        timestamp: new Date().toISOString(),
        latencyMs,
        supabase: {
          connected: false,
          error: errorMessage,
        },
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  }
}

// Support POST requests (useful for webhook-based pingers)
export async function POST(request: Request) {
  return GET(request);
}

// Support HEAD requests (for lightweight ping tools like UptimeRobot)
export async function HEAD(request: Request) {
  const response = await GET(request);
  return new NextResponse(null, {
    status: response.status,
    headers: response.headers,
  });
}
