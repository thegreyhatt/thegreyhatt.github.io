/**
 * AdSynapse Push Service Worker
 *
 * Host this file at the root of your domain (e.g. https://example.com/service-worker.js).
 * If you can't upload to the root, a sub-path (e.g. /link/service-worker.js) also
 * works — set the same path in the AdSynapse Push Popup settings. Push delivery
 * does not depend on the worker's scope. The AdSynapse SDK registers it with its
 * configuration in the query string:
 *
 *
 */


self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

/**
 * Reports a 'seen' or 'clicked' event back to AdSynapse. The tracking URL and
 * push campaign id arrive inside the notification payload's data object.
 * Tracking is best-effort — a failure must never break the notification flow.
 */
function trackEvent(data, eventName) {
    if (!data || !data.track_url || !data.push_campaign_id) {
        return Promise.resolve();
    }

    return fetch(data.track_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            push_campaign_id: data.push_campaign_id,
            event: eventName,
        }),
    }).catch(() => {});
}

self.addEventListener('push', (event) => {
    let payload = {};

    try {
        payload = event.data ? event.data.json() : {};
    } catch {
        payload = { title: 'Notification', body: event.data ? event.data.text() : '' };
    }

    const title = payload.title || 'Notification';
    const options = {
        body: payload.body || '',
        data: payload.data || {},
    };

    if (payload.icon) {
        options.icon = payload.icon;
    }

    if (payload.image) {
        options.image = payload.image;
    }

    event.waitUntil(
        Promise.all([
            self.registration.showNotification(title, options),
            trackEvent(options.data, 'seen'),
        ])
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const data = event.notification.data || {};
    const url = data.url;

    const openClickUrl = url
        ? self.clients
              .matchAll({ type: 'window', includeUncontrolled: true })
              .then((windows) => {
                  for (const client of windows) {
                      if (client.url === url && 'focus' in client) {
                          return client.focus();
                      }
                  }

                  return self.clients.openWindow(url);
              })
        : Promise.resolve();

    event.waitUntil(Promise.all([trackEvent(data, 'clicked'), openClickUrl]));
});

