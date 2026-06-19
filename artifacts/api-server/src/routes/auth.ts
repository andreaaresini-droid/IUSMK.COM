import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { adminsTable, studentsTable, accessCodesTable, deviceSessionsTable, studentCourseAccessTable, passwordResetTokensTable } from "@workspace/db/schema";
import { eq, and, isNotNull, sql, lt } from "drizzle-orm";
import { comparePassword, hashPassword, generateToken, verifyToken, generateSessionToken, simpleHash, generateSecureResetToken, hashResetToken, supabaseAdmin } from "../lib/auth";
import { requireAuth, requireAdmin, AuthRequest } from "../middlewares/authMiddleware";
import { sendEmail, sendPasswordResetEmail } from "../lib/email";
import { notifyAdmin } from "../lib/pushDispatch";

const router: IRouter = Router();

// ─── CUSTOMER REGISTER ─────────────────────────────────────────────────────
router.post("/customer/register", async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  console.log("[REGISTER] tentativo registrazione:", String(email || "").toLowerCase().trim());

  if (!firstName || !lastName || !email || !password) {
    res.status(400).json({ error: "Bad Request", message: "Nome, cognome, email e password sono obbligatori" });
    return;
  }
  if (String(password).length < 6) {
    res.status(400).json({ error: "Bad Request", message: "La password deve essere di almeno 6 caratteri" });
    return;
  }
  try {
    const emailLower = String(email).toLowerCase().trim();
    const existing = await db.query.studentsTable.findFirst({ where: eq(studentsTable.email, emailLower) });
    if (existing) {
      console.log("[REGISTER] email già esistente:", emailLower);
      res.status(409).json({ error: "Conflict", message: "Esiste già un account con questa email" });
      return;
    }
    const passwordHash = await hashPassword(String(password));
    const fullName = `${String(firstName).trim()} ${String(lastName).trim()}`;
    const [student] = await db.insert(studentsTable).values({
      name: fullName,
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email: emailLower,
      passwordHash,
      role: "customer",
    }).returning();

    console.log("[REGISTER] account creato con successo — id:", student.id, "email:", emailLower);

    // Notify admin of new registration
    notifyAdmin({
      title: "Nuovo cliente registrato — IUSMK",
      body: `${fullName} (${emailLower})`,
      url: `/admin/accounts?userId=${student.id}`,
    }).catch(() => {});

    const token = generateToken({ userId: student.id, email: student.email, role: "customer" });
    res.status(201).json({
      token,
      user: {
        id: student.id,
        name: student.name,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        role: "customer",
      },
    });
  } catch (err) {
    req.log.error({ err }, "Customer register error");
    console.error("[REGISTER] errore:", (err as any)?.message);
    res.status(500).json({ error: "Internal Server Error", message: "Registrazione fallita" });
  }
});

