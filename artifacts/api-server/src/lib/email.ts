import { Resend } from "resend";

// ─── Resend (transactional email for Vercel serverless) ───────────────────────
// Required env vars:
//   RESEND_API_KEY  — from resend.com dashboard
//   RESEND_FROM     — verified sender, e.g. "IUSMK Academy <noreply@iusmk.com>"
//   APP_URL         — public frontend URL, e.g. https://iusmk.vercel.app

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<{ ok: boolean; result?: any; error?: any }> {
  const resend = getResendClient();
  const from = process.env.RESEND_FROM || "IUSMK Academy <noreply@iusmk.com>";

  console.log("[EMAIL_DEBUG] sendEmail called — to:", to, "subject:", subject);
  console.log("[EMAIL_DEBUG] from:", from);
  console.log("[EMAIL_DEBUG] RESEND_API_KEY presente:", !!process.env.RESEND_API_KEY);

  if (!resend) {
    console.error("[EMAIL_FAIL] RESEND_API_KEY mancante — imposta la variabile in Vercel");
    return { ok: false, error: "missing_resend_api_key" };
  }

  try {
    const { data, error } = await resend.emails.send({ from, to, subject, html });
    if (error) {
      console.error("[EMAIL_FAIL] Resend error:", error);
      return { ok: false, error };
    }
    console.log("[EMAIL_OK] email inviata — id:", data?.id);
    return { ok: true, result: data };
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error("[EMAIL_FAIL] eccezione:", msg);
    return { ok: false, error: msg };
  }
}

// ─── Purchase confirmation email ─────────────────────────────────────────────

