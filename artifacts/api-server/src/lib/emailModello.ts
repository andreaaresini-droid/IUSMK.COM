// ─── Modello unico delle email IUSMK ──────────────────────────────────────────
// Tutte le email che partono dal sito passano da qui: stesso logo, stessi colori
// (nero + giallo #FFD600 con testo NERO sul giallo), stesso piè di pagina.
// HTML a tabelle con stili in linea (Gmail e Outlook ignorano i CSS esterni),
// larghezza massima 600px, testo di anteprima e sempre anche la versione testo.

export const EMAIL_COLORI = {
  sfondo: "#0A0A0A",
  scheda: "#141414",
  bordo: "#262626",
  giallo: "#FFD600",
  testoSulGiallo: "#0A0A0A",
  testo: "#FFFFFF",
  testoTenue: "#B3B3B3",
  testoPiede: "#8C8C8C",
} as const;

const FONT =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const FONT_TITOLI =
  "'Space Grotesk', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const IUSMK_EMAIL_CONTATTO = "iusmkbarber@gmail.com";

/** Indirizzo pubblico del sito, senza barra finale e sempre con https:// */
export function urlSito(): string {
  let base = (process.env.APP_URL || "https://www.iusmk.com").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//.test(base)) base = `https://${base}`;
  return base;
}

