self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    try {
      payload = { body: event.data ? event.data.text() : '' };
    } catch (_) {
      payload = {};
    }
  }

  const title = payload.title || 'Gestão Clínica';
  const options = {
    body: payload.body || payload.message || 'Tem um novo alerta.',
    icon: payload.icon || '/favicon-32.png',
    badge: payload.badge || '/favicon-32.png',
    tag: payload.tag || payload.alert_id || undefined,
    renotify: false,
    requireInteraction: false,
    data: {
      url: payload.url || payload.target_url || '/app.html',
      alert_id: payload.alert_id || null
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const target = event.notification?.data?.url || '/app.html';
  const targetUrl = new URL(target, self.location.origin).href;

  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });

    for (const client of clientList) {
      try {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin) {
          if ('navigate' in client) {
            await client.navigate(targetUrl);
          }
          if ('focus' in client) {
            return client.focus();
          }
        }
      } catch (_) {}
    }

    return self.clients.openWindow(targetUrl);
  })());
});
