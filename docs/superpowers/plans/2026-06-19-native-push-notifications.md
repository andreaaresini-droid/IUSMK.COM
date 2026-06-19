# Native Push Notifications (FCM) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add native push notifications to the IUSMK Capacitor app by adding an FCM channel alongside the existing web-push, wired into the current notification flows so admin notifications/broadcasts reach native devices.

**Architecture:** A new `pushDispatch` layer fans every notification out to two senders — the existing `webPush` (browser) and a new `fcmPush` (native, via `firebase-admin`). Native devices register an FCM token through `@capacitor/push-notifications` and store it in a new `native_push_tokens` table. The frontend hook branches on `Capacitor.isNativePlatform()`: native → FCM flow, browser → existing web-push flow (unchanged).

**Tech Stack:** Node + Express 5, Drizzle ORM (Postgres), `firebase-admin`, Vite + React + wouter, Capacitor 8, `@capacitor/push-notifications`, Vitest (new, backend only).

## Global Constraints

- App id / Android applicationId: `com.iusmk.app` (do not change).
- Android `versionCode`: bump `1 → 2` for the push build.
- `google-services.json` lives at `artifacts/barber-artist/android/app/google-services.json` and IS committed (client config; the `app/build.gradle` hook applies the google-services plugin when present).
- Firebase service-account credential is read from env var `FIREBASE_SERVICE_ACCOUNT` (base64-encoded JSON). NEVER commit it; it is a Vercel env var on the backend project.
- FCM data-message values must be strings (`url`, `type`).
- Reuse existing notification flows; do not change business logic — only the send mechanism.
- pnpm gotchas (Windows): use `--ignore-scripts` on install (repo `preinstall` guard is broken on Git Bash); platform-native binaries are declared in `optionalDependencies`. Build the web app with `./node_modules/.bin/vite build --config vite.config.ts`, sync with `./node_modules/.bin/cap sync android`.
- Push payload shape (existing, keep identical): `type PushPayload = { title: string; body: string; url?: string; type?: string }`.

---

### Task 1: `native_push_tokens` DB table

**Files:**
- Create: `lib/db/src/schema/nativePushTokens.ts`
- Modify: `lib/db/src/schema/index.ts` (add export line)

**Interfaces:**
- Produces: `nativePushTokensTable` (Drizzle pg table), types `NativePushToken`, `InsertNativePushToken`. Columns: `id`, `token` (text, unique, notNull), `userId` (int, nullable), `role` (text, nullable), `platform` (text, nullable), `active` (bool, default true), `userAgent` (text, nullable), `createdAt`, `updatedAt`.

- [ ] **Step 1: Create the schema file**

Create `lib/db/src/schema/nativePushTokens.ts` (mirrors `pushSubscriptions.ts`):

```typescript
import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const nativePushTokensTable = pgTable("native_push_tokens", {
  id:        serial("id").primaryKey(),
  token:     text("token").notNull().unique(),
  userId:    integer("user_id"),
  role:      text("role"),
  platform:  text("platform"),
  active:    boolean("active").notNull().default(true),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type NativePushToken = typeof nativePushTokensTable.$inferSelect;
export type InsertNativePushToken = typeof nativePushTokensTable.$inferInsert;
```

- [ ] **Step 2: Export it from the schema barrel**

In `lib/db/src/schema/index.ts`, add after the `pushSubscriptions` export line:

```typescript
export * from "./nativePushTokens";
```

- [ ] **Step 3: Typecheck the db package**

Run: `cd "C:/Users/andre/desktop/ClaudeCode/IUSMK.COM/artifacts/api-server" && ./node_modules/.bin/tsc -p tsconfig.json --noEmit`
Expected: PASS (no errors). The new table type resolves through `@workspace/db/schema`.

- [ ] **Step 4: Create the table in the database**

