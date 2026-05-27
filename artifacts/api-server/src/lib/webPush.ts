import webpush from "web-push";
import { db } from "@workspace/db";
import { pushSubscriptionsTable } from "@workspace/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import { logger } from "./logger";

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;

let initialized = false;

function init() {
  if (initialized) return;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    logger.warn("[PUSH] VAPID keys not set — web push disabled");
    return;
  }
  webpush.setVapidDetails(
    VAPID_SUBJECT || "mailto:iusmkbarber@gmail.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  initialized = true;
  logger.info("[PUSH] Web push initialized (VAPID ready)");
}

export function getVapidPublicKey(): string {
  if (!VAPID_PUBLIC_KEY) {
    logger.warn("[PUSH] VAPID_PUBLIC_KEY not set — client cannot subscribe");
  }
  return VAPID_PUBLIC_KEY || "";
}

export async function saveSubscription(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  userId?: number | null,
  role?: string | null,
  userAgent?: string | null,
) {
  await db
    .insert(pushSubscriptionsTable)
    .values({
      endpoint:  subscription.endpoint,
      p256dh:    subscription.keys.p256dh,
      auth:      subscription.keys.auth,
      userId:    userId ?? null,
      role:      role ?? null,
      active:    true,
      userAgent: userAgent ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: pushSubscriptionsTable.endpoint,
      set: {
        p256dh:    subscription.keys.p256dh,
        auth:      subscription.keys.auth,
        userId:    userId ?? null,
        role:      role ?? null,
        active:    true,
        userAgent: userAgent ?? null,
        updatedAt: new Date(),
      },
    });
  logger.info(
    { endpoint: subscription.endpoint.slice(0, 60) + "…", userId, role },
    "[PUSH] Subscription saved/updated in DB"
  );
}

export async function deleteSubscription(endpoint: string) {
  await db
    .update(pushSubscriptionsTable)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(pushSubscriptionsTable.endpoint, endpoint));
  logger.info({ endpoint: endpoint.slice(0, 60) + "…" }, "[PUSH] Subscription marked inactive");
}

type PushPayload = { title: string; body: string; url?: string; type?: string };

async function sendToSubs(
  subs: { id: number; endpoint: string; p256dh: string; auth: string }[],
  payload: PushPayload
): Promise<{ sent: number; failed: number; invalid: number }> {
  init();
  if (!initialized) {
    logger.error("[PUSH] Cannot send — VAPID not initialized (check VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY)");
    return { sent: 0, failed: 0, invalid: 0 };
  }
  if (subs.length === 0) {
    logger.info("[PUSH] No active subscriptions to send to");
    return { sent: 0, failed: 0, invalid: 0 };
  }

  logger.info({ count: subs.length, title: payload.title }, "[PUSH] Sending to subscriptions");

  let sent = 0, failed = 0, invalid = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
      sent++;
      logger.info({ subId: sub.id, endpoint: sub.endpoint.slice(0, 60) + "…" }, "[PUSH] ✓ Sent successfully");
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Subscription expired/unregistered — mark inactive
        invalid++;
        logger.warn(
          { subId: sub.id, statusCode: err.statusCode, endpoint: sub.endpoint.slice(0, 60) + "…" },
          "[PUSH] Subscription expired — marking inactive"
        );
        await db
          .update(pushSubscriptionsTable)
          .set({ active: false, updatedAt: new Date() })
          .where(eq(pushSubscriptionsTable.id, sub.id));
      } else {
        failed++;
        logger.error(
          { subId: sub.id, statusCode: err.statusCode, message: err.message, body: err.body },
          "[PUSH] ✗ Send failed"
        );
      }
    }
  }
  logger.info({ sent, failed, invalid }, "[PUSH] Send complete");
  return { sent, failed, invalid };
}

/** Send push only to admin subscriptions */
export async function sendPushToAdmin(payload: PushPayload) {
  const subs = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(and(eq(pushSubscriptionsTable.role, "admin"), eq(pushSubscriptionsTable.active, true)));
  logger.info({ count: subs.length }, "[PUSH] sendPushToAdmin — active admin subs found");
  return sendToSubs(subs, payload);
}

/** Send push to a specific customer by userId */
export async function sendPushToUser(userId: number, payload: PushPayload) {
  const subs = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(and(eq(pushSubscriptionsTable.userId, userId), eq(pushSubscriptionsTable.active, true)));
  if (subs.length === 0) {
    logger.info({ userId }, "[PUSH] sendPushToUser — no active subscriptions for this user (push not sent)");
  } else {
    logger.info({ userId, count: subs.length }, "[PUSH] sendPushToUser — found active subscriptions");
  }
  return sendToSubs(subs, payload);
}

/** Send push to multiple customers by userId list */
export async function sendPushToUsers(
  userIds: number[],
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (userIds.length === 0) return { sent: 0, failed: 0 };
  const subs = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(
      and(
        inArray(pushSubscriptionsTable.userId, userIds),
        eq(pushSubscriptionsTable.active, true)
      )
    );
  logger.info({ userCount: userIds.length, subCount: subs.length }, "[PUSH] sendPushToUsers");
  const { sent, failed } = await sendToSubs(subs, payload);
  return { sent, failed };
}

/** Get push subscription stats for a specific userId */
export async function getUserPushStats(userId: number): Promise<{ total: number; active: number }> {
  const subs = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.userId, userId));
  const active = subs.filter((s) => s.active).length;
  return { total: subs.length, active };
}

/** Legacy: send to ALL active subscriptions */
export async function sendPushToAll(payload: PushPayload) {
  const subs = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.active, true));
  return sendToSubs(subs, payload);
}