// ─── CUSTOMER LOGIN ─────────────────────────────────────────────────────────
router.post("/customer/login", async (req, res) => {
  const { email, password } = req.body;
  const emailAttempt = String(email || "").toLowerCase().trim();
  console.log("[AUTH] login attempt — email:", emailAttempt);

  if (!email || !password) {
    res.status(400).json({ error: "Bad Request", message: "Email e password sono obbligatori" });
    return;
  }
  try {
    const emailLower = String(email).toLowerCase().trim();
    const student = await db.query.studentsTable.findFirst({ where: eq(studentsTable.email, emailLower) });

    if (!student || !student.passwordHash) {
      console.log("[AUTH ERROR] user not found or no password hash — email:", emailLower);
      res.status(401).json({ error: "Unauthorized", message: "Email o password non corretti" });
      return;
    }

    console.log("[AUTH] user found — id:", student.id, "role:", student.role);

    // ── CRITICAL FIX ─────────────────────────────────────────────────────────
    // Non rifiutare gli utenti con role="student": un customer che ha attivato
    // un codice corso viene promosso a "student" ma deve poter continuare a fare
    // login con email + password. Rifiutare solo gli admin (che hanno una tabella
    // separata) e gli account senza passwordHash (codice-only legacy).
    if (student.role === "admin") {
      console.log("[AUTH ERROR] admin account tried customer login — email:", emailLower);
      res.status(401).json({ error: "Unauthorized", message: "Email o password non corretti" });
      return;
    }

    const valid = await comparePassword(String(password), student.passwordHash);
    console.log("[AUTH] password check result:", valid ? "OK" : "FAILED", "— email:", emailLower);

    if (!valid) {
      res.status(401).json({ error: "Unauthorized", message: "Email o password non corretti" });
      return;
    }

    // Track last login (fire-and-forget)
    db.update(studentsTable)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(studentsTable.id, student.id))
      .catch(() => {});

    // Return the actual role from DB so the frontend knows if they're student or customer
    const token = generateToken({ userId: student.id, email: student.email, role: student.role as "customer" | "student" });
    console.log("[AUTH] session created — id:", student.id, "role:", student.role);

    res.json({
      token,
      user: {
        id: student.id,
        name: student.name,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        role: student.role,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Customer login error");
    console.error("[AUTH ERROR] login exception:", (err as any)?.message);
    res.status(500).json({ error: "Internal Server Error", message: "Accesso fallito" });
  }
});

// ─── STUDENT CODE LOGIN ──────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  const { email, code, fingerprint } = req.body;
  if (!email || !code) {
    res.status(400).json({ error: "Bad Request", message: "Email e codice sono obbligatori" });
    return;
  }

  const fp = fingerprint ? String(fingerprint).trim() : null;

  try {
    const emailLower = email.toLowerCase().trim();
    const student = await db.query.studentsTable.findFirst({ where: eq(studentsTable.email, emailLower) });
    if (!student) {
      res.status(401).json({ error: "Unauthorized", message: "Nessun account trovato con questa email. Attiva prima il tuo codice." });
      return;
    }

    const accessCode = await db.query.accessCodesTable.findFirst({
      where: eq(accessCodesTable.code, String(code).trim()),
    });

    if (!accessCode || accessCode.assignedEmail?.toLowerCase() !== emailLower) {
      res.status(401).json({ error: "Unauthorized", message: "Codice non valido o non associato a questa email." });
      return;
    }

    if (!accessCode.isActive) {
      res.status(401).json({ error: "Unauthorized", message: "Questo codice è stato revocato. Contatta IUSMK." });
      return;
    }

    if (accessCode.expiresAt && accessCode.expiresAt < new Date()) {
      res.status(401).json({ error: "Unauthorized", message: "Questo codice è scaduto. Contatta IUSMK." });
      return;
    }

    const courseAccess = await db.query.studentCourseAccessTable.findFirst({
      where: and(
        eq(studentCourseAccessTable.studentId, student.id),
        eq(studentCourseAccessTable.status, "active"),
      ),
    });

    if (!courseAccess) {
      res.status(401).json({ error: "Unauthorized", message: "Nessun corso attivo. Attiva prima il tuo codice di accesso." });
      return;
    }

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
          res.status(403).json({
            error: "Limite Dispositivi",
            message: `Questo accesso è già associato al numero massimo di dispositivi consentiti (${accessCode.maxDevices}). Contatta IUSMK per assistenza.`,
          });
          return;
        }
      }
    }

    const token = generateToken({ userId: student.id, email: student.email, role: "student" });

    if (fp) {
      const existingDeviceForUpdate = await db.query.deviceSessionsTable.findFirst({
        where: and(
          eq(deviceSessionsTable.accessCodeId, accessCode.id),
          eq(deviceSessionsTable.fingerprint, fp),
        ),
      });

      if (existingDeviceForUpdate) {
        await db.update(deviceSessionsTable)
          .set({ sessionToken: token, lastSeenAt: new Date(), isActive: true })
          .where(eq(deviceSessionsTable.id, existingDeviceForUpdate.id));
      } else {
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
      }
    }

    res.json({
      token,
      user: { id: student.id, name: student.name, email: student.email, role: "student" },
    });
  } catch (err) {
    req.log.error({ err }, "Student login error");
    res.status(500).json({ error: "Internal Server Error", message: "Accesso fallito" });
  }
});

