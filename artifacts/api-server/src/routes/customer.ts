import { Router } from "express";
import { db } from "@workspace/db";
import {
  notificationsTable, coursePurchasesTable, coursesTable,
  accessCodesTable, studentCourseAccessTable, studentsTable,
  chatConversationsTable, chatMessagesTable, courseModulesTable,
  deviceSessionsTable, videoProgressTable, nativePushTokensTable,
  pushSubscriptionsTable, passwordResetTokensTable, videoDisclaimerAcksTable,
} from "@workspace/db/schema";
import { isNotNull } from "drizzle-orm";
import { eq, and, desc, or, asc, gte } from "drizzle-orm";
import { requireCustomerAuth, AuthRequest } from "../middlewares/authMiddleware";
import { Response, NextFunction } from "express";

async function requireStudentChatAccess(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (req.userRole === "student") { next(); return; }
  try {
    const access = await db.query.studentCourseAccessTable.findFirst({
      where: and(
        eq(studentCourseAccessTable.studentId, req.userId!),
        eq(studentCourseAccessTable.status, "active"),
      ),
    });
    if (!access) {
      res.status(403).json({
        error: "Accesso riservato agli studenti",
        message: "Devi avere almeno un corso attivo per accedere alla chat.",
      });
      return;
    }
    next();
  } catch (err) {
    res.status(500).json({ error: "Errore verifica accesso chat" });
  }
}
import { getVapidPublicKey, saveSubscription, deleteSubscription } from "../lib/webPush";
import { saveNativeToken, deleteNativeToken } from "../lib/fcmPush";
import { dispatchNotificationToAdmin } from "../lib/notifications";
import { generateVideoToken, comparePassword, hashPassword } from "../lib/auth";
import { reconcilePendingPurchases } from "../lib/sumupAccess";

const router = Router();

// GET /api/customer/notifications — notifiche del cliente autenticato
router.get("/notifications", requireCustomerAuth, async (req: AuthRequest, res) => {
  try {
    const notifications = await db.query.notificationsTable.findMany({
      where: and(
        eq(notificationsTable.userId, req.userId!),
        eq(notificationsTable.isAdminNotification, false)
      ),
      orderBy: [desc(notificationsTable.createdAt)],
    });
    res.json(notifications);
  } catch (err) {
    req.log.error({ err }, "Get customer notifications error");
    res.status(500).json({ error: "Errore nel recupero delle notifiche" });
  }
});

// PUT /api/customer/notifications/:id/read — segna come letta
router.put("/notifications/:id/read", requireCustomerAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID non valido" });
    return;
  }
  try {
    const notification = await db.query.notificationsTable.findFirst({
      where: and(
        eq(notificationsTable.id, id),
        eq(notificationsTable.userId, req.userId!)
      ),
    });
    if (!notification) {
      res.status(404).json({ error: "Notifica non trovata" });
      return;
    }
    await db.update(notificationsTable)
      .set({ isRead: true })
      .where(eq(notificationsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Mark notification read error");
    res.status(500).json({ error: "Errore" });
  }
});

// PUT /api/customer/notifications/read-all — segna tutte come lette
router.put("/notifications/read-all", requireCustomerAuth, async (req: AuthRequest, res) => {
  try {
    await db.update(notificationsTable)
      .set({ isRead: true })
      .where(and(
        eq(notificationsTable.userId, req.userId!),
        eq(notificationsTable.isAdminNotification, false)
      ));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Mark all notifications read error");
    res.status(500).json({ error: "Errore" });
  }
});

// GET /api/customer/notifications/:id — singola notifica + segna letta
router.get("/notifications/:id", requireCustomerAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }
  try {
    const notification = await db.query.notificationsTable.findFirst({
      where: and(
        eq(notificationsTable.id, id),
        eq(notificationsTable.userId, req.userId!),
        eq(notificationsTable.isAdminNotification, false)
      ),
    });
    if (!notification) { res.status(404).json({ error: "Notifica non trovata" }); return; }
    // Auto-mark as read
    if (!notification.isRead) {
      await db.update(notificationsTable)
        .set({ isRead: true })
        .where(eq(notificationsTable.id, id));
    }
    res.json({ ...notification, isRead: true });
  } catch (err) {
    req.log.error({ err }, "Get single notification error");
    res.status(500).json({ error: "Errore" });
  }
});

