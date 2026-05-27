import app from "./app";
import { logger } from "./lib/logger";
import { initializeDatabase } from "./lib/init";
import { autoSeedKB } from "./lib/kb-seed";

// ─── Global safety net: prevent server crash on unhandled rejections ──────────
process.on("unhandledRejection", (reason: any) => {
  console.error("[PROCESS] unhandledRejection — server kept alive");
  console.error("[PROCESS] reason:", reason?.message || reason);
  console.error("[PROCESS] stack:", reason?.stack || "(no stack)");
});

process.on("uncaughtException", (err: any) => {
  console.error("[PROCESS] uncaughtException — server kept alive");
  console.error("[PROCESS] message:", err?.message || err);
  console.error("[PROCESS] stack:", err?.stack || "(no stack)");
});

// ─── Boot diagnostics: log SMTP config at startup ────────────────────────────
const smtpHost = process.env.SMTP_HOST;
const smtpUser = process.env.SMTP_USER;
const smtpFrom = process.env.SMTP_FROM;
const smtpPass = !!process.env.SMTP_PASS;
console.log("[EMAIL_BOOT] SMTP_HOST loaded:", smtpHost ?? "(NOT SET)");
console.log("[EMAIL_BOOT] SMTP_PORT loaded:", process.env.SMTP_PORT ?? "(NOT SET — default 587)");
console.log("[EMAIL_BOOT] SMTP_USER loaded:", smtpUser ?? "(NOT SET)");
console.log("[EMAIL_BOOT] SMTP_FROM loaded:", smtpFrom ?? "(NOT SET)");
console.log("[EMAIL_BOOT] SMTP_PASS present:", smtpPass);
if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
  console.warn("[EMAIL_BOOT] WARNING: SMTP config incompleta — l'invio email non funzionerà");
  console.warn("[EMAIL_BOOT] Secrets richiesti: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM");
}

// APP_URL boot diagnostic — critical for reset password email links
if (process.env.APP_URL) {
  console.log("[EMAIL_BOOT] APP_URL impostato:", process.env.APP_URL);
} else {
  console.error("[RESET_LINK_ERROR] APP_URL NON IMPOSTATO — le email di reset non verranno inviate");
  console.error("[RESET_LINK_ERROR] Imposta il Secret: APP_URL = https://iusmk.com (o il tuo dominio pubblico)");
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

initializeDatabase()
  .then(() => autoSeedKB())
  .then(() => {
    app.listen(port, () => {
      logger.info({ port }, "Server listening");
    });
  });