router.post("/admin/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "Bad Request", message: "Username and password required" });
    return;
  }

  try {
    const usernameLower = String(username).toLowerCase().trim();
    const admin = await db.query.adminsTable.findFirst({ where: eq(adminsTable.username, usernameLower) });
    if (!admin || !admin.isActive) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
      return;
    }

    const valid = await comparePassword(password, admin.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
      return;
    }

    const token = generateToken({ userId: admin.id, email: admin.email, role: "admin" }, "7d");

    res.json({
      token,
      user: { id: admin.id, name: admin.name, email: admin.email, role: "admin" },
    });
  } catch (err) {
    req.log.error({ err }, "Admin login error");
    res.status(500).json({ error: "Internal Server Error", message: "Login failed" });
  }
});

// ─── CUSTOMER FORGOT PASSWORD ────────────────────────────────────────────────
router.post("/customer/forgot-password", async (req, res) => {
  const { email } = req.body;

  console.log("[RESET_TOKEN_CREATE] richiesta forgot-password ricevuta, email:", email || "(vuota)");

  if (!email) {
    res.status(400).json({ error: "Bad Request", message: "Email obbligatoria" });
    return;
  }

  const NEUTRAL_MSG = "Se l'indirizzo e-mail è registrato, riceverai un link per reimpostare la password.";

  try {
    // Clean up expired tokens
    await db.delete(passwordResetTokensTable).where(lt(passwordResetTokensTable.expiresAt, new Date()));

    const emailLower = String(email).toLowerCase().trim();
    const student = await db.query.studentsTable.findFirst({
      where: eq(studentsTable.email, emailLower),
    });

    if (!student || student.role !== "customer") {
      console.log("[RESET_TOKEN_CREATE] utente non trovato o non è customer:", emailLower);
      res.json({ success: true, message: NEUTRAL_MSG });
      return;
    }

    console.log("[RESET_TOKEN_CREATE] utente trovato, userId:", student.id);

    // Invalidate any existing tokens for this user
    await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.userId, student.id));
    console.log("[RESET_TOKEN_CREATE] token precedenti eliminati per userId:", student.id);

    const rawToken = generateSecureResetToken();       // 64 hex chars (32 random bytes)
    const tokenHash = hashResetToken(rawToken);        // SHA-256 of rawToken
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.insert(passwordResetTokensTable).values({
      userId: student.id,
      tokenHash,
      expiresAt,
    });

    console.log("[RESET_TOKEN_CREATE] token generato (lunghezza):", rawToken.length);
    console.log("[RESET_TOKEN_CREATE] token hash salvato nel DB (primi 12 char):", tokenHash.slice(0, 12) + "...");
    console.log("[RESET_TOKEN_CREATE] scadenza:", expiresAt.toISOString());

    const firstName = student.firstName || student.name?.split(" ")[0] || "Cliente";
    await sendPasswordResetEmail(emailLower, firstName, rawToken);

    res.json({ success: true, message: NEUTRAL_MSG });
  } catch (err) {
    req.log.error({ err }, "Forgot password error");
    console.error("[RESET_TOKEN_CREATE] errore interno:", (err as any)?.message);
    res.status(500).json({ error: "Internal Server Error", message: "Errore interno. Riprova più tardi." });
  }
});

// ─── EMAIL TEST ENDPOINT ──────────────────────────────────────────────────────
router.post("/test-email", async (req, res) => {
  const { to } = req.body;
  if (!to) {
    res.status(400).json({ error: "Bad Request", message: "Campo 'to' obbligatorio" });
    return;
  }

  console.log("[EMAIL_TEST] invio email di prova a:", to);

  const { ok, result, error } = await sendEmail(
    String(to),
    "Test Email — IUSMK Academy",
    `<div style="font-family:Arial,sans-serif;background:#0a0a0a;color:#fff;padding:32px;border-radius:12px;">
      <h2 style="color:#D41414;">IUSMK Academy — Email di test</h2>
      <p>Questa è una email di prova inviata tramite Resend.<br>Se la ricevi, il sistema funziona correttamente.</p>
      <p style="color:#666;font-size:12px;">Data: ${new Date().toISOString()}</p>
    </div>`,
  );

  if (ok) {
    console.log("[EMAIL_TEST] successo:", result);
    res.json({ success: true, message: "Email di prova inviata con successo", result });
  } else {
    console.error("[EMAIL_TEST] errore:", error);
    res.status(500).json({ success: false, message: "Invio fallito", error: String(error) });
  }
});