// GET /api/customer/notifications/:id/video-token — genera token video per notifica
// Risolve il problema del 403 sui video: genera un JWT video che consente
// lo streaming attraverso /api/video/stream (con Range headers per mobile)
router.get("/notifications/:id/video-token", requireCustomerAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }
  try {
    const notification = await db.query.notificationsTable.findFirst({
      where: and(
        eq(notificationsTable.id, id),
        eq(notificationsTable.userId, req.userId!),
        eq(notificationsTable.isAdminNotification, false)
      ),
    });
    if (!notification) {
      res.status(404).json({ error: "Notifica non trovata" }); return;
    }
    if (!notification.videoUrl) {
      res.status(404).json({ error: "Questa notifica non contiene un video" }); return;
    }

    // Extract the GCS objectId from the stored URL
    // Stored as: /api/storage/objects/uploads/{uuid}
    const STORAGE_PREFIX = "/api/storage/objects/";
    const objectId = notification.videoUrl.startsWith(STORAGE_PREFIX)
      ? notification.videoUrl.slice(STORAGE_PREFIX.length)
      : notification.videoUrl;

    req.log.info({ notifId: id, userId: req.userId, objectId }, "[VIDEO] Generating notification video token");

    const token = generateVideoToken({
      studentId: req.userId!,
      courseId:  0,  // not applicable for notification videos
      moduleId:  0,
      videoPath: objectId,
    });

    res.json({
      token,
      streamUrl: `/api/video/stream?token=${encodeURIComponent(token)}`,
    });
  } catch (err) {
    req.log.error({ err }, "Notification video token error");
    res.status(500).json({ error: "Errore generazione token video" });
  }
});

// DELETE /api/customer/notifications/:id — elimina una notifica
router.delete("/notifications/:id", requireCustomerAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  try {
    await db.delete(notificationsTable).where(
      and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.userId!), eq(notificationsTable.isAdminNotification, false))
    );
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Delete customer notification error");
    res.status(500).json({ error: "Errore" });
  }
});

// DELETE /api/customer/notifications — elimina tutte le notifiche del cliente
router.delete("/notifications", requireCustomerAuth, async (req: AuthRequest, res) => {
  try {
    await db.delete(notificationsTable).where(
      and(eq(notificationsTable.userId, req.userId!), eq(notificationsTable.isAdminNotification, false))
    );
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Delete all customer notifications error");
    res.status(500).json({ error: "Errore" });
  }
});

// GET /api/customer/purchases — acquisti del cliente autenticato
router.get("/purchases", requireCustomerAuth, async (req: AuthRequest, res) => {
  try {
    const purchases = await db.query.coursePurchasesTable.findMany({
      where: and(
        eq(coursePurchasesTable.userId, req.userId!),
        eq(coursePurchasesTable.status, "completed")
      ),
    });
    const result = await Promise.all(purchases.map(async (p) => {
      const course = await db.query.coursesTable.findFirst({ where: eq(coursesTable.id, p.courseId) });
      return { ...p, courseTitle: course?.title || "Corso" };
    }));
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Get customer purchases error");
    res.status(500).json({ error: "Errore" });
  }
});

// ═══════════════════════════════════════════════════════════
// MY COURSES — corsi del cliente (acquistati o sbloccati)
// ═══════════════════════════════════════════════════════════

// GET /api/customer/owned-course-ids — IDs dei corsi attivi per questo utente (usato da Academy/CourseDetail per bloccare doppio acquisto)
router.get("/owned-course-ids", requireCustomerAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const activeAccesses = await db.query.studentCourseAccessTable.findMany({
      where: and(
        eq(studentCourseAccessTable.studentId, userId),
        eq(studentCourseAccessTable.status, "active"),
      ),
    });
    const courseIds = activeAccesses.map((a) => a.courseId);
    console.log(`[OWNED COURSES] userId=${userId} courseIds attivi:`, courseIds);
    res.json({ courseIds });
  } catch (err) {
    req.log.error({ err }, "Get owned course ids error");
    res.status(500).json({ error: "Errore interno" });
  }
});

