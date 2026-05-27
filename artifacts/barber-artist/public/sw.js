// ─── IUSMK Service Worker ─────────────────────────────────────────────────────

self.addEventListener("install", function (event) {
  console.log("[SW] Installed — version:", new Date().toISOString());
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  console.log("[SW] Activated — claiming all clients");
  event.waitUntil(self.clients.claim());
});

// ─── Helper: resolve the exact URL to navigate to ─────────────────────────────

function resolveUrl(data) {
  // If notificationId is present and it's a customer notification type,
  // navigate directly to the notification detail page
  if (data.notificationId) {
    switch (data.type) {
      case "chat_message":
        // Chat messages go to chat, not to a notification detail page
        return "/chat";
      case "contact_request":
      case "chat_reopen_request":
        // Admin-only, use their specific admin pages
        return data.url || (data.type === "contact_request" ? "/admin/contacts" : "/admin/chat");
      default:
        // All other customer notifications → detail page
        return `/notifications/${data.notificationId}`;
    }
  }

  // Fallback: use the URL in the payload or derive from type
  if (data.url && data.url !== "/") return data.url;

  switch (data.type) {
    case "chat_message":      return "/chat";
    case "contact_request":   return "/admin/contacts";
    case "chat_reopen_request": return "/admin/chat";
    default:                  return "/notifications";
  }
}

// ─── Push event ───────────────────────────────────────────────────────────────

self.addEventListener("push", function (event) {
  console.log("[SW] Push event received");

  var data = {};
  if (event.data) {
    try {
      data = event.data.json();
      console.log("[SW] Push payload — type:", data.type, "notifId:", data.notificationId, "url:", data.url);
    } catch (e) {
      var text = event.data.text();
      console.warn("[SW] Push payload not JSON:", text);
      data = { title: "IUSMK", body: text };
    }
  } else {
    console.warn("[SW] Push event has no data");
    data = { title: "IUSMK", body: "Hai un nuovo aggiornamento." };
  }

  var title = data.title || "IUSMK";
  var targetUrl = resolveUrl(data);

  var options = {
    body:               data.body || "",
    icon:               "/icon-192.png",
    badge:              "/icon-192.png",
    tag:                (data.type || "iusmk") + (data.notificationId ? "-" + data.notificationId : "-" + Date.now()),
    renotify:           true,
    requireInteraction: false,
    vibrate:            [200, 100, 200],
    data: {
      url:            targetUrl,
      type:           data.type || "generic_notification",
      notificationId: data.notificationId || null,
    },
  };

  if (data.image) {
    options.image = data.image;
    console.log("[SW] Push image attached:", data.image.slice(0, 80));
  }

  if (data.videoUrl && !data.image) {
    options.body = (data.body || "") + "\n📹 Contiene un video — tocca per visualizzarlo.";
  }

  console.log("[SW] showNotification →", title, "| url:", targetUrl, "| notifId:", data.notificationId);

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ─── Notification click ────────────────────────────────────────────────────────

self.addEventListener("notificationclick", function (event) {
  var ndata   = event.notification.data || {};
  var rawPath = ndata.url || "/notifications";
  var targetUrl = rawPath.startsWith("http")
    ? rawPath
    : new URL(rawPath, self.location.origin).href;

  console.log("[SW] Notification clicked — type:", ndata.type, "notifId:", ndata.notificationId, "→", targetUrl);
  event.notification.close();

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        // Find any tab already showing this origin
        var ours = clientList.filter(function (c) {
          return c.url.startsWith(self.location.origin);
        });

        if (ours.length > 0) {
          var client = ours[0];
          console.log("[SW] Focusing existing window, navigating to:", targetUrl);
          return client.focus().then(function () {
            if ("navigate" in client) {
              return client.navigate(targetUrl);
            }
          });
        }

        console.log("[SW] No open window — opening:", targetUrl);
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
