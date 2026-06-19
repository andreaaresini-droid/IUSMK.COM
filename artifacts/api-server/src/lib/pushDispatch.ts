import { sendPushToUser, sendPushToUsers, sendPushToAdmin } from "./webPush";
import { sendFcmToUser, sendFcmToUsers, sendFcmToAdmin } from "./fcmPush";

type PushPayload = { title: string; body: string; url?: string; type?: string };
export type DispatchResult = { sent: number; failed: number };

function combine(results: PromiseSettledResult<{ sent: number; failed: number }>[]): DispatchResult {
  let sent = 0, failed = 0;
  for (const r of results) {
    if (r.status === "fulfilled") { sent += r.value.sent; failed += r.value.failed; }
  }
  return { sent, failed };
}

/** Send to one customer over BOTH channels; returns combined counts. */
export async function notifyUser(userId: number, payload: PushPayload): Promise<DispatchResult> {
  return combine(await Promise.allSettled([sendPushToUser(userId, payload), sendFcmToUser(userId, payload)]));
}

/** Send to many customers over both channels; returns combined counts. */
export async function notifyUsers(userIds: number[], payload: PushPayload): Promise<DispatchResult> {
  return combine(await Promise.allSettled([sendPushToUsers(userIds, payload), sendFcmToUsers(userIds, payload)]));
}

/** Send to all admins over both channels; returns combined counts. */
export async function notifyAdmin(payload: PushPayload): Promise<DispatchResult> {
  return combine(await Promise.allSettled([sendPushToAdmin(payload), sendFcmToAdmin(payload)]));
}