// IDs moduli acquistati singolarmente
router.get("/owned-module-ids", requireCustomerAuth, async (req: AuthRequest, res) => {
  try {
    const purchases = await db.query.coursePurchasesTable.findMany({
      where: and(
        eq(coursePurchasesTable.userId, req.userId!),
        eq(coursePurchasesTable.status, "completed"),
        isNotNull(coursePurchasesTable.moduleId),
      ),
      columns: { moduleId: true },
    });
    const ids = purchases.map((p) => p.moduleId).filter(Boolean) as number[];
    res.json({ moduleIds: ids });
  } catch (err) {
    req.log.error({ err }, "Get owned module ids error");
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/my-courses", requireCustomerAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    req.log.info({ userId }, "[MY COURSES] fetching active courses only");

    // Riconcilia eventuali pagamenti SumUp ancora "pending": se il pagamento
    // risulta PAID, sblocca il corso. Garantisce lo sblocco anche se SumUp non
    // reindirizza l'utente al sito e il webhook non arriva.
    await reconcilePendingPurchases(userId).catch(() => {});

    // Only return courses with an ACTIVE studentCourseAccess record.
    // Courses that are merely assigned (code not yet activated) do NOT appear here —
    // the customer should activate them from the Academy section first.
    const activeAccesses = await db.query.studentCourseAccessTable.findMany({
      where: and(
        eq(studentCourseAccessTable.studentId, userId),
        eq(studentCourseAccessTable.status, "active"),
      ),
      orderBy: [desc(studentCourseAccessTable.createdAt)],
    });

    req.log.info({ userId, activeCount: activeAccesses.length }, "[MY COURSES] active access records found");

    const result = await Promise.all(activeAccesses.map(async (access) => {
      const course = await db.query.coursesTable.findFirst({ where: eq(coursesTable.id, access.courseId) });

      // Verifica di coerenza: se il codice associato è stato revocato/eliminato ma
      // l'accesso ha ancora status "active", logga un warning [BUG]
      if (access.accessCodeId) {
        const linkedCode = await db.query.accessCodesTable.findFirst({
          where: eq(accessCodesTable.id, access.accessCodeId),
        });
        if (linkedCode && !linkedCode.isActive) {
          req.log.warn(
            { userId, accessId: access.id, codeId: access.accessCodeId, courseId: access.courseId },
            "[BUG] studentCourseAccess status=active but linked accessCode is revoked — this should not happen",
          );
        }
      }

      // Also try to find a related purchase (for display only)
      const purchase = await db.query.coursePurchasesTable.findFirst({
        where: and(
          eq(coursePurchasesTable.userId, userId),
          eq(coursePurchasesTable.courseId, access.courseId),
        ),
      });

      return {
        id:                access.id,
        courseId:          access.courseId,
        courseTitle:       course?.title ?? "Corso",
        courseThumbnail:   course?.thumbnailUrl ?? null,
        courseDescription: course?.shortDescription ?? null,
        purchaseStatus:    "active",
        amountPaid:        purchase?.amountPaid ?? 0,
        activated:         true,
        unlockedAt:        access.createdAt,
        createdAt:         access.createdAt,
      };
    }));

    req.log.info({ userId, total: result.length }, "[MY COURSES] returning active courses");
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "[MY COURSES ERROR] failed to fetch active courses");
    res.status(500).json({ error: "Errore nel recupero dei corsi" });
  }
});

// ═══════════════════════════════════════════════════════════
// CUSTOMER CHAT
// ═══════════════════════════════════════════════════════════

