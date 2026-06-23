import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import {
  studentsTable, coursesTable, studentCourseAccessTable, coursePurchasesTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { requireCustomerAuth, AuthRequest } from "../middlewares/authMiddleware.js";
import { createSumUpCheckout, verifySumUpWebhookSignature, getSumUpCheckoutsByReference } from "../lib/sumupClient.js";
import { grantCourseAccess } from "../lib/sumupAccess.js";
import { logger } from "../lib/logger.js";

const router = Router();

// ── POST /api/sumup/checkout ─────────────────────────────────────────────────
router.post("/checkout", requireCustomerAuth as any, async (req: AuthRequest, res: Response) => {
  const { courseId } = req.body;

  if (!courseId) {
    res.status(400).json({ error: "Bad Request", message: "courseId obbligatorio" });
    return;
  }

  try {
    const [course, student] = await Promise.all([
      db.query.coursesTable.findFirst({ where: eq(coursesTable.id, Number(courseId)) }),
      db.query.studentsTable.findFirst({ where: eq(studentsTable.id, req.userId!) }),
    ]);

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

    // Registra l'acquisto come "pending": serve a riconciliarlo lato server
    // (sblocco corso) anche se SumUp non reindirizza l'utente e il webhook non arriva.
    try {
      await db.insert(coursePurchasesTable).values({
        courseId: Number(courseId),
        userId: req.userId!,
        customerName: student?.name ?? "Cliente",
        customerEmail: student?.email ?? req.userEmail ?? "",
        amountPaid: course.price,
        currency: "eur",
        status: "pending",
        stripeSessionId: checkoutReference, // riusa il campo unique per il ref SumUp
      });
    } catch (e: any) {
      logger.error({ ref: checkoutReference, err: e?.message }, "[SUMUP] impossibile registrare pending purchase");
    }

    logger.info(
      { userId: req.userId, courseId, ref: checkoutReference, checkoutId: checkout.id, hostedUrl: checkout.hosted_checkout_url },
      "[SUMUP] checkout creato",
    );
    res.json({ sessionUrl: checkout.hosted_checkout_url });
  } catch (err: any) {
    logger.error({ err: err?.message }, "[SUMUP] checkout creation error");
    res.status(500).json({ error: "Internal Server Error", message: "Impossibile creare il pagamento" });
  }
});

// ── POST /api/sumup/webhook ──────────────────────────────────────────────────
// rawBody disponibile perché app.ts monta express.raw() per questa route prima di json()
router.post("/webhook", async (req: Request, res: Response) => {
  const signature = req.headers["x-webhook-signature"] as string | undefined;

  logger.info({ hasSignature: !!signature }, "[SUMUP WEBHOOK] ricevuto");

  if (!signature || !verifySumUpWebhookSignature(req.body as Buffer, signature)) {
    logger.warn("[SUMUP WEBHOOK] firma non valida");
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

  logger.info({ eventType: event.event_type, status: event.payload?.status }, "[SUMUP WEBHOOK] evento");

  // Processa solo pagamenti completati
  if (event.event_type !== "CHECKOUT_STATUS_CHANGED" || event.payload?.status !== "PAID") {
    res.json({ received: true });
    return;
  }

  const checkoutReference: string = event.payload?.checkout_reference ?? "";
  const parts = checkoutReference.split(":");

  if (parts.length < 3) {
    logger.error({ checkoutReference }, "[SUMUP WEBHOOK] checkout_reference malformato");
    res.status(400).json({ error: "Invalid checkout_reference" });
    return;
  }

  const userId = parseInt(parts[0]);
  const courseId = parseInt(parts[1]);

  if (isNaN(userId) || isNaN(courseId)) {
    logger.error({ parts }, "[SUMUP WEBHOOK] userId o courseId non numerici");
    res.status(400).json({ error: "Invalid reference parts" });
    return;
  }

  try {
    const result = await grantCourseAccess(userId, courseId, checkoutReference);
    if (!result.ok) {
      res.status(404).json({ error: "Student or course not found" });
      return;
    }
    // Segna l'eventuale pending come completato
    await db.update(coursePurchasesTable)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(coursePurchasesTable.stripeSessionId, checkoutReference))
      .catch(() => {});
    logger.info({ userId, courseId, alreadyHad: result.alreadyHad }, "[SUMUP WEBHOOK] sblocco ok");
    res.json({ received: true });
  } catch (err: any) {
    logger.error({ err: err?.message }, "[SUMUP WEBHOOK] errore");
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

    await db.update(coursePurchasesTable)
      .set({ status: "completed", accessCode: result.accessCode, updatedAt: new Date() })
      .where(eq(coursePurchasesTable.stripeSessionId, ref))
      .catch(() => {});

    res.json({
      status: "completed",
      courseTitle: result.courseTitle,
      accessCode: result.accessCode,
    });
  } catch (err: any) {
    logger.error({ err: err?.message }, "[SUMUP CONFIRM] errore");
    res.status(500).json({ error: "Internal Server Error", message: "Verifica del pagamento fallita" });
  }
});

export default router;
