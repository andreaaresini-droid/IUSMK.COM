import { db } from "@workspace/db";
import {
  studentsTable, coursesTable, accessCodesTable,
  studentCourseAccessTable, notificationsTable, coursePurchasesTable,
} from "@workspace/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { generateAccessCode } from "./auth.js";
import { notifyUser } from "./pushDispatch.js";
import { getSumUpCheckoutsByReference } from "./sumupClient.js";
import { logger } from "./logger.js";

// ─────────────────────────────────────────────────────────────────────────────
// Sblocco corso dopo pagamento — logica CONDIVISA tra webhook, conferma-al-ritorno
// e riconciliazione. Idempotente: se l'utente ha già accesso attivo, non duplica.
// Ritorna il codice di accesso (nuovo o già esistente) per mostrarlo all'utente.
// ─────────────────────────────────────────────────────────────────────────────
export async function grantCourseAccess(
  userId: number,
  courseId: number,
  paymentRef: string,
): Promise<{ ok: boolean; alreadyHad: boolean; accessCode: string | null; courseTitle: string }> {
  const [student, course] = await Promise.all([
    db.query.studentsTable.findFirst({ where: eq(studentsTable.id, userId) }),
    db.query.coursesTable.findFirst({ where: eq(coursesTable.id, courseId) }),
  ]);

  if (!student || !course) {
    logger.error({ userId, courseId }, "[SUMUP ACCESS] studente o corso non trovato");
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

  logger.info({ userId, courseId, code }, "[SUMUP ACCESS] corso sbloccato");
  return { ok: true, alreadyHad: false, accessCode: code, courseTitle: course.title };
}

// ─────────────────────────────────────────────────────────────────────────────
// Riconciliazione dei pagamenti "pending": per ogni acquisto SumUp non ancora
// confermato dell'utente, interroga SumUp e — se PAID — sblocca il corso.
// È il meccanismo che garantisce lo sblocco anche se SumUp NON reindirizza
// l'utente al sito e il webhook non arriva: viene richiamato quando l'utente
// apre "I miei corsi".
// ─────────────────────────────────────────────────────────────────────────────
export async function reconcilePendingPurchases(userId: number): Promise<void> {
  let pendings: Array<typeof coursePurchasesTable.$inferSelect>;
  try {
    pendings = await db.query.coursePurchasesTable.findMany({
      where: and(
        eq(coursePurchasesTable.userId, userId),
        eq(coursePurchasesTable.status, "pending"),
        isNotNull(coursePurchasesTable.stripeSessionId),
      ),
    });
  } catch (e: any) {
    logger.error({ userId, err: e?.message }, "[SUMUP RECONCILE] errore lettura pending");
    return;
  }

  logger.info({ userId, pendingCount: pendings.length }, "[SUMUP RECONCILE] verifica pagamenti pending");
  if (!pendings.length) return;

  for (const p of pendings) {
    const ref = p.stripeSessionId;
    // Solo i reference SumUp creati da noi ("userId:courseId:nonce").
    // Esclude eventuali vecchi session id Stripe.
    if (!ref || !ref.startsWith(`${userId}:`)) continue;

    try {
      const checkouts = await getSumUpCheckoutsByReference(ref);
      const statuses = checkouts.map((c) => c.status);
      logger.info({ userId, courseId: p.courseId, ref, statuses }, "[SUMUP RECONCILE] stato checkout da SumUp");
      if (!checkouts.length) continue;

      const paid = checkouts.find((c) => c.status === "PAID");
      if (paid) {
        const r = await grantCourseAccess(userId, p.courseId, ref);
        await db.update(coursePurchasesTable)
          .set({ status: "completed", accessCode: r.accessCode, updatedAt: new Date() })
          .where(eq(coursePurchasesTable.id, p.id));
        logger.info({ userId, courseId: p.courseId }, "[SUMUP RECONCILE] sbloccato pending");
      } else if (checkouts.every((c) => c.status === "FAILED" || c.status === "EXPIRED")) {
        await db.update(coursePurchasesTable)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(coursePurchasesTable.id, p.id));
      }
    } catch (err: any) {
      logger.error({ userId, ref, err: err?.message }, "[SUMUP RECONCILE] errore verifica checkout");
    }
  }
}