// Helper: get or create the customer's conversation
async function getOrCreateConversation(userId: number) {
  let conv = await db.query.chatConversationsTable.findFirst({
    where: eq(chatConversationsTable.userId, userId),
    orderBy: [desc(chatConversationsTable.createdAt)],
  });
  if (!conv) {
    const user = await db.query.studentsTable.findFirst({ where: eq(studentsTable.id, userId) });
    const [created] = await db.insert(chatConversationsTable).values({
      userId,
      status: "open",
      unreadUserCount: 0,
      unreadAdminCount: 0,
    }).returning();
    conv = created;
  }
  return conv;
}

// GET /api/customer/chat — conversation + last messages
router.get("/chat", requireCustomerAuth, requireStudentChatAccess, async (req: AuthRequest, res) => {
  try {
    const conv = await getOrCreateConversation(req.userId!);
    const msgs = await db.query.chatMessagesTable.findMany({
      where: eq(chatMessagesTable.conversationId, conv.id),
      orderBy: [asc(chatMessagesTable.createdAt)],
    });
    res.json({ conversation: conv, messages: msgs });
  } catch (err) {
    req.log.error({ err }, "Get customer chat error");
    res.status(500).json({ error: "Errore nel recupero della chat" });
  }
});

// GET /api/customer/chat/unread — unread count badge
router.get("/chat/unread", requireCustomerAuth, requireStudentChatAccess, async (req: AuthRequest, res) => {
  try {
    const conv = await db.query.chatConversationsTable.findFirst({
      where: eq(chatConversationsTable.userId, req.userId!),
    });
    res.json({ unread: conv?.unreadUserCount ?? 0 });
  } catch (err) {
    res.json({ unread: 0 });
  }
});

// POST /api/customer/chat/messages — invia messaggio
router.post("/chat/messages", requireCustomerAuth, requireStudentChatAccess, async (req: AuthRequest, res) => {
  const { content } = req.body as { content: string };
  if (!content?.trim()) {
    res.status(400).json({ error: "Messaggio vuoto" });
    return;
  }
  try {
    const conv = await getOrCreateConversation(req.userId!);
    if (conv.status === "closed") {
      res.status(400).json({ error: "Conversazione chiusa" });
      return;
    }

    const [msg] = await db.insert(chatMessagesTable).values({
      conversationId: conv.id,
      senderType:     "user",
      senderId:       req.userId!,
      content:        content.trim(),
    }).returning();

    // Update conversation
    await db.update(chatConversationsTable).set({
      lastMessageAt:    new Date(),
      unreadAdminCount: conv.unreadAdminCount + 1,
      updatedAt:        new Date(),
    }).where(eq(chatConversationsTable.id, conv.id));

    // Notify admin via centralized dispatcher (DB + push)
    const user = await db.query.studentsTable.findFirst({ where: eq(studentsTable.id, req.userId!) });
    dispatchNotificationToAdmin({
      type:    "chat_message",
      title:   `Nuovo messaggio da ${user?.name ?? "Cliente"}`,
      message: content.trim().slice(0, 200),
      linkUrl: `/admin/chat?conv=${conv.id}`,
      metadata: JSON.stringify({
        conversationId: conv.id,
        senderId:       req.userId!,
        senderName:     user?.name ?? "Cliente",
        senderEmail:    user?.email ?? "",
      }),
    }).catch((err) => {
      req.log.error({ err }, "[NOTIFY] dispatchNotificationToAdmin failed (customer chat)");
    });

    res.status(201).json(msg);
  } catch (err) {
    req.log.error({ err }, "Send customer chat message error");
    res.status(500).json({ error: "Errore nell'invio del messaggio" });
  }
});

// PUT /api/customer/chat/read — mark user's unread as read (reset unreadUserCount)
router.put("/chat/read", requireCustomerAuth, requireStudentChatAccess, async (req: AuthRequest, res) => {
  try {
    const conv = await db.query.chatConversationsTable.findFirst({
      where: eq(chatConversationsTable.userId, req.userId!),
    });
    if (!conv) { res.json({ success: true }); return; }
    await db.update(chatConversationsTable).set({ unreadUserCount: 0, updatedAt: new Date() })
      .where(eq(chatConversationsTable.id, conv.id));
    // Mark admin messages as read
    await db.update(chatMessagesTable).set({ readAt: new Date() }).where(
      and(
        eq(chatMessagesTable.conversationId, conv.id),
        eq(chatMessagesTable.senderType, "admin"),
      )
    );
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Mark chat read error");
    res.status(500).json({ error: "Errore" });
  }
});