Run: `cd "C:/Users/andre/desktop/ClaudeCode/IUSMK.COM/lib/db" && pnpm push`
Expected: drizzle-kit reports creating table `native_push_tokens`. (Requires `DATABASE_URL` env; if running where DB is unreachable, defer this step to deploy and note it.)

- [ ] **Step 5: Commit**

```bash
git add lib/db/src/schema/nativePushTokens.ts lib/db/src/schema/index.ts
git commit -m "feat(db): add native_push_tokens table for FCM device tokens"
```

---

### Task 2: `fcmPush` sender + Firebase Admin init (with Vitest)

**Files:**
- Create: `artifacts/api-server/src/lib/fcmPush.ts`
- Create: `artifacts/api-server/vitest.config.ts`
- Create: `artifacts/api-server/src/lib/fcmPush.test.ts`
- Modify: `artifacts/api-server/package.json` (add `firebase-admin` dep, `vitest` devDep, `test` script)

**Interfaces:**
- Consumes: `nativePushTokensTable` from `@workspace/db/schema`; `PushPayload` shape (defined inline, identical to webPush's).
- Produces:
  - `deadTokensFromResponses(tokens: string[], responses: { success: boolean; error?: { code: string } }[]): string[]` — pure helper.
  - `saveNativeToken(token: string, userId: number | null, role: string | null, platform: string | null, userAgent: string | null): Promise<void>`
  - `deleteNativeToken(token: string): Promise<void>`
  - `sendFcmToUser(userId: number, payload: PushPayload): Promise<{ sent: number; failed: number; invalid: number }>`
  - `sendFcmToUsers(userIds: number[], payload: PushPayload): Promise<{ sent: number; failed: number; invalid: number }>`
  - `sendFcmToAdmin(payload: PushPayload): Promise<{ sent: number; failed: number; invalid: number }>`

- [ ] **Step 1: Add dependencies**

In `artifacts/api-server/package.json`, add to `dependencies`:

```json
"firebase-admin": "^13.0.1",
```

and to `devDependencies`:

```json
"vitest": "^2.1.8",
```

and to `scripts`:

```json
"test": "vitest run"
```

Then install (from the api-server folder):
Run: `cd "C:/Users/andre/desktop/ClaudeCode/IUSMK.COM/artifacts/api-server" && pnpm install --ignore-scripts`
Expected: lockfile updates, `firebase-admin` and `vitest` resolved.

- [ ] **Step 2: Create the Vitest config**

Create `artifacts/api-server/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Write the failing test for the pure helper**

Create `artifacts/api-server/src/lib/fcmPush.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

// firebase-admin is imported at module load; stub it so importing fcmPush never
// touches real credentials.
vi.mock("firebase-admin", () => ({
  default: {
    apps: [],
    initializeApp: vi.fn(),
    credential: { cert: vi.fn() },
    messaging: () => ({ sendEachForMulticast: vi.fn() }),
  },
}));
vi.mock("@workspace/db", () => ({ db: {} }));
vi.mock("@workspace/db/schema", () => ({ nativePushTokensTable: {} }));

import { deadTokensFromResponses } from "./fcmPush";

describe("deadTokensFromResponses", () => {
  it("returns tokens whose response failed with registration-token-not-registered", () => {
    const tokens = ["good", "dead", "other-error"];
    const responses = [
      { success: true },
      { success: false, error: { code: "messaging/registration-token-not-registered" } },
      { success: false, error: { code: "messaging/internal-error" } },
    ];
    expect(deadTokensFromResponses(tokens, responses)).toEqual(["dead"]);
  });

  it("returns empty array when all succeed", () => {
    expect(deadTokensFromResponses(["a", "b"], [{ success: true }, { success: true }])).toEqual([]);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd "C:/Users/andre/desktop/ClaudeCode/IUSMK.COM/artifacts/api-server" && ./node_modules/.bin/vitest run src/lib/fcmPush.test.ts`
Expected: FAIL — `deadTokensFromResponses` is not exported / module not found.

- [ ] **Step 5: Implement `fcmPush.ts`**

Create `artifacts/api-server/src/lib/fcmPush.ts`:

```typescript
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

  const dead = deadTokensFromResponses(tokens, res.responses as any);
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
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd "C:/Users/andre/desktop/ClaudeCode/IUSMK.COM/artifacts/api-server" && ./node_modules/.bin/vitest run src/lib/fcmPush.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Typecheck**

Run: `cd "C:/Users/andre/desktop/ClaudeCode/IUSMK.COM/artifacts/api-server" && ./node_modules/.bin/tsc -p tsconfig.json --noEmit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add artifacts/api-server/package.json artifacts/api-server/vitest.config.ts artifacts/api-server/src/lib/fcmPush.ts artifacts/api-server/src/lib/fcmPush.test.ts
git commit -m "feat(api): add fcmPush sender + firebase-admin init with vitest"
```

---

### Task 3: Unified `pushDispatch` fan-out + swap call sites

**Files:**
- Create: `artifacts/api-server/src/lib/pushDispatch.ts`
- Create: `artifacts/api-server/src/lib/pushDispatch.test.ts`
- Modify: `artifacts/api-server/src/lib/notifications.ts` (swap imports + 3 calls)
- Modify: `artifacts/api-server/src/routes/auth.ts` (swap import + 2 calls)
- Modify: `artifacts/api-server/src/routes/contact.ts` (swap import + 1 call)
- Modify: `artifacts/api-server/src/routes/sumup.ts` (swap import + 1 call)

**Interfaces:**
- Consumes: `sendPushToUser/Users/Admin` from `./webPush`; `sendFcmToUser/Users/Admin` from `./fcmPush`.
- Produces:
  - `notifyUser(userId: number, payload: PushPayload): Promise<void>`
  - `notifyUsers(userIds: number[], payload: PushPayload): Promise<void>`
  - `notifyAdmin(payload: PushPayload): Promise<void>`

- [ ] **Step 1: Write the failing fan-out test**

Create `artifacts/api-server/src/lib/pushDispatch.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const webPush = { sendPushToUser: vi.fn(), sendPushToUsers: vi.fn(), sendPushToAdmin: vi.fn() };
const fcmPush = { sendFcmToUser: vi.fn(), sendFcmToUsers: vi.fn(), sendFcmToAdmin: vi.fn() };
vi.mock("./webPush", () => webPush);
vi.mock("./fcmPush", () => fcmPush);

import { notifyUser, notifyUsers, notifyAdmin } from "./pushDispatch";

beforeEach(() => vi.clearAllMocks());

describe("pushDispatch fan-out", () => {
  it("notifyUser hits both web and fcm with same args", async () => {
    const payload = { title: "t", body: "b" };
    await notifyUser(5, payload);
    expect(webPush.sendPushToUser).toHaveBeenCalledWith(5, payload);
    expect(fcmPush.sendFcmToUser).toHaveBeenCalledWith(5, payload);
  });

  it("notifyAdmin hits both web and fcm", async () => {
    const payload = { title: "t", body: "b" };
    await notifyAdmin(payload);
    expect(webPush.sendPushToAdmin).toHaveBeenCalledWith(payload);
    expect(fcmPush.sendFcmToAdmin).toHaveBeenCalledWith(payload);
  });

  it("notifyUsers hits both web and fcm", async () => {
    const payload = { title: "t", body: "b" };
    await notifyUsers([1, 2], payload);
    expect(webPush.sendPushToUsers).toHaveBeenCalledWith([1, 2], payload);
    expect(fcmPush.sendFcmToUsers).toHaveBeenCalledWith([1, 2], payload);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd "C:/Users/andre/desktop/ClaudeCode/IUSMK.COM/artifacts/api-server" && ./node_modules/.bin/vitest run src/lib/pushDispatch.test.ts`
Expected: FAIL — `pushDispatch` module not found.

- [ ] **Step 3: Implement `pushDispatch.ts`**

Create `artifacts/api-server/src/lib/pushDispatch.ts`:

```typescript
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd "C:/Users/andre/desktop/ClaudeCode/IUSMK.COM/artifacts/api-server" && ./node_modules/.bin/vitest run src/lib/pushDispatch.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Swap call sites in `notifications.ts`**

In `artifacts/api-server/src/lib/notifications.ts` line 12, replace:

```typescript
import { sendPushToUser, sendPushToAdmin, sendPushToUsers } from "./webPush";
```

with:

```typescript
import { notifyUser, notifyAdmin, notifyUsers } from "./pushDispatch";
```

Then update the three calls (these currently capture a `{ sent, failed }`-style result; the unified functions return `void`, so drop the result capture and any logging that reads `result.sent`):
- Line ~200: `const result = await sendPushToUser(userId, payload);` → `await notifyUser(userId, payload);` (remove subsequent references to `result.*`; if a log line uses it, replace with a static message e.g. `logger.info({ userId }, "[NOTIFY] dispatched to user");`).
- Line ~257: `const result = await sendPushToAdmin(payload);` → `await notifyAdmin(payload);` (same treatment for `result.*`).
- Line ~315: `const { sent, failed } = await sendPushToUsers(userIds, payload);` → `await notifyUsers(userIds, payload);` (remove later use of `sent`/`failed`; replace with static log if needed).

Read the surrounding lines first and adjust logging so no undefined variable remains.

- [ ] **Step 6: Swap call sites in `auth.ts`**

In `artifacts/api-server/src/routes/auth.ts` line 8, replace:

```typescript
import { sendPushToAdmin } from "../lib/webPush";
```

with:

```typescript
import { notifyAdmin } from "../lib/pushDispatch";
```

Replace both `sendPushToAdmin({ ... })` calls (lines ~47 and ~610) with `notifyAdmin({ ... })` — the argument object stays identical.

- [ ] **Step 7: Swap call site in `contact.ts`**

In `artifacts/api-server/src/routes/contact.ts` line 4, replace:

```typescript
import { sendPushToAdmin } from "../lib/webPush";
```

with:

```typescript
import { notifyAdmin } from "../lib/pushDispatch";
```

Replace the `sendPushToAdmin({ ... })` call (line ~44) with `notifyAdmin({ ... })`.

- [ ] **Step 8: Swap call site in `sumup.ts`**

In `artifacts/api-server/src/routes/sumup.ts` line 12, replace:

```typescript
import { sendPushToUser } from "../lib/webPush.js";
```

with:

```typescript
import { notifyUser } from "../lib/pushDispatch.js";
```

Replace the `sendPushToUser(userId, { ... })` call (line ~186) with `notifyUser(userId, { ... })`.

- [ ] **Step 9: Typecheck the whole backend**

Run: `cd "C:/Users/andre/desktop/ClaudeCode/IUSMK.COM/artifacts/api-server" && ./node_modules/.bin/tsc -p tsconfig.json --noEmit`
Expected: PASS — no unused imports, no `result.sent` undefined references.

- [ ] **Step 10: Run all backend tests**

Run: `cd "C:/Users/andre/desktop/ClaudeCode/IUSMK.COM/artifacts/api-server" && ./node_modules/.bin/vitest run`
Expected: PASS (Task 2 + Task 3 tests).

- [ ] **Step 11: Commit**

```bash
git add artifacts/api-server/src/lib/pushDispatch.ts artifacts/api-server/src/lib/pushDispatch.test.ts artifacts/api-server/src/lib/notifications.ts artifacts/api-server/src/routes/auth.ts artifacts/api-server/src/routes/contact.ts artifacts/api-server/src/routes/sumup.ts
git commit -m "feat(api): fan out notifications to web-push + FCM via pushDispatch"
```

---

### Task 4: Native-token endpoints (customer + admin)

**Files:**
- Modify: `artifacts/api-server/src/routes/customer.ts` (add 2 routes + import)
- Modify: `artifacts/api-server/src/routes/admin.ts` (add 2 routes + import)

**Interfaces:**
- Consumes: `saveNativeToken`, `deleteNativeToken` from `../lib/fcmPush`; existing `requireCustomerAuth`/admin auth middleware and `AuthRequest` (`req.userId`, `req.userRole`, `req.log`).
- Produces: HTTP endpoints `POST/DELETE /api/customer/push/native-token`, `POST/DELETE /api/admin/push/native-token`. POST body `{ token: string, platform?: "android" | "ios" }`. DELETE body `{ token: string }`.

- [ ] **Step 1: Add import in `customer.ts`**

At the top of `artifacts/api-server/src/routes/customer.ts`, alongside the existing webPush import, add:

```typescript
import { saveNativeToken, deleteNativeToken } from "../lib/fcmPush";
```

- [ ] **Step 2: Add the customer routes**

In `artifacts/api-server/src/routes/customer.ts`, immediately after the existing `router.delete("/push/subscribe", ...)` block (around line 556), add:

```typescript
router.post("/push/native-token", requireCustomerAuth, async (req: AuthRequest, res) => {
  const { token, platform } = req.body;
  if (!token) { res.status(400).json({ error: "token required" }); return; }
  try {
    const userAgent = req.headers["user-agent"] ?? null;
    await saveNativeToken(token, req.userId!, "customer", platform ?? null, userAgent);
    req.log.info({ userId: req.userId, platform }, "[FCM] Customer native token saved");
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err, userId: req.userId }, "[FCM] Customer save native token error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/push/native-token", requireCustomerAuth, async (req: AuthRequest, res) => {
  const { token } = req.body;
  if (!token) { res.status(400).json({ error: "token required" }); return; }
  try {
    await deleteNativeToken(token);
    req.log.info({ userId: req.userId }, "[FCM] Customer native token removed");
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err, userId: req.userId }, "[FCM] Customer delete native token error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});
```

- [ ] **Step 3: Add import + routes in `admin.ts`**

First read how admin push routes / auth middleware are named in `artifacts/api-server/src/routes/admin.ts` (search for `requireAdminAuth` or the middleware used by other admin routes, and the existing `/push/subscribe` admin route). Add the import:

```typescript
import { saveNativeToken, deleteNativeToken } from "../lib/fcmPush";
```

Then add, next to the admin push routes, using the SAME admin auth middleware the file already uses for `/push/subscribe`:

```typescript
router.post("/push/native-token", requireAdminAuth, async (req: AuthRequest, res) => {
  const { token, platform } = req.body;
  if (!token) { res.status(400).json({ error: "token required" }); return; }
  try {
    const userAgent = req.headers["user-agent"] ?? null;
    await saveNativeToken(token, req.userId ?? null, "admin", platform ?? null, userAgent);
    req.log.info({ userId: req.userId, platform }, "[FCM] Admin native token saved");
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "[FCM] Admin save native token error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/push/native-token", requireAdminAuth, async (req: AuthRequest, res) => {
  const { token } = req.body;
  if (!token) { res.status(400).json({ error: "token required" }); return; }
  try {
    await deleteNativeToken(token);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "[FCM] Admin delete native token error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});
```

If the actual admin middleware name differs (e.g. `requireAdmin`), use that exact name.

- [ ] **Step 4: Typecheck**

Run: `cd "C:/Users/andre/desktop/ClaudeCode/IUSMK.COM/artifacts/api-server" && ./node_modules/.bin/tsc -p tsconfig.json --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/routes/customer.ts artifacts/api-server/src/routes/admin.ts
git commit -m "feat(api): add native-token register/unregister endpoints"
```

---

### Task 5: Frontend native push branch

**Files:**
- Modify: `artifacts/barber-artist/package.json` (add `@capacitor/push-notifications`)
- Modify: `artifacts/barber-artist/src/hooks/use-push-notifications.ts` (native branch)

**Interfaces:**
- Consumes: `notifyUser`/native-token endpoints `POST /{base}/push/native-token`; `fetchApi` from `@/lib/api-client`; `Capacitor` from `@capacitor/core`; `PushNotifications` from `@capacitor/push-notifications`.
- Produces: the existing hook return shape unchanged — `{ status, error, subscribe, unsubscribe }`. On native, `subscribe` registers for FCM and POSTs the token; `status` reflects native permission state.

- [ ] **Step 1: Install the plugin**

Run: `cd "C:/Users/andre/desktop/ClaudeCode/IUSMK.COM/artifacts/barber-artist" && pnpm add @capacitor/push-notifications@^8.0.0 --ignore-scripts`
Expected: package added to `dependencies`.

- [ ] **Step 2: Add the native branch to the hook**

In `artifacts/barber-artist/src/hooks/use-push-notifications.ts`, add these imports at the top:

```typescript
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
```

Add, right after the `const swPath = ...` line inside the hook, a native short-circuit. Replace the existing `useEffect(() => { if (!supported) ... }, [...])` so that the NATIVE case is handled first. Insert this effect ABOVE the existing web effect:

```typescript
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
```

Then guard the EXISTING web effect so it does nothing on native — change its first lines from:

```typescript
  useEffect(() => {
    if (!supported) {
```

to:

```typescript
  useEffect(() => {
    if (isNative) return;
    if (!supported) {
```

And update `subscribe` to handle native first — at the very start of the `subscribe` callback body (before the `if (!supported)` check), insert:

```typescript
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
```

And update `unsubscribe` — at the start of its body insert:

```typescript
    if (isNative) {
      // Native unsubscribe is best-effort; we simply stop showing as subscribed.
      setStatus("unsubscribed");
      return;
    }
```

Also add `isNative` to the `subscribe`/`unsubscribe` `useCallback` dependency arrays.

- [ ] **Step 3: Typecheck the frontend**

Run: `cd "C:/Users/andre/desktop/ClaudeCode/IUSMK.COM/artifacts/barber-artist" && ./node_modules/.bin/tsc --noEmit -p tsconfig.json`
Expected: PASS. (If `tsconfig.json` path differs, use the one referenced by the build.)

- [ ] **Step 4: Build web + sync**

Run: `cd "C:/Users/andre/desktop/ClaudeCode/IUSMK.COM/artifacts/barber-artist" && ./node_modules/.bin/vite build --config vite.config.ts && ./node_modules/.bin/cap sync android`
Expected: build succeeds; sync reports the `@capacitor/push-notifications` plugin added to Android.

- [ ] **Step 5: Commit**

```bash
git add artifacts/barber-artist/package.json artifacts/barber-artist/pnpm-lock.yaml artifacts/barber-artist/src/hooks/use-push-notifications.ts
git commit -m "feat(app): native FCM push registration in usePushNotifications"
```

---

### Task 6: Android Firebase config + push build (needs user's Firebase artifacts)

**Files:**
- Add (user-provided): `artifacts/barber-artist/android/app/google-services.json`
- Modify: `artifacts/barber-artist/android/app/build.gradle` (versionCode 1 → 2)

**Interfaces:**
- Consumes: a real Firebase project with an Android app `com.iusmk.app` (created by the user), its `google-services.json`, and the backend env var `FIREBASE_SERVICE_ACCOUNT` set on Vercel.
- Produces: a signed `app-release.aab` (versionCode 2) that registers FCM tokens and receives pushes.

- [ ] **Step 1: Place `google-services.json`**

User downloads it from Firebase console (Project settings → Android app `com.iusmk.app`) and saves it to:
`artifacts/barber-artist/android/app/google-services.json`
(The `app/build.gradle` already applies the google-services plugin when this file exists.)

- [ ] **Step 2: Add the FCM Gradle dependency**

Confirm the Google Services classpath is available. In `artifacts/barber-artist/android/build.gradle` (project-level), ensure the `dependencies` block under `buildscript` includes:

```gradle
classpath 'com.google.gms:google-services:4.4.2'
```

In `artifacts/barber-artist/android/app/build.gradle`, add to the `dependencies` block:

```gradle
implementation 'com.google.firebase:firebase-messaging:24.0.3'
```

- [ ] **Step 3: Bump versionCode**

In `artifacts/barber-artist/android/app/build.gradle`, change:

```gradle
        versionCode 1
        versionName "1.0"
```

to:

```gradle
        versionCode 2
        versionName "1.0"
```

- [ ] **Step 4: Set the backend env var (Vercel)**

The service-account JSON (Firebase console → Project settings → Service accounts → Generate new private key) must be base64-encoded and stored as `FIREBASE_SERVICE_ACCOUNT` on the backend Vercel project (`iusmk.com_ufficiale`). To produce the base64 locally:
Run: `cd "C:/Users/andre/Desktop" && base64 -w0 iusmk-service-account.json` (copy the output into the Vercel env var). Then redeploy the backend.

- [ ] **Step 5: Build the signed bundle**

Run:
```bash
cd "C:/Users/andre/desktop/ClaudeCode/IUSMK.COM/artifacts/barber-artist" && ./node_modules/.bin/vite build --config vite.config.ts && ./node_modules/.bin/cap sync android
```
Then (PowerShell) with `JAVA_HOME` set to Android Studio's JBR:
```
cd android && ./gradlew.bat bundleRelease --no-daemon
```
Expected: `BUILD SUCCESSFUL`, signed `app/build/outputs/bundle/release/app-release.aab` with versionCode 2.

- [ ] **Step 6: Manual end-to-end test**

1. Build a debug APK or install the bundle on a real Android device (logged in as a customer).
2. Open the notifications page → tap "attiva notifiche" → grant permission.
3. In the backend logs, confirm `[FCM] Customer native token saved`.
4. From the admin panel, send a notification to that customer.
5. Confirm the push arrives on the device and tapping it opens `/notifications/:id`.

- [ ] **Step 7: Commit the config**

```bash
git add artifacts/barber-artist/android/app/google-services.json artifacts/barber-artist/android/app/build.gradle artifacts/barber-artist/android/build.gradle
git commit -m "feat(android): wire Firebase Messaging + bump versionCode to 2"
```

---

## Self-Review

**Spec coverage:**
- Firebase/FCM second channel → Tasks 2, 3, 6. ✓
- Native token storage → Task 1. ✓
- Native token endpoints → Task 4. ✓
- Frontend native branch + tap navigation → Task 5. ✓
- Unified `notifyUser` fan-out, no business-logic change → Task 3. ✓
- `google-services.json` committed, service account as env var → Task 6 + Global Constraints. ✓
- versionCode bump → Task 6. ✓
- iOS deferred → out of scope here (Global Constraints / spec). ✓
- Testing (fcmPush unit + dispatch fan-out + manual Android) → Tasks 2, 3, 6. ✓

**Placeholder scan:** No TBD/TODO. Task 3 call-site edits and Task 4 admin middleware name require reading surrounding code first (explicitly instructed) — these are real edits, not placeholders, because the exact line content (e.g. logging using `result.sent`) varies and must be read before editing.

**Type consistency:** `PushPayload` shape identical across webPush/fcmPush/pushDispatch. `saveNativeToken(token, userId, role, platform, userAgent)` signature used consistently in Tasks 2 and 4. `deadTokensFromResponses(tokens, responses)` defined and tested in Task 2. Hook return shape `{ status, error, subscribe, unsubscribe }` preserved in Task 5.
