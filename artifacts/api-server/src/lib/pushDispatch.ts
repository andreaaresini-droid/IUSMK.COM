import { sendPushToUser, sendPushToUsers, sendPushToAdmin } from "./webPush";
import { sendFcmToUser, sendFcmToUsers, sendFcmToAdmin } from "./fcmPush";

type PushPayload = { title: string; body: string; url?: string; type?: string };

/** Send a notification to one customer over BOTH channels (web-push + native FCM). */
export async function notifyUser(userId: number, payload: PushPayload): Promise<void> {
  await Promise.allSettled([sendPushToUser(userId, payload), sendFcmToUser(userId, payload)]);
}

/** Send to many customers over both channels. */
export async function notifyUsers(userIds: number[], payload: PushPayload): Promise<void> {
  await Promise.allSettled([sendPushToUsers(userIds, payload), sendFcmToUsers(userIds, payload)]);
}

/** Send to all admins over both channels. */
export async function notifyAdmin(payload: PushPayload): Promise<void> {
  await Promise.allSettled([sendPushToAdmin(payload), sendFcmToAdmin(payload)]);
}
