import { useState, useEffect, useCallback, useRef } from "react";
import { fetchApi } from "@/lib/api-client";
import { Capacitor } from "@capacitor/core";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i);
  }
  return buffer;
}

export type PushStatus = "unsupported" | "denied" | "subscribed" | "unsubscribed" | "loading";

/**
 * role: "admin"    → /admin/push/* endpoints
 *       "customer" → /customer/push/* endpoints
 *
 * On mount, if a push subscription already exists in the browser,
 * this hook automatically re-syncs it to the server (silently, no redirect on 401).
 * This ensures subscriptions survive page refreshes, re-logins, and token renewals.
 *
 * Native (Capacitor) uses Firebase Cloud Messaging on BOTH platforms via
 * @capacitor-firebase/messaging, so getToken() returns an FCM token on Android
 * and iOS alike — the backend keeps sending uniformly via firebase-admin.
 * The plugin is imported dynamically so the web bundle never pulls the Firebase
 * JS SDK (browsers use the VAPID web-push path below instead).
 */
export function usePushNotifications(role: "admin" | "customer" = "admin") {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [error,  setError ] = useState<string | null>(null);
  const resynced = useRef(false);

  const base = role === "customer" ? "/customer" : "/admin";

  // Use BASE_URL to support any base path deployment
  const swPath = `${import.meta.env.BASE_URL}sw.js`;

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window;

  const isNative = typeof Capacitor !== "undefined" && Capacitor.isNativePlatform();

  // ── NATIVE (Capacitor) push via Firebase Cloud Messaging ────────────
  useEffect(() => {
    if (!isNative) return;

    let removeListeners: (() => void) | undefined;
    let cancelled = false;

    const saveToken = async (token: string) => {
      console.log("[push-native] FCM token:", token.slice(0, 24) + "…");
      try {
        await fetchApi(`${base}/push/native-token`, {
          method: "POST",
          body: JSON.stringify({ token, platform: Capacitor.getPlatform() }),
        }, false);
        if (!cancelled) setStatus("subscribed");
      } catch (err) {
        console.warn("[push-native] token save failed:", err);
      }
    };

    (async () => {
      const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");

      const perm = await FirebaseMessaging.checkPermissions();
      if (perm.receive === "denied") { if (!cancelled) setStatus("denied"); return; }
      if (!cancelled) setStatus(perm.receive === "granted" ? "subscribed" : "unsubscribed");

      // FCM may rotate the token at any time → keep the server in sync.
      const tokenHandle = await FirebaseMessaging.addListener("tokenReceived", (event) => {
        if (event?.token) void saveToken(event.token);
      });

      const tapHandle = await FirebaseMessaging.addListener(
        "notificationActionPerformed",
        (event) => {
          const url = (event.notification?.data as Record<string, string> | undefined)?.url;
          if (url) window.location.assign(url);
        },
      );

      removeListeners = () => { tokenHandle.remove(); tapHandle.remove(); };

      if (perm.receive === "granted") {
        try {
          const { token } = await FirebaseMessaging.getToken();
          if (token) await saveToken(token);
        } catch (err) {
          console.error("[push-native] getToken error:", err);
          if (!cancelled) setError("Errore registrazione notifiche native");
        }
      }
    })();

    return () => { cancelled = true; removeListeners?.(); };
  }, [isNative, base]);

  useEffect(() => {
    if (isNative) return;
    if (!supported) {
      console.warn("[push] Web push not supported in this browser");
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      console.warn("[push] Notification permission denied by user");
      setStatus("denied");
      return;
    }

    console.log("[push] Registering service worker at:", swPath);

    navigator.serviceWorker
      .register(swPath, { scope: "/" })
      .then(async (reg) => {
        console.log("[push] Service worker registered, scope:", reg.scope, "state:", reg.active?.state ?? "installing");

        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          console.log("[push] Existing subscription found in browser:", sub.endpoint.slice(0, 60) + "…");
          setStatus("subscribed");

          // Re-sync the existing subscription to the server (once per session, silently)
          if (!resynced.current) {
            resynced.current = true;
            const json = sub.toJSON() as {
              endpoint: string;
              keys: { p256dh: string; auth: string };
            };
            fetchApi(`${base}/push/subscribe`, {
              method: "POST",
              body:   JSON.stringify(json),
            }, false /* no redirect on 401 */).then(() => {
              console.log("[push] Subscription re-synced to server successfully");
            }).catch((err) => {
              console.warn("[push] Re-sync to server failed (may not be logged in yet):", err?.message ?? err);
            });
          }
        } else {
          console.log("[push] No existing subscription in browser");
          setStatus("unsubscribed");
        }
      })
      .catch((err) => {
        console.error("[push] Service worker registration failed:", err);
        setStatus("unsubscribed");
      });
  }, [supported, swPath, base]);

  const subscribe = useCallback(async () => {
    if (isNative) {
      setError(null);
      const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
      const req = await FirebaseMessaging.requestPermissions();
      if (req.receive !== "granted") {
        setStatus("denied");
        setError("Permesso notifiche negato. Abilitalo nelle impostazioni del telefono.");
        return;
      }
      try {
        const { token } = await FirebaseMessaging.getToken();
        if (token) {
          await fetchApi(`${base}/push/native-token`, {
            method: "POST",
            body: JSON.stringify({ token, platform: Capacitor.getPlatform() }),
          });
          setStatus("subscribed");
        }
      } catch (err: any) {
        console.error("[push-native] subscribe error:", err);
        setError(err?.message || "Errore durante l'attivazione delle notifiche");
      }
      return;
    }
    if (!supported) {
      setError("Notifiche push non supportate da questo browser");
      return;
    }
    setError(null);
    try {
      console.log("[push] Requesting notification permission…");
      const perm = await Notification.requestPermission();
      console.log("[push] Permission result:", perm);
      if (perm !== "granted") {
        setStatus("denied");
        setError("Permesso notifiche negato. Abilitalo nelle impostazioni del browser.");
        return;
      }

      console.log("[push] Waiting for service worker to be ready…");
      const reg = await navigator.serviceWorker.ready;
      console.log("[push] SW ready, scope:", reg.scope);

      console.log("[push] Fetching VAPID public key from server…");
      const { publicKey } = await fetchApi<{ publicKey: string }>(`${base}/push/vapid-public-key`);
      if (!publicKey) throw new Error("VAPID key non ricevuta dal server");
      console.log("[push] VAPID public key received (first 20 chars):", publicKey.slice(0, 20) + "…");

      console.log("[push] Calling pushManager.subscribe()…");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      console.log("[push] Push subscription created:", sub.endpoint.slice(0, 60) + "…");

      const json = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };

      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Subscription incompleta (keys mancanti)");
      }

      console.log("[push] Saving subscription to server…");
      await fetchApi(`${base}/push/subscribe`, {
        method: "POST",
        body:   JSON.stringify(json),
      });

      console.log("[push] ✓ Subscription saved to server successfully");
      resynced.current = true;
      setStatus("subscribed");
    } catch (err: any) {
      console.error("[push] Subscribe error:", err);
      setError(err.message || "Errore durante l'attivazione delle notifiche");
    }
  }, [supported, base, isNative]);

  const unsubscribe = useCallback(async () => {
    if (isNative) {
      // Native unsubscribe is best-effort: drop the FCM token locally and
      // simply stop showing as subscribed.
      try {
        const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
        await FirebaseMessaging.deleteToken();
      } catch (err) {
        console.warn("[push-native] deleteToken failed:", err);
      }
      setStatus("unsubscribed");
      return;
    }
    if (!supported) return;
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        console.log("[push] No subscription to remove");
        setStatus("unsubscribed");
        return;
      }

      console.log("[push] Removing subscription from server…");
      await fetchApi(`${base}/push/subscribe`, {
        method: "DELETE",
        body:   JSON.stringify({ endpoint: sub.endpoint }),
      });

      await sub.unsubscribe();
      resynced.current = false;
      console.log("[push] ✓ Unsubscribed");
      setStatus("unsubscribed");
    } catch (err: any) {
      console.error("[push] Unsubscribe error:", err);
      setError(err.message || "Errore durante la disattivazione delle notifiche");
    }
  }, [supported, base, isNative]);

  return { status, error, subscribe, unsubscribe };
}
