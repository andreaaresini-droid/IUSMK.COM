import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  accessCodesTable,
  studentsTable,
  deviceSessionsTable,
  studentCourseAccessTable,
  coursePurchasesTable,
} from "@workspace/db/schema";
import { eq, and, isNotNull, sql } from "drizzle-orm";
import { generateToken } from "../lib/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/activate", async (req, res) => {
  const { code, email, name, fingerprint, courseId: rawCourseId } = req.body;

  logger.info({ code, email, name: name?.slice(0, 20), courseId: rawCourseId }, "[UNLOCK] activation requested");

  if (!code || !email || !name) {
    res.status(400).json({ error: "Bad Request", message: "Codice, email e nome sono obbligatori" });
    return;
  }

  // courseId inviato dal frontend — se presente deve coincidere con quello del codice
  const requestedCourseId: number | null = rawCourseId ? parseInt(String(rawCourseId), 10) || null : null;

  const fp = fingerprint ? String(fingerprint).trim() : null;

  try {
    const codeValue = String(code).trim();
    const emailLower = email.toLowerCase().trim();

    // ── 1. Validate code ──────────────────────────────────────────────────────
    const accessCode = await db.query.accessCodesTable.findFirst({
      where: eq(accessCodesTable.code, codeValue),
    });

    if (!accessCode) {
      logger.warn({ code: codeValue }, "[UNLOCK] code not found");
      res.status(400).json({ error: "Codice Non Valido", message: "Questo codice di accesso non esiste. Controllalo e riprova." });
      return;
    }

    logger.info({ codeId: accessCode.id, courseId: accessCode.courseId, requestedCourseId }, "[UNLOCK] code valid");

    // ── 1b. Verifica che il codice appartenga al corso della pagina corrente ──
    // Questo impedisce di usare il codice di un corso su un altro corso.
    if (requestedCourseId !== null && accessCode.courseId !== requestedCourseId) {
      logger.warn(
        { codeId: accessCode.id, codeCourseId: accessCode.courseId, requestedCourseId },
        "[UNLOCK] code belongs to a different course — rejected"
      );
      res.status(400).json({
        error: "Corso Non Corrispondente",
        message: "Questo codice appartiene a un altro corso. Controlla il corso corretto e riprova.",
      });
      return;
    }

    if (!accessCode.isActive) {
      logger.warn({ codeId: accessCode.id }, "[UNLOCK] code revoked");
      res.status(400).json({ error: "Codice Revocato", message: "Questo codice di accesso è stato revocato. Contatta IUSMK." });
      return;
    }

    // ── Expiry check ─────────────────────────────────────────────────────────
    // Usare esplicitamente new Date(expiresAt) per garantire il confronto anche
    // se il valore proviene dal DB come stringa (comportamento dipendente dal driver).
    // Regola: now >= expiresAt → SCADUTO (il confine esatto è bloccante).
    if (accessCode.expiresAt) {
      const expiresAtMs = new Date(accessCode.expiresAt).getTime();
      const nowMs       = Date.now();
      logger.info(
        {
          codeId:       accessCode.id,
          expiresAt:    new Date(expiresAtMs).toISOString(),
          now:          new Date(nowMs).toISOString(),
          diffSeconds:  Math.round((nowMs - expiresAtMs) / 1000),
          isExpired:    nowMs >= expiresAtMs,
        },
        "[UNLOCK] expiry check"
      );
      if (nowMs >= expiresAtMs) {
        logger.warn(
          { codeId: accessCode.id, expiresAt: new Date(expiresAtMs).toISOString(), now: new Date(nowMs).toISOString() },
          "[UNLOCK] BLOCCATO — codice scaduto"
        );
        res.status(400).json({
          error: "Codice Scaduto",
          message: "Questo codice di accesso è scaduto. Contatta IUSMK per assistenza.",
        });
        return;
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    if (accessCode.assignedEmail && accessCode.assignedEmail.toLowerCase() !== emailLower) {
      // Primary check failed: assigned email doesn't match given email.
      // Backwards-compat check: verify if the student using this email has a
      // purchase record that generated this exact code (handles cases where
      // Stripe cached an old email and the code was wrongly assigned to it).
      const studentByEmail = await db.query.studentsTable.findFirst({
        where: eq(studentsTable.email, emailLower),
      });
      let purchaseMatch = false;
      if (studentByEmail) {
        const purchase = await db.query.coursePurchasesTable.findFirst({
          where: and(
            eq(coursePurchasesTable.userId, studentByEmail.id),
            eq(coursePurchasesTable.accessCode, accessCode.code),
          ),
        });
        if (purchase) {
          purchaseMatch = true;
          logger.info(
            { codeId: accessCode.id, studentId: studentByEmail.id, purchaseId: purchase.id },
            "[UNLOCK] email mismatch bypassed — confirmed via purchase record (userId match)"
          );
        }
      }

      if (!purchaseMatch) {
        logger.warn({ codeId: accessCode.id, assignedEmail: accessCode.assignedEmail, givenEmail: emailLower }, "[UNLOCK] email mismatch — no purchase bypass found");
        res.status(400).json({
          error: "Email Non Corrisponde",
          message: "Questo codice è assegnato a un'altra email. Usa l'email con cui hai acquistato il corso.",
        });
        return;
      }
    }

    // ── 2. Device-limit check ─────────────────────────────────────────────────
    if (fp) {
      const existingDevice = await db.query.deviceSessionsTable.findFirst({
        where: and(
          eq(deviceSessionsTable.accessCodeId, accessCode.id),
          eq(deviceSessionsTable.fingerprint, fp),
        ),
      });

      if (!existingDevice) {
        const [{ deviceCount }] = await db
          .select({ deviceCount: sql<number>`count(distinct ${deviceSessionsTable.fingerprint})` })
          .from(deviceSessionsTable)
          .where(
            and(
              eq(deviceSessionsTable.accessCodeId, accessCode.id),
              isNotNull(deviceSessionsTable.fingerprint),
            ),
          );

        if (Number(deviceCount) >= accessCode.maxDevices) {
          logger.warn({ codeId: accessCode.id, deviceCount }, "[UNLOCK] device limit exceeded");
          res.status(403).json({
            error: "Limite Dispositivi",
            message: `Questo accesso è già associato al numero massimo di dispositivi consentiti (${accessCode.maxDevices}). Contatta IUSMK per assistenza.`,
          });
          return;
        }
      }
    }

    // ── 3. Resolve or create student ─────────────────────────────────────────
    let student = await db.query.studentsTable.findFirst({
      where: eq(studentsTable.email, emailLower),
    });

    if (!student) {
      logger.info({ email: emailLower }, "[UNLOCK] creating new student");
      const [newStudent] = await db.insert(studentsTable).values({
        name,
        email: emailLower,
        role: "student",
        activatedCodeId: accessCode.id,
      }).returning();
      student = newStudent;
    } else {
      logger.info({ studentId: student.id, role: student.role }, "[UNLOCK] user found");

      // CRITICAL: if the user was registered as "customer", promote them to "student"
      // so that /auth/me returns the correct role after activation.
      // Without this, the dashboard would redirect them back to /access.
      if (student.role === "customer") {
        logger.info({ studentId: student.id, prevRole: student.role }, "[UNLOCK] upgrading role from customer to student");
        const [updated] = await db.update(studentsTable)
          .set({ role: "student", updatedAt: new Date() })
          .where(eq(studentsTable.id, student.id))
          .returning();
        student = updated;
      }
    }

    // ── 4. Create course access record (idempotent) ──────────────────────────
    const existingAccess = await db.query.studentCourseAccessTable.findFirst({
      where: and(
        eq(studentCourseAccessTable.studentId, student.id),
        eq(studentCourseAccessTable.courseId, accessCode.courseId),
        eq(studentCourseAccessTable.status, "active"),
      ),
    });

    if (!existingAccess) {
      logger.info({ studentId: student.id, courseId: accessCode.courseId }, "[UNLOCK] course assigned to user");
      await db.insert(studentCourseAccessTable).values({
        studentId: student.id,
        courseId: accessCode.courseId,
        accessCodeId: accessCode.id,
        status: "active",
      });
      logger.info(
        { studentId: student.id, courseId: accessCode.courseId, codeId: accessCode.id },
        "[UNLOCK] admin-course-link created — visible in admin > dettagli cliente > tab Corsi",
      );

      await db.update(accessCodesTable)
        .set({ boundUserId: student.id, activatedAt: new Date(), updatedAt: new Date() })
        .where(eq(accessCodesTable.id, accessCode.id));
    } else {
      logger.info({ studentId: student.id, courseId: accessCode.courseId }, "[UNLOCK] course access already active");
    }

    // ── 5. Issue student token ─────────────────────────────────────────────────
    const token = generateToken({ userId: student.id, email: student.email, role: "student" });

    const existingSession = fp ? await db.query.deviceSessionsTable.findFirst({
      where: and(
        eq(deviceSessionsTable.accessCodeId, accessCode.id),
        eq(deviceSessionsTable.fingerprint, fp),
      ),
    }) : null;

    if (!existingSession) {
      await db.insert(deviceSessionsTable).values({
        userId: student.id,
        accessCodeId: accessCode.id,
        sessionToken: token,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] || null,
        fingerprint: fp,
        isActive: true,
        lastSeenAt: new Date(),
      });
    } else {
      await db.update(deviceSessionsTable)
        .set({ sessionToken: token, lastSeenAt: new Date(), isActive: true })
        .where(eq(deviceSessionsTable.id, existingSession.id));
    }

    logger.info({ studentId: student.id, courseId: accessCode.courseId }, "[UNLOCK] course unlocked — redirecting to my-courses");

    res.json({
      success: true,
      alreadyUnlocked: !!existingAccess,
      message: existingAccess
        ? "Questo corso è già attivo nel tuo account! Accesso consentito."
        : "Corso sbloccato con successo! Ora puoi accedere ai tuoi corsi.",
      token,
      courseId: accessCode.courseId,
      // Return the full student object so the frontend can call setQueryData
      // and immediately update the user cache with role="student".
      // This prevents the race condition that caused /dashboard to redirect to /access.
      student: {
        id: student.id,
        name: student.name,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        role: "student",
      },
    });
  } catch (err) {
    logger.error({ err }, "[UNLOCK ERROR] Activate code error");
    res.status(500).json({ error: "Internal Server Error", message: "Attivazione fallita. Riprova." });
  }
});

export default router;