export async function sendPurchaseConfirmationEmail(opts: {
  toEmail: string;
  customerName: string;
  courseTitle: string;
  amountPaid: number;
  purchaseDate: Date;
  accessCode: string;
}): Promise<{ ok: boolean; error?: any }> {
  const { toEmail, customerName, courseTitle, amountPaid, purchaseDate, accessCode } = opts;

  const appUrl = (process.env.APP_URL || "https://iusmk.com").replace(/\/+$/, "");

  const dateFormatted = purchaseDate.toLocaleDateString("it-IT", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome",
  });

  const amountFormatted = `€${amountPaid.toFixed(2)}`;

  const subject = "Conferma acquisto corso — IUSMK Academy";

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body{margin:0;padding:0;background:#0a0a0a;font-family:Arial,Helvetica,sans-serif;}
    .wrap{max-width:580px;margin:40px auto;padding:0 20px;}
    .card{background:#141414;border:1px solid #222;border-radius:12px;padding:40px 36px;}
    .logo{font-size:24px;font-weight:900;letter-spacing:5px;color:#D41414;text-transform:uppercase;margin-bottom:32px;}
    h1{color:#fff;font-size:22px;font-weight:700;margin:0 0 12px;}
    p{color:#aaa;font-size:15px;line-height:1.7;margin:0 0 16px;}
    .highlight{color:#fff;}
    .divider{border:none;border-top:1px solid #222;margin:28px 0;}
    .recap{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:20px 24px;margin:24px 0;}
    .recap-row{display:flex;justify-content:space-between;align-items:baseline;padding:7px 0;border-bottom:1px solid #222;}
    .recap-row:last-child{border-bottom:none;}
    .recap-label{color:#666;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;}
    .recap-value{color:#fff;font-size:15px;font-weight:600;text-align:right;}
    .code-box{background:#1e0a0a;border:2px solid #D41414;border-radius:10px;padding:20px 24px;margin:24px 0;text-align:center;}
    .code-label{color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;}
    .code-value{font-family:monospace;font-size:32px;font-weight:900;letter-spacing:6px;color:#D41414;}
    .cta{display:inline-block;background:#D41414;color:#fff!important;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;margin:8px 0 4px;}
    .info-list{padding-left:20px;margin:8px 0 0;}
    .info-list li{color:#888;font-size:14px;line-height:1.8;}
    .info-list li strong{color:#bbb;}
    .footer{margin-top:32px;padding-top:24px;border-top:1px solid #1e1e1e;color:#444;font-size:12px;text-align:center;line-height:1.6;}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">

      <div class="logo">IUSMK</div>

      <h1>Pagamento confermato ✓</h1>
      <p>Ciao <span class="highlight">${customerName}</span>,</p>
      <p>il tuo acquisto è stato completato con successo. Di seguito trovi il riepilogo del tuo ordine e il codice per accedere al corso.</p>

      <hr class="divider">

      <div class="recap">
        <div class="recap-row">
          <span class="recap-label">Corso</span>
          <span class="recap-value">${courseTitle}</span>
        </div>
        <div class="recap-row">
          <span class="recap-label">Importo pagato</span>
          <span class="recap-value">${amountFormatted}</span>
        </div>
        <div class="recap-row">
          <span class="recap-label">Data acquisto</span>
          <span class="recap-value">${dateFormatted}</span>
        </div>
        <div class="recap-row">
          <span class="recap-label">Stato pagamento</span>
          <span class="recap-value" style="color:#22c55e;">Completato</span>
        </div>
      </div>

      <div class="code-box">
        <div class="code-label">Il tuo codice di accesso</div>
        <div class="code-value">${accessCode}</div>
      </div>

      <p style="margin-bottom:8px;"><span class="highlight">Come accedere al corso:</span></p>
      <ol class="info-list">
        <li>Accedi al sito <strong>iusmk.com</strong> con il tuo account</li>
        <li>Vai nella sezione <strong>"I miei corsi"</strong> oppure <strong>"Notifiche"</strong></li>
        <li>Trovi già il corso disponibile nel tuo profilo</li>
        <li>In alternativa, usa il codice sopra nella sezione <strong>"Accedi al corso"</strong></li>
      </ol>

      <hr class="divider">

      <p style="text-align:center;margin-bottom:20px;">Puoi accedere subito al tuo corso da qui:</p>
      <div style="text-align:center;">
        <a href="${appUrl}/my-courses" class="cta">Vai ai miei corsi</a>
      </div>

      <div class="footer">
        Hai ricevuto questa email perché hai effettuato un acquisto su IUSMK Academy.<br>
        Per assistenza contattaci attraverso il sito: <a href="${appUrl}/contatto" style="color:#D41414;">${appUrl}/contatto</a>
      </div>

    </div>
  </div>
</body>
</html>`;

  console.log("[EMAIL] preparing customer confirmation");
  console.log("[EMAIL] recipient resolved:", toEmail);
  console.log("[EMAIL] course:", courseTitle, "| amount:", amountFormatted, "| code:", accessCode);

  const result = await sendEmail(toEmail, subject, html);

  if (result.ok) {
    console.log("[EMAIL] sent successfully →", toEmail);
  } else {
    console.error("[EMAIL ERROR] send failed — recipient:", toEmail, "| error:", result.error);
    console.error("[EMAIL ERROR] reason: SMTP not configured or credentials wrong. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM in Replit Secrets");
  }
  return result;
}

// ─── Password reset email ─────────────────────────────────────────────────────

export async function sendPasswordResetEmail(
  toEmail: string,
  firstName: string,
  resetToken: string,
): Promise<void> {
  const appUrl = process.env.APP_URL;

  if (!appUrl) {
    console.error("[RESET_LINK_ERROR] APP_URL mancante — email di reset NON inviata a:", toEmail);
    return;
  }

  // Normalize: strip trailing slash, add https:// if protocol is missing
  let baseUrl = appUrl.replace(/\/+$/, "");
  if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
    baseUrl = `https://${baseUrl}`;
    console.warn("[RESET_LINK_WARN] APP_URL non aveva protocollo, aggiunto https:// automaticamente:", baseUrl);
  }
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

  console.log("[RESET_LINK] APP_URL usato:", baseUrl);
  console.log("[RESET_LINK] final URL:", resetUrl);
  console.log("[FORGOT_PASSWORD] tentativo invio email Gmail SMTP a:", toEmail);

  const subject = "Recupero Password IUSMK";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body{margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;}
    .w{max-width:560px;margin:40px auto;padding:0 20px;}
    .c{background:#141414;border:1px solid #222;border-radius:12px;padding:40px 36px;}
    .logo{font-size:26px;font-weight:900;letter-spacing:4px;color:#D41414;text-transform:uppercase;margin-bottom:32px;}
    h1{color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;}
    p{color:#888;font-size:15px;line-height:1.6;margin:0 0 20px;}
    .btn{display:inline-block;background:#D41414;color:#fff!important;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;margin:8px 0 24px;}
    .note{color:#555;font-size:13px;margin-top:24px;padding-top:20px;border-top:1px solid #222;}
    .url{word-break:break-all;color:#D41414;font-size:12px;margin-top:8px;}
  </style>
</head>
<body>
  <div class="w"><div class="c">
    <div class="logo">IUSMK</div>
    <h1>Recupero Password</h1>
    <p>Ciao ${firstName},</p>
    <p>hai richiesto il reset della password del tuo account IUSMK Academy.<br>Clicca qui per reimpostarla:</p>
    <a href="${resetUrl}" class="btn">Reimposta Password</a>
    <p>Il link è valido per <strong>1 ora</strong>.</p>
    <div class="note">
      Se non sei stato tu, ignora questa email. Il tuo account è al sicuro.
      <div class="url">${resetUrl}</div>
    </div>
  </div></div>
</body>
</html>`;

  try {
    const { ok, error } = await sendEmail(toEmail, subject, html);
    if (ok) {
      console.log("[FORGOT_PASSWORD] email inviata con successo a:", toEmail);
    } else {
      console.error("[FORGOT_PASSWORD] invio fallito:", error);
      console.log("[FORGOT_PASSWORD] reset link (fallback log):", resetUrl);
    }
  } catch (err: any) {
    console.error("[FORGOT_PASSWORD] eccezione non gestita:", err?.message || err);
    console.log("[FORGOT_PASSWORD] reset link (emergency fallback):", resetUrl);
  }
}
