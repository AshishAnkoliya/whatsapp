import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { supabaseServer } from '@/lib/supabase-server';

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:example@yourdomain.com',
    vapidPublicKey,
    vapidPrivateKey
  );
}

export async function POST(request: Request) {
  console.log('--- Incoming Push Request (Server-Side Logic) ---');
  
  try {
    const payload = await request.json();
    const { groupId, senderId, title, body, url, subscription: directSubscription } = payload;

    // Support both direct push (for testing) and group-based push
    if (directSubscription) {
      console.log('Direct test push requested');
      const pushPayload = JSON.stringify({ title, body, url: url || '/' });
      await webpush.sendNotification(directSubscription, pushPayload);
      return NextResponse.json({ success: true, mode: 'direct' });
    }

    if (!groupId || !senderId) {
      return NextResponse.json({ error: 'Missing groupId or senderId' }, { status: 400 });
    }

    console.log(`Processing push for Group: ${groupId}, Sender: ${senderId}`);

    // 1. Fetch group members using service_role client (bypasses RLS)
    console.log('--- DB QUERY 1: Fetching group members... ---');
    const { data: members, error: membersError } = await supabaseServer
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId);

    if (membersError) {
      console.error('❌ Member fetch error:', membersError);
      throw membersError;
    }
    
    console.log('All group members found:', members?.map(m => m.user_id));

    // Filter out sender
    const otherMemberIds = members
      ?.filter(m => m.user_id !== senderId)
      .map(m => m.user_id) || [];

    console.log(`Target member IDs (excluding sender ${senderId}):`, otherMemberIds);

    if (otherMemberIds.length === 0) {
      console.log('No other members found to notify.');
      return NextResponse.json({ success: true, message: 'No other members' });
    }

    // 2. Fetch all subscriptions for these users
    console.log('--- DB QUERY 2: Fetching subscriptions for target users... ---');
    const { data: subscriptions, error: subsError } = await supabaseServer
      .from('push_subscriptions')
      .select('*')
      .in('user_id', otherMemberIds);

    if (subsError) {
      console.error('❌ Subscription fetch error:', subsError);
      throw subsError;
    }

    console.log(`Found ${subscriptions?.length || 0} subscriptions in database.`);
    if (subscriptions) {
      subscriptions.forEach((s, i) => {
        console.log(`Sub ${i+1}: user=${s.user_id}, endpoint=${s.endpoint.substring(0, 40)}...`);
      });
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No valid push subscriptions found for target members.');
      return NextResponse.json({ success: true, message: 'No subscriptions' });
    }

    console.log(`Sending push to ${subscriptions.length} endpoints...`);

    // 3. Send notifications to each subscription
    const pushPayload = JSON.stringify({
      title,
      body,
      url: url || `/chat/${groupId}`
    });

    const results = await Promise.allSettled(
      subscriptions.map(sub => 
        webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        }, pushPayload)
      )
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failCount = results.filter(r => r.status === 'rejected').length;

    console.log(`✅ Group Notifications complete: ${successCount} sent, ${failCount} failed`);

    return NextResponse.json({ 
      success: true, 
      sent: successCount, 
      failed: failCount 
    });

  } catch (error: any) {
    console.error('❌ Server-side Push error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
