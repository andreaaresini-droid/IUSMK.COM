/**
 * Centralized notification dispatcher.
 * Every notification in IUSMK must flow through here:
 * 1. Saves to DB
 * 2. Sends push to all active subscriptions of the recipient
 * 3. Tracks push delivery status
 */
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { notifyUser, notifyAdmin, notifyUsers } from "./pushDispatch";

// ─── Notification types ───────────────────────────────────────────────────────

export type NotificationType =
  | "chat_message"
  | "admin_notification"
  | "system_notification"
  | "order_update"
  | "account_update"
  | "course_update"
  | "course_code_assigned"
  | "code_resent"
  | "promo_notification"
  | "reminder"
  | "broadcast"
  | "contact_request"
  | "chat_reopen_request"
  | "private_message"
  | "generic_notification"
  | "purchase";

// ─── Push payload builder ─────────────────────────────────────────────────────

export interface PushPayloadData {
  title: string;
  body:  string;
  type:  string;
  url?:  string;
  image?: string;
  notificationId?: number;
}

/**
 * Builds a human-readable push title and body for each notification type.
 * Falls back to the provided title/message if not matched.
 */
export function buildPushPayload(
  type: NotificationType | string,
  title: string,
  message: string,
  opts: { url?: string; imageUrl?: string; videoUrl?: string; notificationId?: number } = {}
): PushPayloadData {
  const { url, imageUrl, videoUrl, notificationId } = opts;

  let pushTitle = title;
  let pushBody  = message.slice(0, 200);
  // For most types, direct-link to notification detail page; chat always goes to /chat
  const detailUrl = notificationId ? `/notifications/${notificationId}` : undefined;
  let targetUrl = url || detailUrl || "/notifications";

  switch (type) {
    case "chat_message":
      pushTitle = pushTitle || "Nuovo messaggio da IUSMK";
      pushBody  = pushBody  || "Hai ricevuto un nuovo messaggio. Tocca per rispondere.";
      targetUrl = url || "/chat"; // chat: never use detail page URL
      break;
    case "admin_notification":
    case "private_message":
      pushTitle = pushTitle || "Nuova comunicazione da IUSMK";
      pushBody  = pushBody  || "Hai ricevuto una nuova notifica. Tocca per visualizzarla.";
      // targetUrl already = url || detailUrl || "/notifications"
      break;
    case "course_code_assigned":
      pushTitle = pushTitle || "Nuovo codice corso disponibile";
      pushBody  = pushBody  || "Il tuo codice di accesso al corso è pronto. Tocca per visualizzarlo.";
      break;
    case "code_resent":
      pushTitle = pushTitle || "Codice corso reinviato";
      pushBody  = pushBody  || "Il tuo codice di accesso è stato reinviato. Tocca per visualizzarlo.";
      break;
    case "course_update":
      pushTitle = pushTitle || "Aggiornamento corso";
      pushBody  = pushBody  || "È disponibile un aggiornamento relativo al tuo corso.";
      break;
    case "order_update":
    case "purchase":
      pushTitle = pushTitle || "Aggiornamento ordine";
      pushBody  = pushBody  || "C'è un aggiornamento sul tuo ordine.";
      break;
    case "account_update":
      pushTitle = pushTitle || "Aggiornamento account";
      pushBody  = pushBody  || "C'è un aggiornamento importante sul tuo account.";
      break;
    case "promo_notification":
      pushTitle = pushTitle || "Promozione speciale da IUSMK";
      pushBody  = pushBody  || "Hai ricevuto una promozione. Tocca per scoprirla.";
      break;
    case "reminder":
      pushTitle = pushTitle || "Promemoria da IUSMK";
      pushBody  = pushBody  || "Hai un promemoria. Tocca per visualizzarlo.";
      break;
    case "broadcast":
      pushTitle = pushTitle || "Nuova comunicazione da IUSMK";
      pushBody  = videoUrl
        ? (pushBody || "Hai ricevuto una notifica con un video. Tocca per visualizzarla.")
        : imageUrl
          ? (pushBody || "Hai ricevuto una notifica con un'immagine. Tocca per visualizzarla.")
          : pushBody || "Hai ricevuto una nuova comunicazione.";
      break;
    case "contact_request":
      pushTitle = pushTitle || "Nuova richiesta di contatto";
      pushBody  = pushBody  || "Hai ricevuto una nuova richiesta di contatto.";
      targetUrl = url || "/admin/contacts"; // admin-only, no customer detail page
      break;
    case "chat_reopen_request":
      pushTitle = pushTitle || "Richiesta di riapertura chat";
      pushBody  = pushBody  || "Un cliente vuole riaprire la conversazione.";
      targetUrl = url || "/admin/chat"; // admin-only
      break;
    default:
      pushTitle = pushTitle || "Nuova notifica da IUSMK";
      pushBody  = pushBody  || "Hai ricevuto una nuova notifica.";
      // targetUrl already set
  }

  const payload: PushPayloadData = {
    title: pushTitle,
    body:  pushBody,
    type,
    url:   targetUrl,
    notificationId,
  };
  if (imageUrl) payload.image = imageUrl;
  return payload;
}

