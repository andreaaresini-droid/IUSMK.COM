import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import {
  studentsTable, coursesTable, accessCodesTable,
  studentCourseAccessTable, notificationsTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { requireCustomerAuth, AuthRequest } from "../middlewares/authMiddleware.js";
import { createSumUpCheckout, verifySumUpWebhookSignature } from "../lib/sumupClient.js";
import { generateAccessCode } from "../lib/auth.js";
import { sendPushToUser } from "../lib/webPush.js";

const router = Router();

// ── POST /api/sumup/checkout ─────────────────────────────────────────────────
router.post("/checkout", requireCustomerAuth as any, async (req: AuthRequest, res: Response) => {
  const { courseId } = req.body;

  if (!courseId) {
    res.status(400).json({ error: "Bad Request", message: "courseId obbligatorio" });
    return;
  }

  try {
    const course = await db.query.coursesTable.findFirst({
      where: eq(coursesTable.id, Number(courseId)),
    });

    if (!course || !course.isPublished) {
      res.status(404).json({ error: "Not Found", message: "Corso non trovato" });
      return;
    }

    if (!course.price || course.price <= 0) {
      res.status(400).json({ error: "Bad Request", message: "Questo corso non ha un prezzo configurato" });
      return;
    }

    // Controlla se l'utente ha già accesso al corso
    const existing = await db.query.studentCourseAccessTable.findFirst({
      where: and(
        eq(studentCourseAccessTable.studentId, req.userId!),
        eq(studentCourseAccessTable.courseId, Number(courseId)),
        eq(studentCourseAccessTable.status, "active"),
      ),
    });

    if (existing) {
      res.status(409).json({ error: "Conflict", message: "Hai già accesso a questo corso" });
      return;
    }

    const nonce = crypto.randomUUID();
    const checkoutReference = `${req.userId}:${courseId}:${nonce}`;

    const baseUrl = (process.env.VITE_API_URL ?? "https://iusmk.com").replace("/api", "").replace(/api\./,"");

    const checkout = await createSumUpCheckout({
      checkoutReference,
      amount: course.price,
      currency: "EUR",
      description: course.title,
      redirectUrl: `${baseUrl}/checkout/success`,
    });

    res.json({ sessionUrl: checkout.hosted_checkout_url });
  } catch (err: any) {
    console.error("[SUMUP] checkout creation error:", err.message);
    res.status(500).json({ error: "Internal Server Error", message: "Impossibile creare il pagamento" });
  }
});

// ── POST /api/sumup/webhook ──────────────────────────────────────────────────
// rawBody disponibile perché app.ts monta express.raw() per questa route prima di json()
router.post("/webhook", async (req: Request, res: Response) => {
  const signature = req.headers["x-webhook-signature"] as string | undefined;

  if (!signature || !verifySumUpWebhookSignature(req.body as Buffer, signature)) {
    console.warn("[SUMUP WEBHOOK] firma non valida");
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  let event: any;
  try {
    event = JSON.parse((req.body as Buffer).toString("utf8"));
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  console.log("[SUMUP WEBHOOK] evento:", event.event_type, event.payload?.status);

  // Processa solo pagamenti completati
  if (event.event_type !== "CHECKOUT_STATUS_CHANGED" || event.payload?.status !== "PAID") {
    res.json({ received: true });
    return;
  }

  const checkoutReference: string = event.payload?.checkout_reference ?? "";
  const parts = checkoutReference.split(":");

  if (parts.length < 3) {
    console.error("[SUMUP WEBHOOK] checkout_reference malformato:", checkoutReference);
    res.status(400).json({ error: "Invalid checkout_reference" });
    return;
  }

  const userId = parseInt(parts[0]);
  const courseId = parseInt(parts[1]);

  if (isNaN(userId) || isNaN(courseId)) {
    console.error("[SUMUP WEBHOOK] userId o courseId non numerici:", parts);
    res.status(400).json({ error: "Invalid reference parts" });
    return;
  }

  try {
    const [student, course] = await Promise.all([
      db.query.studentsTable.findFirst({ where: eq(studentsTable.id, userId) }),
      db.query.coursesTable.findFirst({ where: eq(coursesTable.id, courseId) }),
    ]);

    if (!student || !course) {
      console.error("[SUMUP WEBHOOK] studente o corso non trovato — userId:", userId, "courseId:", courseId);
      res.status(404).json({ error: "Student or course not found" });
      return;
    }

    // Idempotenza: se ha già accesso, skip
    const alreadyHasAccess = await db.query.studentCourseAccessTable.findFirst({
      where: and(
        eq(studentCourseAccessTable.studentId, userId),
        eq(studentCourseAccessTable.courseId, courseId),
        eq(studentCourseAccessTable.status, "active"),
      ),
    });

    if (alreadyHasAccess) {
      console.log("[SUMUP WEBHOOK] accesso già presente — idempotente, skip");
      res.json({ received: true });
      return;
    }

    // Genera codice accesso
    const code = generateAccessCode();

    const [accessCode] = await db.insert(accessCodesTable).values({
      code,
      courseId,
      assignedEmail: student.email,
      isActive: true,
      maxDevices: 2,
      boundUserId: userId,
      notes: `Auto-generato dopo pagamento SumUp — ref: ${checkoutReference}`,
    }).returning();

    // Crea accesso al corso
    await db.insert(studentCourseAccessTable).values({
      studentId: userId,
      courseId,
      accessCodeId: accessCode.id,
      status: "active",
    });

    // Aggiorna ruolo a "student" se era "customer"
    if (student.role === "customer") {
      await db.update(studentsTable)
        .set({ role: "student", updatedAt: new Date() })
        .where(eq(studentsTable.id, userId));
    }

    // Crea notifica in DB
    await db.insert(notificationsTable).values({
      userId,
      courseId,
      type: "payment_success",
      title: `Accesso al corso: ${course.title}`,
      message: `Il tuo pagamento è confermato! Usa il codice **${code}** per attivare l'accesso al corso "${course.title}". Vai su /access per attivarlo.`,
      accessCode: code,
      isRead: false,
    });

    // Invia push notification (ignora errori push — non bloccare il webhook)
    sendPushToUser(userId, {
      title: "Pagamento confermato — IUSMK",
      body: `Corso "${course.title}" acquistato! Il tuo codice di accesso è: ${code}`,
      url: "/notifications",
    }).catch(() => {});

    console.log("[SUMUP WEBHOOK] codice generato:", code, "userId:", userId, "courseId:", courseId);
    res.json({ received: true });
  } catch (err: any) {
    console.error("[SUMUP WEBHOOK] errore:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