// POST /api/customer/chat/reopen-request — ask admin to reopen closed chat (max 1 ogni 3 ore)
const REOPEN_COOLDOWN_MS = 3 * 60 * 60 * 1000; // 180 minuti

router.post("/chat/reopen-request", requireCustomerAuth, requireStudentChatAccess, async (req: AuthRequest, res) => {
  try {
    const conv = await db.query.chatConversationsTable.findFirst({
      where: eq(chatConversationsTable.userId, req.userId!),
    });
    if (!conv) { res.status(404).json({ error: "Conversazione non trovata" }); return; }
    if (conv.status !== "closed") { res.status(400).json({ error: "La conversazione è già aperta" }); return; }

    // Rate limit: max 1 richiesta ogni 3 ore — controllato su lastReopenRequestAt nella conversazione
    if (conv.lastReopenRequestAt) {
      const elapsed = Date.now() - new Date(conv.lastReopenRequestAt).getTime();
      if (elapsed < REOPEN_COOLDOWN_MS) {
        const msLeft      = REOPEN_COOLDOWN_MS - elapsed;
        const totalMins   = Math.ceil(msLeft / 60000);
        const hoursLeft   = Math.floor(totalMins / 60);
        const minsLeft    = totalMins % 60;
        const parts: string[] = [];
        if (hoursLeft > 0) parts.push(`${hoursLeft} or${hoursLeft === 1 ? "a" : "e"}`);
        if (minsLeft  > 0) parts.push(`${minsLeft} minut${minsLeft === 1 ? "o" : "i"}`);
        const timeLabel = parts.join(" e ");
        res.status(429).json({
          error:      "rate_limited",
          message:    `Puoi inviare una nuova richiesta di riapertura tra ${timeLabel}.`,
          msLeft,
          nextAllowedAt: new Date(new Date(conv.lastReopenRequestAt).getTime() + REOPEN_COOLDOWN_MS).toISOString(),
        });
        return;
      }
    }

    // Segna timestamp della richiesta sulla conversazione
    await db.update(chatConversationsTable)
      .set({ lastReopenRequestAt: new Date(), updatedAt: new Date() })
      .where(eq(chatConversationsTable.id, conv.id));

    // Look up user info
    const user = await db.query.studentsTable.findFirst({ where: eq(studentsTable.id, req.userId!) });

    // Notify admin via centralized dispatcher (DB + push)
    await dispatchNotificationToAdmin({
      type:    "chat_reopen_request",
      title:   `Richiesta di riapertura chat da ${user?.name ?? "Cliente"}`,
      message: `${user?.name ?? "Un cliente"} chiede di riaprire la conversazione chiusa.`,
      linkUrl: `/admin/chat?conv=${conv.id}`,
      metadata: JSON.stringify({
        conversationId: conv.id,
        customerId:     req.userId!,
        customerName:   user?.name ?? "Cliente",
        customerEmail:  user?.email ?? "",
      }),
    });

    res.json({ success: true, message: "Richiesta inviata con successo" });
  } catch (err) {
    req.log.error({ err }, "Chat reopen request error");
    res.status(500).json({ error: "Errore interno" });
  }
});

// ═══════════════════════════════════════════════════════════
// CUSTOMER PUSH NOTIFICATIONS
// ═══════════════════════════════════════════════════════════

router.get("/push/vapid-public-key", requireCustomerAuth, (req: AuthRequest, res) => {
  const key = getVapidPublicKey();
  req.log.info({ userId: req.userId, hasKey: !!key }, "[PUSH] Customer requested VAPID public key");
  res.json({ publicKey: key });
});

