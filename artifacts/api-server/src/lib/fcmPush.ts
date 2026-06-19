import admin from "firebase-admin";
import { db } from "@workspace/db";
import { nativePushTokensTable } from "@workspace/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import { logger } from "./logger";

type PushPayload = { title: string; body: string; url?: string; type?: string };

let initialized = false;

function init() {
  if (initialized) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    logger.warn("[FCM] FIREBASE_SERVICE_ACCOUNT not set — native push disabled");
    return;
  }
  try {
    const json = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    if (admin.apps.length === 0) {
      admin.initializeApp({ credential: admin.credential.cert(json) });
    }
    initialized = true;
    logger.info("[FCM] Firebase Admin initialized");
  } catch (err) {
    logger.error({ err }, "[FCM] Failed to init Firebase Admin (check FIREBASE_SERVICE_ACCOUNT base64)");
  }
}

/** Pure: given parallel arrays of tokens and FCM responses, return the tokens to deactivate. */
export function deadTokensFromResponses(
  tokens: string[],
  responses: { success: boolean; error?: { code: string } }[],
): string[] {
  const dead: string[] = [];
  responses.forEach((r, i) => {
    if (!r.success && r.error?.code === "messaging/registration-token-not-registered") {
      dead.push(tokens[i]);
    }
  });
  return dead;
}

export async function saveNativeToken(
  token: string,
  userId: number | null,
  role: string | null,
  platform: string | null,
  userAgent: string | null,
) {
  await db
    .insert(nativePushTokensTable)
    .values({ token, userId, role, platform, active: true, userAgent, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: nativePushTokensTable.token,
      set: { userId, role, platform, active: true, userAgent, updatedAt: new Date() },
    });
  logger.info({ userId, role, platform }, "[FCM] Native token saved/updated");
}

export async function deleteNativeToken(token: string) {
  await db
    .update(nativePushTokensTable)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(nativePushTokensTable.token, token));
  logger.info("[FCM] Native token marked inactive");
}

async function sendToTokens(tokens: string[], payload: PushPayload) {
  init();
  if (!initialized) {
    logger.error("[FCM] Cannot send — Firebase Admin not initialized");
    return { sent: 0, failed: 0, invalid: 0 };
  }
  if (tokens.length === 0) return { sent: 0, failed: 0, invalid: 0 };

  const data: Record<string, string> = {};
  if (payload.url)  data.url  = payload.url;
  if (payload.type) data.type = payload.type;

  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title: payload.title, body: payload.body },
    data,
  });

  const dead = deadTokensFromResponses(
    tokens,
    res.responses.map((r) => ({
      success: r.success,
      error: r.error ? { code: r.error.code } : undefined,
    })),
  );
  if (dead.length > 0) {
    await db
      .update(nativePushTokensTable)
      .set({ active: false, updatedAt: new Date() })
      .where(inArray(nativePushTokensTable.token, dead));
  }
  const result = { sent: res.successCount, failed: res.failureCount - dead.length, invalid: dead.length };
  logger.info(result, "[FCM] Send complete");
  return result;
}

async function activeTokensForUser(userId: number): Promise<string[]> {
  const rows = await db
    .select()
    .from(nativePushTokensTable)
    .where(and(eq(nativePushTokensTable.userId, userId), eq(nativePushTokensTable.active, true)));
  return rows.map((r) => r.token);
}

export async function sendFcmToUser(userId: number, payload: PushPayload) {
  return sendToTokens(await activeTokensForUser(userId), payload);
}

export async function sendFcmToUsers(userIds: number[], payload: PushPayload) {
  if (userIds.length === 0) return { sent: 0, failed: 0, invalid: 0 };
  const rows = await db
    .select()
    .from(nativePushTokensTable)
    .where(and(inArray(nativePushTokensTable.userId, userIds), eq(nativePushTokensTable.active, true)));
  return sendToTokens(rows.map((r) => r.token), payload);
}

export async function sendFcmToAdmin(payload: PushPayload) {
  const rows = await db
    .select()
    .from(nativePushTokensTable)
    .where(and(eq(nativePushTokensTable.role, "admin"), eq(nativePushTokensTable.active, true)));
  return sendToTokens(rows.map((r) => r.token), payload);
}
