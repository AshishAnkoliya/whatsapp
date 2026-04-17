import { NextResponse } from 'next/server';
import webpush from 'web-push';

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
  try {
    const payload = await request.json();
    const { subscription, title, body, url } = payload;

    console.log('--- Incoming Push Request ---');
    console.log('Title:', title);
    console.log('Body:', body);
    console.log('Endpoint:', subscription?.endpoint?.substring(0, 50) + '...');

    if (!subscription || !title || !body) {
      console.warn('Missing required fields in push request');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const pushPayload = JSON.stringify({
      title,
      body,
      url: url || '/'
    });

    await webpush.sendNotification(subscription, pushPayload);
    console.log('✅ Push sent successfully');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Push notification error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