// ─── VERIFY RESET TOKEN (read-only, never consumes the token) ─────────────────
// Called by the frontend on page load to give early feedback.
// Email scanners / link bots make GET requests — this endpoint is safe because
// it only reads the DB record, never writes or marks usedAt.
router.get("/customer/verify-reset-token", async (req, res) => {
  const token = req.query.token as string | undefined;
  console.log("[RESET_PASSWORD] verify request — token present:", !!token);

  if (!token) {
    res.status(400).json({ valid: false, reason: "missing_token" });
    return;
  }

  try {
    const tokenHash = hashResetToken(String(token).trim());
    const resetRecord = await db.query.passwordResetTokensTable.findFirst({
      where: eq(passwordResetTokensTable.tokenHash, tokenHash),
    });

    if (!resetRecord) {
      console.log("[RESET_PASSWORD] verify — token non trovato nel DB");
      res.json({ valid: false, reason: "not_found" });
      return;
    }
    if (resetRecord.usedAt) {
      console.log("[RESET_PASSWORD] verify — token già usato alle:", resetRecord.usedAt);
      res.json({ valid: false, reason: "already_used" });
      return;
    }
    if (resetRecord.expiresAt < new Date()) {
      console.log("[RESET_PASSWORD] verify — token scaduto alle:", resetRecord.expiresAt);
      res.json({ valid: false, reason: "expired" });
      return;
    }

    console.log("[RESET_PASSWORD] verify — token valido, scade alle:", resetRecord.expiresAt);
    res.json({ valid: true });
  } catch (err) {
    req.log.error({ err }, "Verify reset token error");
    res.status(500).json({ valid: false, reason: "server_error" });
  }
});

// ─── CUSTOMER RESET PASSWORD ──────────────────────────────────────────────────
// Token is ONLY consumed after a successful password update.
// Email bots use GET — this POST endpoint is never pre-fetched.
router.post("/customer/reset-password", async (req, res) => {
  const { token, password } = req.body;

  console.log("[RESET_SUBMIT] submit ricevuto — token presente:", !!token);

  if (!token || !password) {
    res.status(400).json({ error: "Bad Request", message: "Token e password obbligatori" });
    return;
  }
  if (String(password).length < 6) {
    res.status(400).json({ error: "Bad Request", message: "La password deve essere di almeno 6 caratteri" });
    return;
  }

  try {
    // Sanitize: strip any whitespace (including \n from email line-wrapping)
    const cleanToken = String(token).replace(/\s+/g, "");
    const tokenHash = hashResetToken(cleanToken);

    console.log("[RESET_SUBMIT] token ricevuto — lunghezza:", cleanToken.length, "| hash (12):", tokenHash.slice(0, 12) + "...");

    const resetRecord = await db.query.passwordResetTokensTable.findFirst({
      where: eq(passwordResetTokensTable.tokenHash, tokenHash),
    });

    if (!resetRecord) {
      console.log("[RESET_SUBMIT] token match: NO — nessun record con questo hash nel DB");
      res.status(400).json({ error: "Bad Request", message: "Link non valido" });
      return;
    }

    console.log("[RESET_SUBMIT] token match: SÌ — recordId:", resetRecord.id, "userId:", resetRecord.userId);

    if (resetRecord.usedAt) {
      console.log("[RESET_SUBMIT] token già usato — usedAt:", resetRecord.usedAt);
      res.status(400).json({ error: "Bad Request", message: "Questo link è già stato utilizzato. Richiedi un nuovo link." });
      return;
    }

    if (resetRecord.expiresAt < new Date()) {
      console.log("[RESET_SUBMIT] token scaduto — expiresAt:", resetRecord.expiresAt);
      res.status(400).json({ error: "Bad Request", message: "Il link è scaduto. Richiedi un nuovo link." });
      return;
    }

    console.log("[RESET_SUBMIT] token valido — aggiornamento password per userId:", resetRecord.userId);

    const newHash = await hashPassword(String(password));
    await db.update(studentsTable)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(studentsTable.id, resetRecord.userId));

    console.log("[RESET_SUBMIT] password aggiornata: SÌ");

    // Mark token as used ONLY after successful password update — never before
    await db.update(passwordResetTokensTable)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokensTable.id, resetRecord.id));

    console.log("[RESET_SUBMIT] token invalidato dopo successo: SÌ");

    res.json({ success: true, message: "La password è stata aggiornata correttamente. Ora puoi accedere." });
  } catch (err) {
    req.log.error({ err }, "Reset password error");
    console.error("[RESET_SUBMIT] errore interno:", (err as any)?.message);
    res.status(500).json({ error: "Internal Server Error", message: "Errore interno. Riprova più tardi." });
  }
});

