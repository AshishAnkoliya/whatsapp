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
    const { data: members, error: membersError } = await supabaseServer
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId)
      .neq('user_id', senderId);

    if (membersError) throw membersError;
    if (!members || members.length === 0) {
      console.log('No other members to notify');
      return NextResponse.json({ success: true, message: 'No other members' });
    }

    const otherUserIds = members.map(m => m.user_id);
    console.log(`Found ${otherUserIds.length} other members to notify`);

    // 2. Fetch all subscriptions for these users
    const { data: subscriptions, error: subsError } = await supabaseServer
      .from('push_subscriptions')
      .select('*')
      .in('user_id', otherUserIds);

    if (subsError) throw subsError;
    if (!subscriptions || subscriptions.length === 0) {
      console.log('No push subscriptions found for other members');
      return NextResponse.json({ success: true, message: 'No subscriptions' });
    }

    console.log(`Sending to ${subscriptions.length} subscription endpoints...`);

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
