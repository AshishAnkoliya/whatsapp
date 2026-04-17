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
  console.log('--- Incoming Push Request ---');
  console.log('VAPID Public Key Loaded:', !!vapidPublicKey);
  console.log('VAPID Private Key Loaded:', !!vapidPrivateKey);

  try {
    const payload = await request.json();
    const { subscription, title, body, url } = payload;

    console.log('Title:', title);
    console.log('Body:', body);
    console.log('Endpoint:', subscription?.endpoint?.substring(0, 50) + '...');

    if (!subscription || !title || !body) {
      console.warn('Missing required fields in push request');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('VAPID keys missing in server environment');
      return NextResponse.json({ error: 'Server configuration error: VAPID keys missing' }, { status: 500 });
    }

    const pushPayload = JSON.stringify({
      title,
      body,
      url: url || '/'
    });

    await webpush.sendNotification(subscription, pushPayload);
    console.log('✅ Push sent successfully to:', subscription.endpoint.substring(0, 30));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Push notification error:', error);
    // Log more details if available
    if (error.statusCode) {
      console.error('Error Status Code:', error.statusCode);
      console.error('Error Body:', error.body);
    }
    return NextResponse.json({ error: error.message, details: error.body || null }, { status: 500 });
  }
}
