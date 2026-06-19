import { useState, useEffect, useCallback, useRef } from "react";
import { fetchApi } from "@/lib/api-client";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

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

  // ── NATIVE (Capacitor) push via FCM/APNs ───────────────────────────
  useEffect(() => {
    if (!isNative) return;

    let removeListeners: (() => void) | undefined;

    (async () => {
      const perm = await PushNotifications.checkPermissions();
      if (perm.receive === "denied") { setStatus("denied"); return; }
      setStatus(perm.receive === "granted" ? "subscribed" : "unsubscribed");

      const regHandle = await PushNotifications.addListener("registration", async (tok) => {
        console.log("[push-native] token:", tok.value.slice(0, 24) + "…");
        try {
          await fetchApi(`${base}/push/native-token`, {
            method: "POST",
            body: JSON.stringify({ token: tok.value, platform: Capacitor.getPlatform() }),
          }, false);
          setStatus("subscribed");
        } catch (err) {
          console.warn("[push-native] token save failed:", err);
        }
      });

      const errHandle = await PushNotifications.addListener("registrationError", (e) => {
        console.error("[push-native] registration error:", e);
        setError("Errore registrazione notifiche native");
      });

      const tapHandle = await PushNotifications.addListener(
        "pushNotificationActionPerformed",
        (action) => {
          const url = (action.notification.data as Record<string, string> | undefined)?.url;
          if (url) window.location.assign(url);
        },
      );

      removeListeners = () => {
        regHandle.remove();
        errHandle.remove();
        tapHandle.remove();
      };

      if (perm.receive === "granted") {
        await PushNotifications.register();
      }
    })();

    return () => { removeListeners?.(); };
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
      const req = await PushNotifications.requestPermissions();
      if (req.receive !== "granted") {
        setStatus("denied");
        setError("Permesso notifiche negato. Abilitalo nelle impostazioni del telefono.");
        return;
      }
      await PushNotifications.register(); // triggers the "registration" listener → token POST
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
      // Native unsubscribe is best-effort; we simply stop showing as subscribed.
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
