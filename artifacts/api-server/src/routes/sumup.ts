import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import {
  studentsTable, coursesTable, accessCodesTable,
  studentCourseAccessTable, notificationsTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { requireCustomerAuth, AuthRequest } from "../middlewares/authMiddleware.js";
import { createSumUpCheckout, verifySumUpWebhookSignature, getSumUpCheckoutsByReference } from "../lib/sumupClient.js";
import { generateAccessCode } from "../lib/auth.js";
import { notifyUser } from "../lib/pushDispatch.js";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Sblocco corso dopo pagamento — logica CONDIVISA tra webhook e conferma-al-ritorno.
// Idempotente: se l'utente ha già accesso attivo, non duplica nulla.
// Ritorna il codice di accesso (nuovo o già esistente) per mostrarlo all'utente.
// ─────────────────────────────────────────────────────────────────────────────
async function grantCourseAccess(
  userId: number,
  courseId: number,
  paymentRef: string,
): Promise<{ ok: boolean; alreadyHad: boolean; accessCode: string | null; courseTitle: string }> {
  const [student, course] = await Promise.all([
    db.query.studentsTable.findFirst({ where: eq(studentsTable.id, userId) }),
    db.query.coursesTable.findFirst({ where: eq(coursesTable.id, courseId) }),
  ]);

  if (!student || !course) {
    console.error("[SUMUP ACCESS] studente o corso non trovato — userId:", userId, "courseId:", courseId);
    return { ok: false, alreadyHad: false, accessCode: null, courseTitle: "Corso" };
  }

  // Idempotenza: accesso già attivo → restituisci l'eventuale codice esistente
  const alreadyHasAccess = await db.query.studentCourseAccessTable.findFirst({
    where: and(
      eq(studentCourseAccessTable.studentId, userId),
      eq(studentCourseAccessTable.courseId, courseId),
      eq(studentCourseAccessTable.status, "active"),
    ),
  });

  if (alreadyHasAccess) {
    let existingCode: string | null = null;
    if (alreadyHasAccess.accessCodeId) {
      const ac = await db.query.accessCodesTable.findFirst({
        where: eq(accessCodesTable.id, alreadyHasAccess.accessCodeId),
      });
      existingCode = ac?.code ?? null;
    }
    return { ok: true, alreadyHad: true, accessCode: existingCode, courseTitle: course.title };
  }

  // Genera codice accesso + crea accesso attivo
  const code = generateAccessCode();

  const [accessCode] = await db.insert(accessCodesTable).values({
    code,
    courseId,
    assignedEmail: student.email,
    isActive: true,
    maxDevices: 2,
    boundUserId: userId,
    notes: `Auto-generato dopo pagamento SumUp — ref: ${paymentRef}`,
  }).returning();

  await db.insert(studentCourseAccessTable).values({
    studentId: userId,
    courseId,
    accessCodeId: accessCode.id,
    status: "active",
  });

  // Promuovi a "student" se era "customer"
  if (student.role === "customer") {
    await db.update(studentsTable)
      .set({ role: "student", updatedAt: new Date() })
      .where(eq(studentsTable.id, userId));
  }

  // Notifica in DB
  await db.insert(notificationsTable).values({
    userId,
    courseId,
    type: "payment_success",
    title: `Accesso al corso: ${course.title}`,
    message: `Il tuo pagamento è confermato! Il corso "${course.title}" è ora disponibile nella sezione "I miei corsi". Codice di accesso: **${code}**.`,
    accessCode: code,
    isRead: false,
  });

  // Push (best-effort)
  notifyUser(userId, {
    title: "Pagamento confermato — IUSMK",
    body: `Corso "${course.title}" sbloccato! Codice: ${code}`,
    url: "/my-courses",
  }).catch(() => {});

  console.log("[SUMUP ACCESS] corso sbloccato — userId:", userId, "courseId:", courseId, "code:", code);
  return { ok: true, alreadyHad: false, accessCode: code, courseTitle: course.title };
}

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
      redirectUrl: `${baseUrl}/checkout/success?ref=${encodeURIComponent(checkoutReference)}`,
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
    const result = await grantCourseAccess(userId, courseId, checkoutReference);
    if (!result.ok) {
      res.status(404).json({ error: "Student or course not found" });
      return;
    }
    console.log("[SUMUP WEBHOOK] sblocco ok — userId:", userId, "courseId:", courseId, "alreadyHad:", result.alreadyHad);
    res.json({ received: true });
  } catch (err: any) {
    console.error("[SUMUP WEBHOOK] errore:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ── POST /api/sumup/confirm ──────────────────────────────────────────────────
// Conferma DETERMINISTICA al ritorno dal pagamento: il client chiama questo
// endpoint con il reference del checkout; interroghiamo SumUp e, se PAID,
// sblocchiamo il corso subito — senza dipendere dal webhook asincrono.
router.post("/confirm", requireCustomerAuth as any, async (req: AuthRequest, res: Response) => {
  const ref = String(req.body?.ref ?? "");
  const parts = ref.split(":");

  // Il reference è "userId:courseId:nonce" e deve appartenere all'utente loggato
  if (parts.length < 3 || parseInt(parts[0]) !== req.userId) {
    res.status(400).json({ error: "Bad Request", message: "Riferimento pagamento non valido" });
    return;
  }

  const courseId = parseInt(parts[1]);
  if (isNaN(courseId)) {
    res.status(400).json({ error: "Bad Request", message: "Corso non valido" });
    return;
  }

  try {
    const checkouts = await getSumUpCheckoutsByReference(ref);
    const paid = checkouts.find((c) => c.status === "PAID");

    if (!paid) {
      // Pagamento non ancora risultato PAID lato SumUp
      res.json({ status: "pending" });
      return;
    }

    const result = await grantCourseAccess(req.userId!, courseId, ref);
    if (!result.ok) {
      res.status(404).json({ error: "Not Found", message: "Corso o utente non trovato" });
      return;
    }

    res.json({
      status: "completed",
      courseTitle: result.courseTitle,
      accessCode: result.accessCode,
    });
  } catch (err: any) {
    console.error("[SUMUP CONFIRM] errore:", err.message);
    res.status(500).json({ error: "Internal Server Error", message: "Verifica del pagamento fallita" });
  }
});

export default router;
