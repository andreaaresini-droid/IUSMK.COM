import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { contactRequestsTable, notificationsTable } from "@workspace/db/schema";
import { notifyAdmin } from "../lib/pushDispatch";

const SUBJECT_LABELS: Record<string, string> = {
  booking: "Prenotazione",
  course_info: "Info Corso",
  collaboration: "Collaborazione",
  other: "Altro",
};

const router: IRouter = Router();

router.post("/", async (req, res) => {
  const { name, email, phone, subject, message } = req.body;
  if (!name || !email || !subject || !message) {
    res.status(400).json({ error: "Bad Request", message: "Name, email, subject, and message are required" });
    return;
  }

  try {
    const [inserted] = await db.insert(contactRequestsTable).values({ name, email, phone, subject, message }).returning();
    req.log.info({ id: inserted.id }, "New contact request saved");

    const label = SUBJECT_LABELS[subject] || subject;

    // Create admin notification with contactId metadata for direct navigation
    await db.insert(notificationsTable).values({
      type:                "contact_request",
      title:               `Nuova richiesta da ${name}`,
      message:             `[${label}] ${message.trim().slice(0, 150)}`,
      isAdminNotification: true,
      isRead:              false,
      metadata:            JSON.stringify({
        contactId:    inserted.id,
        senderName:   name,
        senderEmail:  email,
        subject,
        subjectLabel: label,
      }),
    }).catch((err) => req.log.error({ err }, "Contact notification insert error"));

    notifyAdmin({
      title: "Nuovo messaggio — IUSMK",
      body: `${name}: ${label}`,
      url: `/admin/contacts?id=${inserted.id}`,
    }).catch((err) => req.log.error({ err }, "Push send error"));

    res.json({ success: true, message: "Your message has been sent. We'll get back to you soon." });
  } catch (err) {
    req.log.error({ err }, "Submit contact error");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to submit contact request" });
  }
});

export default router;