// ─── Dispatch to a customer user ─────────────────────────────────────────────

export interface DispatchOptions {
  type:                 NotificationType | string;
  title:                string;
  message:              string;
  recipientEmail?:      string;
  userId?:              number | null;
  courseId?:            number | null;
  accessCode?:          string | null;
  isAdminNotification?: boolean;
  metadata?:            string | null;
  imageUrl?:            string | null;
  videoUrl?:            string | null;
  linkUrl?:             string | null;
  sendPush?:            boolean;
}

export async function dispatchNotificationToUser(
  userId: number,
  opts: DispatchOptions
): Promise<void> {
  const sendPush = opts.sendPush !== false;

  logger.info(
    { userId, type: opts.type, title: opts.title, sendPush },
    "[NOTIFY] dispatchNotificationToUser"
  );

  // 1. Save to DB
  const [notif] = await db.insert(notificationsTable).values({
    type:                opts.type,
    title:               opts.title,
    message:             opts.message,
    recipientEmail:      opts.recipientEmail ?? null,
    userId:              userId,
    courseId:            opts.courseId ?? null,
    accessCode:          opts.accessCode ?? null,
    isAdminNotification: opts.isAdminNotification ?? false,
    isRead:              false,
    metadata:            opts.metadata ?? null,
    imageUrl:            opts.imageUrl ?? null,
    videoUrl:            opts.videoUrl ?? null,
    linkUrl:             opts.linkUrl ?? null,
    pushSent:            false,
  }).returning();

  logger.info({ notifId: notif.id, userId }, "[NOTIFY] Notification saved to DB");

  if (!sendPush) return;

  // 2. Build push payload
  const payload = buildPushPayload(opts.type, opts.title, opts.message, {
    url:            opts.linkUrl ?? undefined,
    imageUrl:       opts.imageUrl ?? undefined,
    videoUrl:       opts.videoUrl ?? undefined,
    notificationId: notif.id,
  });

  // 3. Send push
  try {
    const result = await notifyUser(userId, payload);
    const pushed = result.sent > 0;
    await db.update(notificationsTable)
      .set({
        pushSent:  pushed,
        pushSentAt: pushed ? new Date() : null,
        pushError: result.failed > 0 ? `${result.failed} failed` : null,
        updatedAt: new Date(),
      })
      .where(eq(notificationsTable.id, notif.id));

    logger.info({ notifId: notif.id, userId, ...result }, "[NOTIFY] Push result for user");
  } catch (err) {
    logger.error({ err, notifId: notif.id, userId }, "[NOTIFY] Push send error");
    await db.update(notificationsTable)
      .set({ pushError: String(err), updatedAt: new Date() })
      .where(eq(notificationsTable.id, notif.id));
  }
}