router.post("/logout", async (req: AuthRequest, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (token) {
    try {
      await db.update(deviceSessionsTable)
        .set({ isActive: false })
        .where(eq(deviceSessionsTable.sessionToken, token));
    } catch {}
  }
  console.log("[LOGOUT] sessione terminata");
  res.json({ success: true, message: "Logged out" });
});

router.get("/me", async (req: AuthRequest, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Unauthorized", message: "Not authenticated" });
    return;
  }

  const studentPayload = verifyToken(token, "student");
  if (studentPayload) {
    try {
      const student = await db.query.studentsTable.findFirst({ where: eq(studentsTable.id, studentPayload.userId) });
      if (!student) {
        console.log("[SESSION ERROR] user not found — id:", studentPayload.userId);
        res.status(401).json({ error: "Unauthorized", message: "User not found" });
        return;
      }
      // Always return the fresh role from DB (not from token — role may have changed)
      const freshRole = student.role || studentPayload.role || "student";
      console.log("[SESSION] current authenticated user — id:", student.id, "email:", student.email, "role:", freshRole);
      res.json({
        id: student.id,
        name: student.name,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        role: freshRole,
      });
      return;
    } catch (err) {
      req.log.error({ err }, "Get me student error");
      console.error("[SESSION ERROR] /me lookup failed:", (err as any)?.message);
    }
  }

  const adminPayload = verifyToken(token, "admin");
  if (adminPayload) {
    try {
      const admin = await db.query.adminsTable.findFirst({ where: eq(adminsTable.id, adminPayload.userId) });
      if (!admin) { res.status(401).json({ error: "Unauthorized", message: "Admin not found" }); return; }
      res.json({ id: admin.id, name: admin.name, email: admin.email, role: "admin" });
      return;
    } catch (err) {
      req.log.error({ err }, "Get me admin error");
    }
  }

  // Prova token Supabase Auth
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (!error && user?.email) {
      const student = await db.query.studentsTable.findFirst({
        where: eq(studentsTable.email, user.email.toLowerCase()),
      });
      if (student) {
        res.json({
          id: student.id,
          name: student.name,
          firstName: student.firstName,
          lastName: student.lastName,
          email: student.email,
          role: student.role,
        });
        return;
      }
    }
  } catch {}

  console.log("[SESSION ERROR] invalid or expired token");
  res.status(401).json({ error: "Unauthorized", message: "Invalid token" });
});

// ─── SUPABASE AUTH SYNC ──────────────────────────────────────────────────────
// Chiamato dopo supabase.auth.signUp() per creare il profilo nel DB locale
router.post("/sync", async (req, res) => {
  const { email, firstName, lastName, supabaseUserId } = req.body;

  if (!email || !firstName || !lastName) {
    res.status(400).json({ error: "Bad Request", message: "email, firstName e lastName obbligatori" });
    return;
  }

  try {
    const emailLower = String(email).toLowerCase().trim();
    const existing = await db.query.studentsTable.findFirst({
      where: eq(studentsTable.email, emailLower),
    });

    if (existing) {
      res.json({ id: existing.id, name: existing.name, email: existing.email, role: existing.role });
      return;
    }

    const fullName = `${String(firstName).trim()} ${String(lastName).trim()}`;
    const [student] = await db.insert(studentsTable).values({
      name: fullName,
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email: emailLower,
      passwordHash: supabaseUserId || "supabase-managed",
      role: "customer",
    }).returning();

    notifyAdmin({
      title: "Nuovo cliente registrato — IUSMK",
      body: `${fullName} (${emailLower})`,
      url: `/admin/accounts?userId=${student.id}`,
    }).catch(() => {});

    res.status(201).json({ id: student.id, name: student.name, email: student.email, role: student.role });
  } catch (err) {
    console.error("[AUTH SYNC] error:", (err as any)?.message);
    res.status(500).json({ error: "Internal Server Error", message: "Sincronizzazione account fallita" });
  }
});

export default router;
