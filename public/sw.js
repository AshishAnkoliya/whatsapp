/* eslint-disable no-restricted-globals */

self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push Received.');
  if (event.data) {
    try {
      const data = event.data.json();
      console.log('[Service Worker] Push Data:', data);
      const options = {
        body: data.body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: {
          url: data.url
        },
        actions: [
          { action: 'open', title: 'Open Chat' }
        ],
        vibrate: [100, 50, 100],
      };

      event.waitUntil(
        self.registration.showNotification(data.title, options)
      );
    } catch (e) {
      // Fallback for non-JSON data
      const options = {
        body: event.data.text(),
        icon: '/icon-192.png',
        badge: '/icon-192.png',
      };
      event.waitUntil(
        self.registration.showNotification('WhatsApp Pro', options)
      );
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('pushsubscriptionchange', function(event) {
  console.log('[Service Worker]: Custom pushsubscriptionchange event triggered');
  
  const vapidPublicKey = 'YOUR_VAPID_PUBLIC_KEY'; // This needs to be available or fetched
  // Note: Since we can't easily access environment variables here without a build step or fetching,
  // we usually fetch them or have them hardcoded if they don't change.
  // For this implementation, we'll try to re-subscribe if the browser supports it.

  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    }).then(function(subscription) {
      console.log('[Service Worker]: Push subscription renewed', subscription.endpoint);
      // We would then need to send this to our API. 
      // Since we don't have the userId here, we rely on the backend to match by endpoint or wait for next app load.
      return fetch('/api/push/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription })
      });
    })
  );
});

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