// ─── Dispatch to admin ────────────────────────────────────────────────────────

export async function dispatchNotificationToAdmin(
  opts: Omit<DispatchOptions, "userId"> & { metadata?: string | null }
): Promise<void> {
  const sendPush = opts.sendPush !== false;

  logger.info({ type: opts.type, title: opts.title, sendPush }, "[NOTIFY] dispatchNotificationToAdmin");

  const [notif] = await db.insert(notificationsTable).values({
    type:                opts.type,
    title:               opts.title,
    message:             opts.message,
    recipientEmail:      opts.recipientEmail ?? null,
    userId:              null,
    courseId:            opts.courseId ?? null,
    isAdminNotification: true,
    isRead:              false,
    metadata:            opts.metadata ?? null,
    imageUrl:            opts.imageUrl ?? null,
    videoUrl:            opts.videoUrl ?? null,
    linkUrl:             opts.linkUrl ?? null,
    pushSent:            false,
  }).returning();

  logger.info({ notifId: notif.id }, "[NOTIFY] Admin notification saved to DB");

  if (!sendPush) return;

  const payload = buildPushPayload(opts.type, opts.title, opts.message, {
    url:            opts.linkUrl ?? undefined,
    imageUrl:       opts.imageUrl ?? undefined,
    videoUrl:       opts.videoUrl ?? undefined,
    notificationId: notif.id,
  });

  try {
    const result = await notifyAdmin(payload);
    const pushed = result.sent > 0;
    await db.update(notificationsTable)
      .set({
        pushSent:   pushed,
        pushSentAt: pushed ? new Date() : null,
        pushError:  result.failed > 0 ? `${result.failed} failed` : null,
        updatedAt:  new Date(),
      })
      .where(eq(notificationsTable.id, notif.id));

    logger.info({ notifId: notif.id, ...result }, "[NOTIFY] Push result for admin");
  } catch (err) {
    logger.error({ err, notifId: notif.id }, "[NOTIFY] Admin push send error");
    await db.update(notificationsTable)
      .set({ pushError: String(err), updatedAt: new Date() })
      .where(eq(notificationsTable.id, notif.id));
  }
}

// ─── Dispatch broadcast to multiple users ─────────────────────────────────────

export async function dispatchBroadcast(
  userIds: number[],
  opts: Omit<DispatchOptions, "userId">
): Promise<{ saved: number; sent: number; failed: number }> {
  if (userIds.length === 0) return { saved: 0, sent: 0, failed: 0 };

  logger.info({ userCount: userIds.length, type: opts.type, title: opts.title }, "[NOTIFY] dispatchBroadcast");

  const notifValues = userIds.map((uid) => ({
    type:                opts.type,
    title:               opts.title,
    message:             opts.message,
    recipientEmail:      opts.recipientEmail ?? null,
    userId:              uid,
    courseId:            opts.courseId ?? null,
    isAdminNotification: false,
    isRead:              false,
    metadata:            opts.metadata ?? null,
    imageUrl:            opts.imageUrl ?? null,
    videoUrl:            opts.videoUrl ?? null,
    linkUrl:             opts.linkUrl ?? null,
    pushSent:            false,
  }));

  await db.insert(notificationsTable).values(notifValues);
  logger.info({ count: userIds.length }, "[NOTIFY] Broadcast notifications saved to DB");

  const sendPush = opts.sendPush !== false;
  if (!sendPush) return { saved: userIds.length, sent: 0, failed: 0 };

  const payload = buildPushPayload(opts.type, opts.title, opts.message, {
    url:      opts.linkUrl ?? undefined,
    imageUrl: opts.imageUrl ?? undefined,
    videoUrl: opts.videoUrl ?? undefined,
  });

  const { sent, failed } = await notifyUsers(userIds, payload);
  logger.info({ saved: userIds.length, sent, failed }, "[NOTIFY] Broadcast push result");
  return { saved: userIds.length, sent, failed };
}