/** Evita che nome, titoli o messaggi scritti dagli utenti diventino HTML */
export function escapeHtml(valore: unknown): string {
  return String(valore ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface RigaRiepilogo {
  etichetta: string;
  valore: string;
}

export interface OpzioniEmail {
  /** Testo che i programmi di posta mostrano accanto all'oggetto */
  anteprima: string;
  titolo: string;
  /** Es. «Ciao Mario,» — già in testo semplice, viene protetto qui */
  saluto?: string;
  /** Paragrafi in testo semplice (vengono protetti) */
  paragrafi: string[];
  riepilogo?: RigaRiepilogo[];
  /** Un codice da mettere in evidenza (es. codice di accesso al corso) */
  codice?: { etichetta: string; valore: string };
  pulsante?: { testo: string; url: string };
  /** Righe in piccolo sotto il pulsante (testo semplice) */
  note?: string[];
  /** Perché la persona riceve questa email (piè di pagina) */
  motivo: string;
  /** Solo per email di marketing: link di disiscrizione */
  disiscrizioneUrl?: string;
}

export interface EmailComposta {
  html: string;
  text: string;
}

export function componiEmail(o: OpzioniEmail): EmailComposta {
  const c = EMAIL_COLORI;
  const sito = urlSito();
  const logo = `${sito}/images/logo-email.png`;
  const privacy = `${sito}/privacy`;
  const contatti = `${sito}/contact`;
  const anno = new Date().getFullYear();

  const paragrafiHtml = o.paragrafi
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:24px;color:${c.testoTenue};">${escapeHtml(p)}</p>`,
    )
    .join("");

  const salutoHtml = o.saluto
    ? `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:24px;color:${c.testo};font-weight:600;">${escapeHtml(o.saluto)}</p>`
    : "";

  const riepilogoHtml = o.riepilogo?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;border:1px solid ${c.bordo};border-radius:8px;border-collapse:separate;background:${c.sfondo};">
${o.riepilogo
  .map(
    (r, i) => `<tr>
  <td style="padding:12px 16px;${i ? `border-top:1px solid ${c.bordo};` : ""}font-family:${FONT};font-size:12px;line-height:18px;color:${c.testoPiede};text-transform:uppercase;letter-spacing:1px;width:40%;vertical-align:top;">${escapeHtml(r.etichetta)}</td>
  <td style="padding:12px 16px;${i ? `border-top:1px solid ${c.bordo};` : ""}font-family:${FONT};font-size:15px;line-height:22px;color:${c.testo};font-weight:600;text-align:right;vertical-align:top;word-break:break-word;">${escapeHtml(r.valore)}</td>
</tr>`,
  )
  .join("\n")}
</table>`
    : "";

  const codiceHtml = o.codice
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
<tr><td align="center" style="padding:20px 16px;background:${c.giallo};border-radius:8px;">
  <div style="font-family:${FONT};font-size:12px;line-height:18px;color:${c.testoSulGiallo};text-transform:uppercase;letter-spacing:2px;font-weight:600;">${escapeHtml(o.codice.etichetta)}</div>
  <div style="font-family:'Courier New',Courier,monospace;font-size:30px;line-height:40px;color:${c.testoSulGiallo};font-weight:700;letter-spacing:6px;margin-top:6px;">${escapeHtml(o.codice.valore)}</div>
</td></tr>
</table>`
    : "";

  const pulsanteHtml = o.pulsante
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:8px auto 24px;">
<tr><td align="center" bgcolor="${c.giallo}" style="border-radius:8px;background:${c.giallo};">
  <a href="${escapeHtml(o.pulsante.url)}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:${FONT_TITOLI};font-size:15px;line-height:20px;font-weight:700;color:${c.testoSulGiallo};text-decoration:none;text-transform:uppercase;letter-spacing:1px;border-radius:8px;">${escapeHtml(o.pulsante.testo)}</a>
</td></tr>
</table>`
    : "";

  const noteHtml = o.note?.length
    ? `<div style="margin-top:8px;padding-top:16px;border-top:1px solid ${c.bordo};">${o.note
        .map(
          (n) =>
            `<p style="margin:0 0 8px;font-family:${FONT};font-size:13px;line-height:20px;color:${c.testoPiede};word-break:break-word;">${escapeHtml(n)}</p>`,
        )
        .join("")}</div>`
    : "";

  const disiscrizioneHtml = o.disiscrizioneUrl
    ? `<br><a href="${escapeHtml(o.disiscrizioneUrl)}" style="color:${c.testoTenue};text-decoration:underline;">Non voglio più ricevere queste email</a>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="it" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${escapeHtml(o.titolo)}</title>
</head>
<body style="margin:0;padding:0;background:${c.sfondo};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${c.sfondo};">${escapeHtml(o.anteprima)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${c.sfondo}" style="background:${c.sfondo};">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
    <tr><td align="center" style="padding:8px 0 20px;">
      <a href="${sito}" target="_blank" style="text-decoration:none;"><img src="${logo}" width="180" height="81" alt="IUSMK" style="display:block;border:0;outline:none;width:180px;height:auto;max-width:180px;"></a>
    </td></tr>
    <tr><td style="height:4px;line-height:4px;font-size:0;background:${c.giallo};border-radius:4px 4px 0 0;">&nbsp;</td></tr>
    <tr><td style="background:${c.scheda};border:1px solid ${c.bordo};border-top:0;border-radius:0 0 12px 12px;padding:32px 28px;">
      <h1 style="margin:0 0 20px;font-family:${FONT_TITOLI};font-size:24px;line-height:32px;font-weight:700;color:${c.testo};text-transform:uppercase;letter-spacing:1px;">${escapeHtml(o.titolo)}</h1>
      ${salutoHtml}
      ${paragrafiHtml}
      ${codiceHtml}
      ${riepilogoHtml}
      ${pulsanteHtml}
      ${noteHtml}
    </td></tr>
    <tr><td align="center" style="padding:24px 12px 8px;font-family:${FONT};font-size:12px;line-height:19px;color:${c.testoPiede};">
      <strong style="color:${c.testoTenue};">IUSMK — Giuseppe Musto</strong> · Barber Artist &amp; Academy<br>
      <a href="mailto:${IUSMK_EMAIL_CONTATTO}" style="color:${c.giallo};text-decoration:none;">${IUSMK_EMAIL_CONTATTO}</a> ·
      <a href="${sito}" style="color:${c.giallo};text-decoration:none;">${escapeHtml(sito.replace(/^https?:\/\//, ""))}</a><br>
      <a href="${contatti}" style="color:${c.testoTenue};text-decoration:underline;">Contatti</a> ·
      <a href="${privacy}" style="color:${c.testoTenue};text-decoration:underline;">Privacy</a><br>
      <span style="color:${c.testoPiede};">${escapeHtml(o.motivo)}</span>${disiscrizioneHtml}<br>
      &copy; ${anno} IUSMK
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  // ── Versione in testo semplice ──
  const righe: string[] = ["IUSMK", "", o.titolo.toUpperCase(), ""];
  if (o.saluto) righe.push(o.saluto, "");
  for (const p of o.paragrafi) righe.push(p, "");
  if (o.codice) righe.push(`${o.codice.etichetta}: ${o.codice.valore}`, "");
  if (o.riepilogo?.length) {
    for (const r of o.riepilogo) righe.push(`${r.etichetta}: ${r.valore}`);
    righe.push("");
  }
  if (o.pulsante) righe.push(`${o.pulsante.testo}: ${o.pulsante.url}`, "");
  if (o.note?.length) righe.push(...o.note, "");
  righe.push(
    "—",
    "IUSMK — Giuseppe Musto · Barber Artist & Academy",
    `${IUSMK_EMAIL_CONTATTO} · ${sito}`,
    `Privacy: ${privacy}`,
    o.motivo,
  );
  if (o.disiscrizioneUrl) righe.push(`Per non ricevere più queste email: ${o.disiscrizioneUrl}`);

  return { html, text: righe.join("\n") };
}