router.post("/push/subscribe", requireCustomerAuth, async (req: AuthRequest, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    req.log.warn({ userId: req.userId, body: req.body }, "[PUSH] Customer subscribe — bad request (missing endpoint/keys)");
    res.status(400).json({ error: "Bad Request" }); return;
  }
  try {
    const userAgent = req.headers["user-agent"] ?? null;
    await saveSubscription({ endpoint, keys }, req.userId!, "customer", userAgent);
    req.log.info(
      { userId: req.userId, endpoint: endpoint.slice(0, 60) + "…" },
      "[PUSH] Customer subscription saved successfully"
    );
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err, userId: req.userId }, "[PUSH] Customer save push subscription error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/push/subscribe", requireCustomerAuth, async (req: AuthRequest, res) => {
  const { endpoint } = req.body;
  if (!endpoint) { res.status(400).json({ error: "endpoint required" }); return; }
  try {
    await deleteSubscription(endpoint);
    req.log.info({ userId: req.userId }, "[PUSH] Customer subscription removed");
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err, userId: req.userId }, "[PUSH] Customer delete push subscription error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

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

// PUT /api/customer/chat/close — close conversation
router.put("/chat/close", requireCustomerAuth, requireStudentChatAccess, async (req: AuthRequest, res) => {
  try {
    const conv = await db.query.chatConversationsTable.findFirst({
      where: eq(chatConversationsTable.userId, req.userId!),
    });
    if (!conv) { res.status(404).json({ error: "Conversazione non trovata" }); return; }
    await db.update(chatConversationsTable).set({ status: "closed", updatedAt: new Date() })
      .where(eq(chatConversationsTable.id, conv.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Errore" });
  }
});

// ═══════════════════════════════════════════════════════════
// ACCOUNT — profilo, password, eliminazione self-service
// (richiesto da Apple App Store guideline 5.1.1(v))
// ═══════════════════════════════════════════════════════════

// Un account ha una password "propria" solo se è gestito localmente.
// Gli account creati via Supabase salvano "supabase-managed" come placeholder.
function hasOwnPassword(passwordHash: string | null | undefined): boolean {
  return !!passwordHash && passwordHash !== "supabase-managed";
}

// GET /api/customer/profile — dati profilo del cliente autenticato
router.get("/profile", requireCustomerAuth, async (req: AuthRequest, res) => {
  try {
    const student = await db.query.studentsTable.findFirst({ where: eq(studentsTable.id, req.userId!) });
    if (!student) { res.status(404).json({ error: "Not Found", message: "Account non trovato" }); return; }
    res.json({
      firstName: student.firstName ?? "",
      lastName:  student.lastName ?? "",
      email:     student.email,
      hasPassword: hasOwnPassword(student.passwordHash),
    });
  } catch (err) {
    req.log.error({ err }, "Get customer profile error");
    res.status(500).json({ error: "Internal Server Error", message: "Errore nel recupero del profilo" });
  }
});

// PUT /api/customer/profile — aggiorna nome e cognome
router.put("/profile", requireCustomerAuth, async (req: AuthRequest, res) => {
  const firstName = String(req.body?.firstName ?? "").trim();
  const lastName  = String(req.body?.lastName ?? "").trim();
  if (!firstName || !lastName) {
    res.status(400).json({ error: "Bad Request", message: "Nome e cognome sono obbligatori" });
    return;
  }
  try {
    const fullName = `${firstName} ${lastName}`;
    await db.update(studentsTable)
      .set({ firstName, lastName, name: fullName, updatedAt: new Date() })
      .where(eq(studentsTable.id, req.userId!));
    res.json({ success: true, firstName, lastName, name: fullName });
  } catch (err) {
    req.log.error({ err }, "Update customer profile error");
    res.status(500).json({ error: "Internal Server Error", message: "Aggiornamento del profilo fallito" });
  }
});

// PUT /api/customer/password — cambio password (richiede la password attuale)
router.put("/password", requireCustomerAuth, async (req: AuthRequest, res) => {
  const currentPassword = String(req.body?.currentPassword ?? "");
  const newPassword     = String(req.body?.newPassword ?? "");
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Bad Request", message: "Password attuale e nuova password sono obbligatorie" });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: "Bad Request", message: "La nuova password deve essere di almeno 6 caratteri" });
    return;
  }
  try {
    const student = await db.query.studentsTable.findFirst({ where: eq(studentsTable.id, req.userId!) });
    if (!student) { res.status(404).json({ error: "Not Found", message: "Account non trovato" }); return; }
    if (!hasOwnPassword(student.passwordHash)) {
      res.status(400).json({
        error: "Bad Request",
        message: "Questo account accede tramite Google. La password va gestita dal tuo account Google.",
      });
      return;
    }
    const valid = await comparePassword(currentPassword, student.passwordHash!);
    if (!valid) {
      res.status(401).json({ error: "Unauthorized", message: "La password attuale non è corretta" });
      return;
    }
    const newHash = await hashPassword(newPassword);
    await db.update(studentsTable)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(studentsTable.id, req.userId!));
    res.json({ success: true, message: "Password aggiornata correttamente" });
  } catch (err) {
    req.log.error({ err }, "Change customer password error");
    res.status(500).json({ error: "Internal Server Error", message: "Cambio password fallito" });
  }
});

// DELETE /api/customer/account — eliminazione self-service dell'account e dei dati associati
router.delete("/account", requireCustomerAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  try {
    const student = await db.query.studentsTable.findFirst({ where: eq(studentsTable.id, userId) });
    if (!student) { res.status(404).json({ error: "Not Found", message: "Account non trovato" }); return; }

    // Se l'account ha una password propria, va riconfermata prima dell'eliminazione.
    if (hasOwnPassword(student.passwordHash)) {
      const password = String(req.body?.password ?? "");
      if (!password) {
        res.status(400).json({ error: "Bad Request", message: "Inserisci la password per confermare l'eliminazione" });
        return;
      }
      const valid = await comparePassword(password, student.passwordHash!);
      if (!valid) {
        res.status(401).json({ error: "Unauthorized", message: "Password non corretta" });
        return;
      }
    }

    // Eliminazione in transazione: ordine rispettoso dei vincoli FK verso students.
    await db.transaction(async (tx) => {
      // 1) Righe del cliente da eliminare
      await tx.delete(chatConversationsTable).where(eq(chatConversationsTable.userId, userId)); // chat_messages cascade
      await tx.delete(deviceSessionsTable).where(eq(deviceSessionsTable.userId, userId));
      await tx.delete(studentCourseAccessTable).where(eq(studentCourseAccessTable.studentId, userId));
      await tx.delete(videoProgressTable).where(eq(videoProgressTable.studentId, userId));
      await tx.delete(notificationsTable).where(eq(notificationsTable.userId, userId));
      await tx.delete(nativePushTokensTable).where(eq(nativePushTokensTable.userId, userId));
      await tx.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.userId, userId));
      await tx.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.userId, userId)); // anche cascade
      await tx.delete(videoDisclaimerAcksTable).where(eq(videoDisclaimerAcksTable.studentId, userId)); // anche cascade

      // 2) Dati conservati per obblighi di legge/fiscali: scollegati dall'account
      await tx.update(coursePurchasesTable).set({ userId: null }).where(eq(coursePurchasesTable.userId, userId));
      await tx.update(accessCodesTable).set({ boundUserId: null }).where(eq(accessCodesTable.boundUserId, userId));

      // 3) Infine l'account
      await tx.delete(studentsTable).where(eq(studentsTable.id, userId));
    });

    req.log.info({ userId }, "[ACCOUNT] cliente eliminato definitivamente su richiesta dell'utente");
    res.json({ success: true, message: "Account eliminato definitivamente" });
  } catch (err) {
    req.log.error({ err, userId }, "Delete customer account error");
    res.status(500).json({ error: "Internal Server Error", message: "Eliminazione dell'account fallita. Riprova più tardi." });
  }
});

export default router;
