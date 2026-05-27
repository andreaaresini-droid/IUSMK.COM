import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  coursesTable, courseModulesTable, accessCodesTable, studentsTable,
  galleryTable, galleryCategoriesTable, testimonialsTable, contactRequestsTable, adminsTable,
  studentCourseAccessTable, deviceSessionsTable, discountCodesTable, coursePurchasesTable,
  notificationsTable, chatConversationsTable, chatMessagesTable, paymentLinksTable,
  pushSubscriptionsTable, academyCategoriesTable,
} from "@workspace/db/schema";
import { eq, desc, count, and, isNotNull, sql, ilike, or, ne, gte, asc } from "drizzle-orm";
import { requireAdmin, AuthRequest } from "../middlewares/authMiddleware";
import { generateAccessCode, simpleHash, comparePassword } from "../lib/auth";
import { getVapidPublicKey, saveSubscription, deleteSubscription, getUserPushStats } from "../lib/webPush";
import { dispatchNotificationToUser, dispatchNotificationToAdmin, dispatchBroadcast } from "../lib/notifications";
// SumUp payment links non supportano l'API per promo codes — no-op mantenuto per compatibilità chiamanti.
async function enablePromoCodesOnPaymentLink(_paymentLinkId: string | null | undefined): Promise<void> {
  // no-op: Stripe rimosso, SumUp non richiede questa operazione
}

const router: IRouter = Router();
router.use(requireAdmin as any);

router.get("/stats", async (req: AuthRequest, res) => {
  try {
    const [totalStudentsResult] = await db.select({ count: count() }).from(studentsTable);
    const [activeCodes] = await db.select({ count: count() }).from(accessCodesTable).where(eq(accessCodesTable.isActive, true));
    const [totalCourses] = await db.select({ count: count() }).from(coursesTable);
    const [totalGallery] = await db.select({ count: count() }).from(galleryTable);
    const [pendingContacts] = await db.select({ count: count() }).from(contactRequestsTable).where(eq(contactRequestsTable.isRead, false));

    res.json({
      totalStudents: Number(totalStudentsResult.count),
      activeCodes: Number(activeCodes.count),
      totalCourses: Number(totalCourses.count),
      totalGalleryItems: Number(totalGallery.count),
      pendingContacts: Number(pendingContacts.count),
    });
  } catch (err) {
    req.log.error({ err }, "Admin stats error");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch stats" });
  }
});

// ─── Academy Categories CRUD ─────────────────────────────────────────────────

router.get("/academy-categories", async (req: AuthRequest, res) => {
  try {
    const cats = await db.query.academyCategoriesTable.findMany({
      orderBy: (c, { asc }) => [asc(c.orderIndex), asc(c.id)],
    });
    // Attach course count per category
    const withCounts = await Promise.all(cats.map(async (cat) => {
      const courses = await db.query.coursesTable.findMany({
        where: (c, { eq, and }) => and(eq(c.academyCategoryId, cat.id), eq(c.isArchived, false)),
        columns: { id: true, title: true, isPublished: true, price: true, thumbnailUrl: true },
      });
      return { ...cat, courses };
    }));
    res.json(withCounts);
  } catch (err) {
    req.log.error({ err }, "Admin list academy categories error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/academy-categories", async (req: AuthRequest, res) => {
  const {
    title, slug, thumbnailUrl, shortDescription, fullDescription,
    trailerVideoUrl, trailerPosterUrl, galleryImages, whatYouWillLearn,
    orderIndex, isActive,
  } = req.body;
  if (!title?.trim()) {
    res.status(400).json({ error: "Bad Request", message: "Il titolo è obbligatorio" });
    return;
  }
  const finalSlug = slug?.trim() || title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").substring(0, 60) + "-" + Date.now();
  try {
    const [cat] = await db.insert(academyCategoriesTable).values({
      title: title.trim(),
      slug: finalSlug,
      thumbnailUrl: thumbnailUrl || null,
      shortDescription: shortDescription || null,
      fullDescription: fullDescription || null,
      trailerVideoUrl: trailerVideoUrl || null,
      trailerPosterUrl: trailerPosterUrl || null,
      galleryImages: galleryImages || [],
      whatYouWillLearn: whatYouWillLearn || [],
      orderIndex: orderIndex ?? 0,
      isActive: isActive ?? true,
    }).returning();
    res.status(201).json(cat);
  } catch (err) {
    req.log.error({ err }, "Admin create academy category error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/academy-categories/:catId", async (req: AuthRequest, res) => {
  const { catId } = req.params;
  const {
    title, slug, thumbnailUrl, shortDescription, fullDescription,
    trailerVideoUrl, trailerPosterUrl, galleryImages, whatYouWillLearn,
    orderIndex, isActive,
  } = req.body;
  try {
    // ── Read-before-write per preservare tutti i media esistenti ──────────────
    const existing = await db.query.academyCategoriesTable.findFirst({
      where: eq(academyCategoriesTable.id, parseInt(catId)),
    });
    if (!existing) {
      res.status(404).json({ error: "Not Found", message: "Categoria non trovata" });
      return;
    }

    const safeMedia = (incoming: any, fallback: any) => {
      if (incoming === undefined) return fallback;
      if (typeof incoming === "string" && (incoming.startsWith("blob:") || incoming.startsWith("data:"))) return fallback;
      return incoming;
    };

    const safeThumb   = safeMedia(thumbnailUrl,    existing.thumbnailUrl);
    const safeTrailer = safeMedia(trailerVideoUrl, existing.trailerVideoUrl);
    const safePoster  = safeMedia(trailerPosterUrl, existing.trailerPosterUrl);
    const safeGallery = Array.isArray(galleryImages)
      ? (galleryImages as string[]).filter((u: string) => u && !u.startsWith("blob:") && !u.startsWith("data:"))
      : (existing.galleryImages ?? []);

    const [cat] = await db.update(academyCategoriesTable).set({
      title: title?.trim(),
      slug: slug?.trim() || undefined,
      thumbnailUrl:     safeThumb   || null,
      shortDescription: shortDescription || null,
      fullDescription:  fullDescription  || null,
      trailerVideoUrl:  safeTrailer || null,
      trailerPosterUrl: safePoster  || null,
      galleryImages:    safeGallery,
      whatYouWillLearn: whatYouWillLearn ?? [],
      orderIndex: orderIndex ?? 0,
      isActive: isActive ?? true,
      updatedAt: new Date(),
    }).where(eq(academyCategoriesTable.id, parseInt(catId))).returning();
    if (!cat) { res.status(404).json({ error: "Not Found", message: "Categoria non trovata" }); return; }
    res.json(cat);
  } catch (err) {
    req.log.error({ err }, "Admin update academy category error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/academy-categories/:catId", async (req: AuthRequest, res) => {
  const { catId } = req.params;
  try {
    // Scollega i corsi (set null) — il DB ha ON DELETE SET NULL
    await db.delete(academyCategoriesTable).where(eq(academyCategoriesTable.id, parseInt(catId)));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin delete academy category error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── Courses ─────────────────────────────────────────────────────────────────

router.get("/courses", async (req: AuthRequest, res) => {
  try {
    const showArchived = req.query.archived === "true";
    const courses = await db.query.coursesTable.findMany({
      where: showArchived
        ? eq(coursesTable.isArchived, true)
        : eq(coursesTable.isArchived, false),
      orderBy: (c, { desc: d }) => [d(c.createdAt)],
    });

    const result = await Promise.all(courses.map(async (course) => {
      const modules = await db.query.courseModulesTable.findMany({
        where: eq(courseModulesTable.courseId, course.id),
        orderBy: (m, { asc }) => [asc(m.orderIndex)],
      });
      const [activeCodes] = await db.select({ count: count() }).from(accessCodesTable)
        .where(and(eq(accessCodesTable.courseId, course.id), eq(accessCodesTable.isActive, true)));
      const [totalCodes] = await db.select({ count: count() }).from(accessCodesTable)
        .where(eq(accessCodesTable.courseId, course.id));
      const [activeStudents] = await db.select({ count: count() }).from(studentCourseAccessTable)
        .where(and(eq(studentCourseAccessTable.courseId, course.id), eq(studentCourseAccessTable.status, "active")));
      const [purchasesCount] = await db.select({ count: count() }).from(coursePurchasesTable)
        .where(eq(coursePurchasesTable.courseId, course.id));
      return {
        ...course,
        modules,
        activeCodes: Number(activeCodes.count),
        totalCodes: Number(totalCodes.count),
        totalStudents: Number(activeStudents.count),
        purchasesCount: Number(purchasesCount.count),
        hasLinkedData: Number(totalCodes.count) > 0 || Number(activeStudents.count) > 0 || Number(purchasesCount.count) > 0,
      };
    }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Admin list courses error");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch courses" });
  }
});

router.post("/courses", async (req: AuthRequest, res) => {
  const {
    title, slug, description, shortDescription, level, durationHours, thumbnailUrl, videoUrl,
    price, isPublished, whatYouLearn, requirements, paymentLinkUrl, paymentLinkId,
    fullDescription, whatYouWillLearn, targetAudience, includedContent, promoText,
    galleryImages, trailerVideoUrl, trailerPosterUrl, academyCategoryId, additionalInfo,
    backgroundImageUrl,
  } = req.body;
  if (!title || !description || !level) {
    res.status(400).json({ error: "Bad Request", message: "title, description, and level are required" });
    return;
  }
  const finalSlug = slug || title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").substring(0, 60) + "-" + Date.now();
  try {
    const [course] = await db.insert(coursesTable).values({
      title, slug: finalSlug, description, shortDescription, level, durationHours, thumbnailUrl, videoUrl, price,
      isPublished: isPublished ?? false, paymentLinkUrl: paymentLinkUrl || null,
      paymentLinkId: paymentLinkId?.trim() || null,
      whatYouLearn: whatYouLearn || [], requirements: requirements || [],
      fullDescription: fullDescription || null,
      whatYouWillLearn: whatYouWillLearn || [],
      targetAudience: targetAudience || [],
      includedContent: includedContent || [],
      promoText: promoText || null,
      galleryImages: galleryImages || [],
      trailerVideoUrl: trailerVideoUrl || null,
      trailerPosterUrl: trailerPosterUrl || null,
      academyCategoryId: academyCategoryId ? parseInt(academyCategoryId) : null,
      additionalInfo: additionalInfo || null,
      backgroundImageUrl: backgroundImageUrl || null,
    }).returning();
    if (paymentLinkId) enablePromoCodesOnPaymentLink(paymentLinkId.trim()).catch(() => {});
    res.status(201).json({ ...course, modules: [], activeCodes: 0, totalStudents: 0 });
  } catch (err) {
    req.log.error({ err }, "Admin create course error");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to create course" });
  }
});

router.put("/courses/:courseId", async (req: AuthRequest, res) => {
  const { courseId } = req.params;
  const {
    title, slug, description, shortDescription, level, durationHours, thumbnailUrl, videoUrl,
    price, isPublished, whatYouLearn, requirements, paymentLinkUrl, paymentLinkId,
    fullDescription, whatYouWillLearn, targetAudience, includedContent, promoText,
    galleryImages, trailerVideoUrl, trailerPosterUrl, academyCategoryId, additionalInfo,
    backgroundImageUrl,
  } = req.body;
  try {
    // ── Read-before-write: leggi il record esistente per preservare i media ──
    // Se un campo media non è inviato (undefined) o è null/vuoto per errore,
    // manteniamo il valore già salvato nel DB invece di sovrascriverlo con null.
    const existing = await db.query.coursesTable.findFirst({
      where: eq(coursesTable.id, parseInt(courseId)),
    });
    if (!existing) {
      res.status(404).json({ error: "Not Found", message: "Course not found" });
      return;
    }

    // Helper: usa il nuovo valore se è definito e non è blob/data; altrimenti mantieni l'esistente.
    const safeMedia = (incoming: any, fallback: any) => {
      if (incoming === undefined) return fallback;
      if (typeof incoming === "string" && (incoming.startsWith("blob:") || incoming.startsWith("data:"))) return fallback;
      return incoming;
    };

    const safeThumbnail       = safeMedia(thumbnailUrl,       existing.thumbnailUrl);
    const safeBgImage         = safeMedia(backgroundImageUrl, existing.backgroundImageUrl);
    const safeTrailerVideoUrl = safeMedia(trailerVideoUrl,    existing.trailerVideoUrl);
    const safeTrailerPoster   = safeMedia(trailerPosterUrl,   existing.trailerPosterUrl);
    // Gallery: usa il nuovo array se è un array valido; altrimenti mantieni l'esistente.
    const safeGallery = Array.isArray(galleryImages)
      ? (galleryImages as string[]).filter((u: string) => u && !u.startsWith("blob:") && !u.startsWith("data:"))
      : (existing.galleryImages ?? []);

    const [course] = await db.update(coursesTable).set({
      title, slug, description, shortDescription, level, durationHours,
      thumbnailUrl: safeThumbnail,
      videoUrl,
      price,
      isPublished,
      paymentLinkUrl: paymentLinkUrl || null,
      paymentLinkId: paymentLinkId?.trim() || null,
      whatYouLearn, requirements,
      fullDescription: fullDescription || null,
      whatYouWillLearn: whatYouWillLearn ?? [],
      targetAudience:   targetAudience   ?? [],
      includedContent:  includedContent  ?? [],
      promoText: promoText || null,
      galleryImages: safeGallery,
      trailerVideoUrl:  safeTrailerVideoUrl  || null,
      trailerPosterUrl: safeTrailerPoster    || null,
      academyCategoryId: academyCategoryId != null ? parseInt(academyCategoryId) : null,
      additionalInfo: additionalInfo || null,
      backgroundImageUrl: safeBgImage || null,
      updatedAt: new Date(),
    }).where(eq(coursesTable.id, parseInt(courseId))).returning();
    if (!course) { res.status(404).json({ error: "Not Found", message: "Course not found" }); return; }
    if (paymentLinkId) enablePromoCodesOnPaymentLink(paymentLinkId.trim()).catch(() => {});
    res.json({ ...course, modules: [], activeCodes: 0, totalStudents: 0 });
  } catch (err) {
    req.log.error({ err }, "Admin update course error");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to update course" });
  }
});

// PUT /admin/courses/:courseId/archive — archivia (soft delete) un corso
router.put("/courses/:courseId/archive", async (req: AuthRequest, res) => {
  const id = parseInt(req.params.courseId);
  try {
    const existing = await db.query.coursesTable.findFirst({ where: eq(coursesTable.id, id) });
    if (!existing) { res.status(404).json({ error: "Not Found", message: "Corso non trovato" }); return; }
    const [course] = await db.update(coursesTable)
      .set({ isArchived: true, isPublished: false, updatedAt: new Date() })
      .where(eq(coursesTable.id, id))
      .returning();
    res.json({ success: true, course });
  } catch (err) {
    req.log.error({ err }, "Admin archive course error");
    res.status(500).json({ error: "Internal Server Error", message: "Errore durante l'archiviazione del corso" });
  }
});

// PUT /admin/courses/:courseId/unarchive — ripristina un corso archiviato
router.put("/courses/:courseId/unarchive", async (req: AuthRequest, res) => {
  const id = parseInt(req.params.courseId);
  try {
    const existing = await db.query.coursesTable.findFirst({ where: eq(coursesTable.id, id) });
    if (!existing) { res.status(404).json({ error: "Not Found", message: "Corso non trovato" }); return; }
    const [course] = await db.update(coursesTable)
      .set({ isArchived: false, updatedAt: new Date() })
      .where(eq(coursesTable.id, id))
      .returning();
    res.json({ success: true, course });
  } catch (err) {
    req.log.error({ err }, "Admin unarchive course error");
    res.status(500).json({ error: "Internal Server Error", message: "Errore durante il ripristino del corso" });
  }
});

// DELETE /admin/courses/:courseId — eliminazione definitiva
router.delete("/courses/:courseId", async (req: AuthRequest, res) => {
  const { courseId } = req.params;
  const id = parseInt(courseId);
  try {
    const existing = await db.query.coursesTable.findFirst({ where: eq(coursesTable.id, id) });
    if (!existing) {
      res.status(404).json({ error: "Not Found", message: "Corso non trovato" });
      return;
    }
    // 1. Per ogni codice accesso: elimina sessioni dispositivo e accessi collegati al codice
    const relatedCodes = await db.query.accessCodesTable.findMany({ where: eq(accessCodesTable.courseId, id) });
    for (const code of relatedCodes) {
      await db.delete(deviceSessionsTable).where(eq(deviceSessionsTable.accessCodeId, code.id));
      await db.delete(studentCourseAccessTable).where(eq(studentCourseAccessTable.accessCodeId, code.id));
    }
    // 2. Elimina codici accesso
    await db.delete(accessCodesTable).where(eq(accessCodesTable.courseId, id));
    // 3. Elimina accessi corso residui (es. acquisti Stripe)
    await db.delete(studentCourseAccessTable).where(eq(studentCourseAccessTable.courseId, id));
    // 4. Elimina acquisti Stripe collegati (FK non-cascade)
    await db.delete(coursePurchasesTable).where(eq(coursePurchasesTable.courseId, id));
    // 5. Elimina moduli (cascade elimina videoProgress e videoDisclaimerAcks)
    await db.delete(courseModulesTable).where(eq(courseModulesTable.courseId, id));
    // 6. Elimina il corso
    await db.delete(coursesTable).where(eq(coursesTable.id, id));
    res.json({ success: true, message: "Corso eliminato definitivamente" });
  } catch (err) {
    req.log.error({ err }, "Admin delete course error");
    res.status(500).json({ error: "Internal Server Error", message: "Errore durante l'eliminazione del corso" });
  }
});

router.post("/courses/:courseId/modules", async (req: AuthRequest, res) => {
  const { courseId } = req.params;
  const { title, description, videoUrl, orderIndex, durationMinutes, price, thumbnailUrl, paymentLinkUrl, paymentLinkId } = req.body;
  if (!title || !title.trim()) {
    res.status(400).json({ error: "Bad Request", message: "Il titolo del video è obbligatorio" });
    return;
  }
  try {
    const [module] = await db.insert(courseModulesTable).values({
      courseId: parseInt(courseId),
      title: title.trim(),
      description: description?.trim() || null,
      videoUrl: videoUrl || null,
      orderIndex: orderIndex ?? 0,
      durationMinutes: durationMinutes ? parseInt(durationMinutes) : null,
      isPreview: false,
      price: price != null ? parseFloat(price) : null,
      thumbnailUrl: thumbnailUrl || null,
      paymentLinkUrl: paymentLinkUrl || null,
      paymentLinkId: paymentLinkId || null,
    }).returning();
    res.status(201).json(module);
  } catch (err) {
    req.log.error({ err }, "Admin create module error");
    res.status(500).json({ error: "Internal Server Error", message: "Errore nella creazione del modulo" });
  }
});

router.put("/courses/:courseId/modules/:moduleId", async (req: AuthRequest, res) => {
  const { moduleId } = req.params;
  const { title, description, videoUrl, orderIndex, durationMinutes, price, thumbnailUrl, paymentLinkUrl, paymentLinkId } = req.body;
  if (!title || !title.trim()) {
    res.status(400).json({ error: "Bad Request", message: "Il titolo del video è obbligatorio" });
    return;
  }
  try {
    const updateData: any = {
      title: title.trim(),
      description: description?.trim() || null,
      orderIndex: orderIndex ?? 0,
      durationMinutes: durationMinutes ? parseInt(durationMinutes) : null,
      price: price != null ? parseFloat(price) : null,
      thumbnailUrl: thumbnailUrl || null,
      paymentLinkUrl: paymentLinkUrl || null,
      paymentLinkId: paymentLinkId || null,
      updatedAt: new Date(),
    };
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl;
    const [module] = await db.update(courseModulesTable).set(updateData)
      .where(eq(courseModulesTable.id, parseInt(moduleId))).returning();
    if (!module) { res.status(404).json({ error: "Not Found", message: "Modulo non trovato" }); return; }
    res.json(module);
  } catch (err) {
    req.log.error({ err }, "Admin update module error");
    res.status(500).json({ error: "Internal Server Error", message: "Errore nell'aggiornamento del modulo" });
  }
});

router.delete("/courses/:courseId/modules/:moduleId", async (req: AuthRequest, res) => {
  const { moduleId } = req.params;
  try {
    await db.delete(courseModulesTable).where(eq(courseModulesTable.id, parseInt(moduleId)));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin delete module error");
    res.status(500).json({ error: "Internal Server Error", message: "Errore nell'eliminazione del modulo" });
  }
});

router.get("/access-codes", async (req: AuthRequest, res) => {
  try {
    const codes = await db.query.accessCodesTable.findMany({
      orderBy: (c, { desc: d }) => [d(c.createdAt)],
    });

    const result = await Promise.all(codes.map(async (code) => {
      const course = await db.query.coursesTable.findFirst({ where: eq(coursesTable.id, code.courseId) });
      const student = code.boundUserId ? await db.query.studentsTable.findFirst({ where: eq(studentsTable.id, code.boundUserId) }) : null;
      const [{ deviceCount }] = await db
        .select({ deviceCount: sql<number>`count(distinct ${deviceSessionsTable.fingerprint})` })
        .from(deviceSessionsTable)
        .where(and(
          eq(deviceSessionsTable.accessCodeId, code.id),
          isNotNull(deviceSessionsTable.fingerprint),
        ));
      return {
        ...code,
        courseTitle: course?.title || "Unknown Course",
        boundUserEmail: student?.email || null,
        activatedAt: code.activatedAt,
        expiresAt: code.expiresAt,
        createdAt: code.createdAt,
        devicesUsed: Number(deviceCount),
      };
    }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Admin list access codes error");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch access codes" });
  }
});

router.post("/access-codes", async (req: AuthRequest, res) => {
  const { courseId, assignedName, assignedEmail, maxDevices, expiresAt, notes, userId } = req.body;
  if (!courseId || !assignedName || !assignedEmail) {
    res.status(400).json({ error: "Bad Request", message: "Corso, nome cliente ed email sono obbligatori" });
    return;
  }
  const emailLower = assignedEmail.toLowerCase().trim();
  const boundUserId: number | null = userId ? parseInt(String(userId)) : null;

  try {
    const existingActiveCode = await db.query.accessCodesTable.findFirst({
      where: and(
        eq(accessCodesTable.assignedEmail, emailLower),
        eq(accessCodesTable.courseId, parseInt(courseId)),
        eq(accessCodesTable.isActive, true),
      ),
    });
    if (existingActiveCode) {
      res.status(400).json({
        error: "Duplicato",
        message: `Esiste già un codice attivo per questo cliente (${emailLower}) su questo corso.`,
      });
      return;
    }

    let code = generateAccessCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db.query.accessCodesTable.findFirst({ where: eq(accessCodesTable.code, code) });
      if (!existing) break;
      code = generateAccessCode();
      attempts++;
    }

    const [accessCode] = await db.insert(accessCodesTable).values({
      code,
      courseId: parseInt(courseId),
      assignedName: assignedName.trim(),
      assignedEmail: emailLower,
      maxDevices: maxDevices ? parseInt(maxDevices) : 1,
      maxActivations: 1,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isActive: true,
      notes: notes || null,
      boundUserId,
    }).returning();

    req.log.info({ codeId: accessCode.id, code: accessCode.code, courseId, boundUserId, email: emailLower }, "[CODE] created by admin");
    const course = await db.query.coursesTable.findFirst({ where: eq(coursesTable.id, parseInt(courseId)) });
    res.status(201).json({ ...accessCode, courseTitle: course?.title || "Unknown", boundUserEmail: null });
  } catch (err) {
    req.log.error({ err }, "Admin create access code error");
    res.status(500).json({ error: "Internal Server Error", message: "Errore nella creazione del codice" });
  }
});

router.put("/access-codes/:codeId", async (req: AuthRequest, res) => {
  const { codeId } = req.params;
  const { courseId, assignedName, assignedEmail, isActive, expiresAt, notes, maxDevices } = req.body;
  try {
    const current = await db.query.accessCodesTable.findFirst({ where: eq(accessCodesTable.id, parseInt(codeId)) });
    if (!current) { res.status(404).json({ error: "Not Found", message: "Codice non trovato" }); return; }

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (courseId != null) updates.courseId = parseInt(courseId);
    if (assignedName != null) updates.assignedName = assignedName.trim();
    if (assignedEmail != null) updates.assignedEmail = assignedEmail.toLowerCase().trim();
    if (isActive != null) updates.isActive = isActive;
    if (expiresAt != null) updates.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (notes != null) updates.notes = notes;
    if (maxDevices != null) updates.maxDevices = parseInt(maxDevices);

    const [updated] = await db.update(accessCodesTable).set(updates).where(eq(accessCodesTable.id, parseInt(codeId))).returning();
    const course = await db.query.coursesTable.findFirst({ where: eq(coursesTable.id, updated.courseId) });
    const student = updated.boundUserId ? await db.query.studentsTable.findFirst({ where: eq(studentsTable.id, updated.boundUserId) }) : null;

    res.json({ ...updated, courseTitle: course?.title || "Unknown", boundUserEmail: student?.email || null });
  } catch (err) {
    req.log.error({ err }, "Admin update access code error");
    res.status(500).json({ error: "Internal Server Error", message: "Errore nell'aggiornamento del codice" });
  }
});

router.post("/access-codes/:codeId/revoke", async (req: AuthRequest, res) => {
  const { codeId } = req.params;
  const id = parseInt(codeId);
  try {
    const code = await db.query.accessCodesTable.findFirst({ where: eq(accessCodesTable.id, id) });
    if (!code) { res.status(404).json({ error: "Not Found", message: "Codice non trovato" }); return; }

    // 1. Disattiva il codice
    await db.update(accessCodesTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(accessCodesTable.id, id));

    req.log.info({ codeId: id, code: code.code, courseId: code.courseId }, "[CODE] revoked");

    // 2. Revoca anche tutti i record studentCourseAccess collegati a questo codice
    //    In questo modo il corso sparisce da "I miei corsi" del cliente
    const revoked = await db.update(studentCourseAccessTable)
      .set({ status: "revoked", updatedAt: new Date() })
      .where(eq(studentCourseAccessTable.accessCodeId, id))
      .returning();

    if (revoked.length > 0) {
      req.log.info({ codeId: id, courseId: code.courseId, studentsAffected: revoked.length }, "[CODE] course access revoked — removed from I miei corsi");
    } else {
      req.log.info({ codeId: id }, "[CODE] no course access records to revoke (code was not yet activated)");
    }

    res.json({ success: true, message: "Codice revocato — accesso al corso rimosso" });
  } catch (err) {
    req.log.error({ err }, "Admin revoke access code error");
    res.status(500).json({ error: "Internal Server Error", message: "Errore nella revoca" });
  }
});

router.post("/access-codes/:codeId/reactivate", async (req: AuthRequest, res) => {
  const { codeId } = req.params;
  const id = parseInt(codeId);
  try {
    const code = await db.query.accessCodesTable.findFirst({ where: eq(accessCodesTable.id, id) });
    if (!code) { res.status(404).json({ error: "Not Found", message: "Codice non trovato" }); return; }

    await db.update(accessCodesTable)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(accessCodesTable.id, id));

    req.log.info({ codeId: id, code: code.code }, "[CODE] reactivated");

    // Ripristina anche eventuali studentCourseAccess revocati collegati a questo codice
    const restored = await db.update(studentCourseAccessTable)
      .set({ status: "active", updatedAt: new Date() })
      .where(and(eq(studentCourseAccessTable.accessCodeId, id), eq(studentCourseAccessTable.status, "revoked")))
      .returning();

    if (restored.length > 0) {
      req.log.info({ codeId: id, courseId: code.courseId, studentsRestored: restored.length }, "[CODE] course access restored — visible again in I miei corsi");
    }

    res.json({ success: true, message: "Codice riattivato" });
  } catch (err) {
    req.log.error({ err }, "Admin reactivate access code error");
    res.status(500).json({ error: "Internal Server Error", message: "Errore nella riattivazione" });
  }
});

// POST /admin/access-codes/:codeId/notify — invia notifica in-app al cliente con il codice di accesso
router.post("/access-codes/:codeId/notify", async (req: AuthRequest, res) => {
  const { codeId } = req.params;
  const id = parseInt(codeId);
  try {
    // ── 1. Carica il codice ──────────────────────────────────────────────────
    const code = await db.query.accessCodesTable.findFirst({ where: eq(accessCodesTable.id, id) });
    if (!code) {
      res.status(404).json({ error: "Not Found", message: "Codice non trovato" });
      return;
    }

    // ── 2. Risolvi il destinatario ───────────────────────────────────────────
    // Priorità: boundUserId > ricerca per email
    let targetUserId: number | null = code.boundUserId ?? null;

    if (!targetUserId && code.assignedEmail) {
      const userByEmail = await db.query.studentsTable.findFirst({
        where: eq(studentsTable.email, code.assignedEmail.toLowerCase().trim()),
      });
      if (userByEmail) targetUserId = userByEmail.id;
    }

    if (!targetUserId) {
      req.log.warn({ codeId: id }, "[CODE NOTIFY] nessun utente associato al codice");
      res.status(400).json({
        error: "Destinatario non trovato",
        message: "Impossibile inviare la notifica: nessun account cliente associato a questo codice.",
      });
      return;
    }

    // ── 3. Verifica che il corso esista ───────────────────────────────────────
    const course = await db.query.coursesTable.findFirst({ where: eq(coursesTable.id, code.courseId) });
    if (!course) {
      res.status(400).json({
        error: "Corso non trovato",
        message: "Impossibile inviare la notifica: il corso associato non esiste.",
      });
      return;
    }

    // ── 4. Invia notifica in-app ───────────────────────────────────────────────
    await dispatchNotificationToUser(targetUserId, {
      type:       "purchase",
      title:      "Hai ricevuto un codice di accesso",
      message:    `Giuseppe ti ha assegnato un codice per il corso "${course.title}".\nIl tuo codice è: ${code.code}\nClicca "Accedi al corso" per inserirlo e sbloccare il corso.`,
      courseId:   course.id,
      accessCode: code.code,
      linkUrl:    `/course/${course.id}/activate?code=${code.code}`,
    });

    // ── 5. Aggiorna contatore nel record codice ────────────────────────────────
    const now = new Date();
    await db.update(accessCodesTable)
      .set({
        notificationSentAt:    now,
        notificationSentCount: (code.notificationSentCount ?? 0) + 1,
        updatedAt:             now,
      })
      .where(eq(accessCodesTable.id, id));

    req.log.info(
      { codeId: id, code: code.code, targetUserId, courseId: course.id, sendCount: (code.notificationSentCount ?? 0) + 1 },
      "[CODE NOTIFY] notifica inviata al cliente"
    );

    res.json({
      success:     true,
      message:     "Notifica inviata con successo",
      sentAt:      now.toISOString(),
      sendCount:   (code.notificationSentCount ?? 0) + 1,
    });
  } catch (err) {
    req.log.error({ err }, "Admin notify access code error");
    res.status(500).json({ error: "Internal Server Error", message: "Errore nell'invio della notifica" });
  }
});

router.delete("/access-codes/:codeId", async (req: AuthRequest, res) => {
  const { codeId } = req.params;
  const id = parseInt(codeId);
  try {
    const existing = await db.query.accessCodesTable.findFirst({ where: eq(accessCodesTable.id, id) });
    if (!existing) {
      res.status(404).json({ error: "Not Found", message: "Codice non trovato" });
      return;
    }

    req.log.info({ codeId: id, code: existing.code, courseId: existing.courseId, wasActive: existing.isActive }, "[CODE] deleted — hard delete requested");

    await db.delete(deviceSessionsTable).where(eq(deviceSessionsTable.accessCodeId, id));

    const removedAccess = await db.delete(studentCourseAccessTable)
      .where(eq(studentCourseAccessTable.accessCodeId, id))
      .returning();

    await db.delete(accessCodesTable).where(eq(accessCodesTable.id, id));

    req.log.info({ codeId: id, code: existing.code, removedCourseAccess: removedAccess.length }, "[ADMIN CODES] hard delete executed — course access removed");

    res.json({ success: true, message: "Codice eliminato definitivamente" });
  } catch (err) {
    req.log.error({ err }, "Admin delete access code error");
    res.status(500).json({ error: "Internal Server Error", message: "Errore nell'eliminazione del codice" });
  }
});

router.get("/gallery", async (req: AuthRequest, res) => {
  try {
    const items = await db.query.galleryTable.findMany({ orderBy: (g, { asc }) => [asc(g.orderIndex)] });
    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Admin list gallery error");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch gallery" });
  }
});

router.post("/gallery", async (req: AuthRequest, res) => {
  const { imageUrl, title, category, orderIndex, mediaType, thumbnailUrl } = req.body;
  if (!imageUrl || !category) {
    res.status(400).json({ error: "Bad Request", message: "imageUrl and category are required" });
    return;
  }
  try {
    const [item] = await db.insert(galleryTable).values({
      imageUrl, title, category,
      mediaType: mediaType || "image",
      thumbnailUrl: thumbnailUrl || null,
      orderIndex: orderIndex || 0,
    }).returning();
    res.status(201).json(item);
  } catch (err) {
    req.log.error({ err }, "Admin add gallery item error");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to add gallery item" });
  }
});

router.put("/gallery/:itemId", async (req: AuthRequest, res) => {
  const { itemId } = req.params;
  const { title, category, mediaType, thumbnailUrl } = req.body;
  try {
    const updates: Record<string, any> = {};
    if (title != null) updates.title = title;
    if (category != null) updates.category = category;
    if (mediaType != null) updates.mediaType = mediaType;
    if (thumbnailUrl !== undefined) updates.thumbnailUrl = thumbnailUrl;
    const [item] = await db.update(galleryTable).set(updates).where(eq(galleryTable.id, parseInt(itemId))).returning();
    res.json(item);
  } catch (err) {
    req.log.error({ err }, "Admin update gallery item error");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to update item" });
  }
});

router.delete("/gallery/:itemId", async (req: AuthRequest, res) => {
  const { itemId } = req.params;
  try {
    await db.delete(galleryTable).where(eq(galleryTable.id, parseInt(itemId)));
    res.json({ success: true, message: "Gallery item deleted" });
  } catch (err) {
    req.log.error({ err }, "Admin delete gallery item error");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to delete item" });
  }
});

router.get("/gallery/categories", async (req: AuthRequest, res) => {
  try {
    const cats = await db.query.galleryCategoriesTable.findMany({ orderBy: (c, { asc }) => [asc(c.orderIndex)] });
    res.json(cats);
  } catch (err) {
    req.log.error({ err }, "Admin list gallery categories error");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch categories" });
  }
});

router.post("/gallery/categories", async (req: AuthRequest, res) => {
  const { name } = req.body;
  if (!name?.trim()) {
    res.status(400).json({ error: "Bad Request", message: "Name is required" });
    return;
  }
  try {
    const slug = name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    const [cats] = await db.select({ count: count() }).from(galleryCategoriesTable);
    const [cat] = await db.insert(galleryCategoriesTable).values({ name: name.trim(), slug, orderIndex: Number(cats.count) }).returning();
    res.status(201).json(cat);
  } catch (err) {
    req.log.error({ err }, "Admin create gallery category error");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to create category" });
  }
});

router.put("/gallery/categories/:catId", async (req: AuthRequest, res) => {
  const { catId } = req.params;
  const { name } = req.body;
  if (!name?.trim()) {
    res.status(400).json({ error: "Bad Request", message: "Name is required" });
    return;
  }
  try {
    const slug = name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    const current = await db.query.galleryCategoriesTable.findFirst({ where: eq(galleryCategoriesTable.id, parseInt(catId)) });
    if (!current) { res.status(404).json({ error: "Not Found", message: "Category not found" }); return; }
    const [cat] = await db.update(galleryCategoriesTable).set({ name: name.trim(), slug }).where(eq(galleryCategoriesTable.id, parseInt(catId))).returning();
    await db.update(galleryTable).set({ category: slug }).where(eq(galleryTable.category, current.slug));
    res.json(cat);
  } catch (err) {
    req.log.error({ err }, "Admin update gallery category error");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to update category" });
  }
});

router.delete("/gallery/categories/:catId", async (req: AuthRequest, res) => {
  const { catId } = req.params;
  try {
    const cat = await db.query.galleryCategoriesTable.findFirst({ where: eq(galleryCategoriesTable.id, parseInt(catId)) });
    if (!cat) { res.status(404).json({ error: "Not Found", message: "Category not found" }); return; }
    await db.update(galleryTable).set({ category: "senza_categoria" }).where(eq(galleryTable.category, cat.slug));
    await db.delete(galleryCategoriesTable).where(eq(galleryCategoriesTable.id, parseInt(catId)));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin delete gallery category error");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to delete category" });
  }
});

router.get("/testimonials", async (req: AuthRequest, res) => {
  try {
    const items = await db.query.testimonialsTable.findMany({ orderBy: (t, { desc: d }) => [d(t.createdAt)] });
    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Admin list testimonials error");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch testimonials" });
  }
});

router.post("/testimonials", async (req: AuthRequest, res) => {
  const { name, role, content, rating, avatarUrl, isPublished } = req.body;
  if (!name || !content || rating == null) {
    res.status(400).json({ error: "Bad Request", message: "name, content, and rating are required" });
    return;
  }
  try {
    const [item] = await db.insert(testimonialsTable).values({ name, role, content, rating, avatarUrl, isPublished: isPublished ?? true }).returning();
    res.status(201).json(item);
  } catch (err) {
    req.log.error({ err }, "Admin create testimonial error");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to create testimonial" });
  }
});

router.delete("/testimonials/:testimonialId", async (req: AuthRequest, res) => {
  const { testimonialId } = req.params;
  try {
    await db.delete(testimonialsTable).where(eq(testimonialsTable.id, parseInt(testimonialId)));
    res.json({ success: true, message: "Testimonial deleted" });
  } catch (err) {
    req.log.error({ err }, "Admin delete testimonial error");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to delete testimonial" });
  }
});

// GET /admin/contacts/unread-count
router.get("/contacts/unread-count", async (req: AuthRequest, res) => {
  try {
    const [row] = await db.select({ c: count() }).from(contactRequestsTable).where(eq(contactRequestsTable.isRead, false));
    res.json({ unread: Number(row?.c ?? 0) });
  } catch (err) {
    req.log.error({ err }, "Contacts unread count error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /admin/notifications/unread-count
router.get("/notifications/unread-count", async (req: AuthRequest, res) => {
  try {
    const [row] = await db.select({ c: count() }).from(notificationsTable).where(
      and(eq(notificationsTable.isAdminNotification, true), eq(notificationsTable.isRead, false))
    );
    res.json({ unread: Number(row?.c ?? 0) });
  } catch (err) {
    req.log.error({ err }, "Notifications unread count error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/contact-requests", async (req: AuthRequest, res) => {
  try {
    const requests = await db.query.contactRequestsTable.findMany({ orderBy: (c, { desc: d }) => [d(c.createdAt)] });
    res.setHeader("Cache-Control", "no-store");
    res.json(requests);
  } catch (err) {
    req.log.error({ err }, "Admin list contacts error");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch contact requests" });
  }
});

router.post("/contact-requests/:id/read", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Bad Request", message: "Invalid id" }); return; }
  try {
    await db.update(contactRequestsTable).set({ isRead: true }).where(eq(contactRequestsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Mark contact read error");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to mark as read" });
  }
});

router.delete("/contact-requests/:id", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Bad Request", message: "Invalid id" }); return; }
  try {
    await db.delete(contactRequestsTable).where(eq(contactRequestsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Delete contact error");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to delete contact" });
  }
});

// SSE endpoint rimosso — non usato dal frontend.
// Le notifiche contatti avvengono tramite Web Push (webPush.ts).

router.get("/credentials", async (req: AuthRequest, res) => {
  try {
    const admin = await db.query.adminsTable.findFirst({
      where: eq(adminsTable.id, req.userId!),
    });
    if (!admin) { res.status(404).json({ error: "Not Found", message: "Admin not found" }); return; }
    res.json({ username: admin.username, name: admin.name, email: admin.email });
  } catch (err) {
    req.log.error({ err }, "Admin get credentials error");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch credentials" });
  }
});

router.put("/credentials", async (req: AuthRequest, res) => {
  const { currentPassword, newUsername, newPassword, confirmPassword } = req.body;
  if (!currentPassword) {
    res.status(400).json({ error: "Bad Request", message: "La password attuale è obbligatoria" });
    return;
  }
  try {
    const admin = await db.query.adminsTable.findFirst({ where: eq(adminsTable.id, req.userId!) });
    if (!admin) { res.status(404).json({ error: "Not Found", message: "Admin non trovato" }); return; }

    const valid = await comparePassword(currentPassword, admin.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Unauthorized", message: "La password attuale non è corretta" });
      return;
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        res.status(400).json({ error: "Bad Request", message: "La nuova password deve essere di almeno 6 caratteri" });
        return;
      }
      if (newPassword !== confirmPassword) {
        res.status(400).json({ error: "Bad Request", message: "La conferma password non corrisponde" });
        return;
      }
    }

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (newUsername && newUsername.trim()) updates.username = newUsername.trim();
    if (newPassword) updates.passwordHash = simpleHash(newPassword);

    await db.update(adminsTable).set(updates).where(eq(adminsTable.id, req.userId!));
    res.json({ success: true, message: "Credenziali aggiornate correttamente" });
  } catch (err: any) {
    req.log.error({ err }, "Admin update credentials error");
    if (err.code === "23505") {
      res.status(400).json({ error: "Conflict", message: "Questo nome utente è già in uso" });
    } else {
      res.status(500).json({ error: "Internal Server Error", message: "Impossibile aggiornare le credenziali" });
    }
  }
});

// Stripe rimosso — diagnostics route restituisce status disabilitato
router.get("/stripe/diagnostics", async (_req: AuthRequest, res) => {
  res.json({ disabled: true, message: "Stripe rimosso — pagamenti via SumUp payment links." });
});

router.get("/discount-codes", async (req: AuthRequest, res) => {
  try {
    const codes = await db.query.discountCodesTable.findMany({
      orderBy: (c, { desc: d }) => [d(c.createdAt)],
    });
    res.json(codes);
  } catch (err) {
    req.log.error({ err }, "Admin list discount codes error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});


router.post("/discount-codes", async (req: AuthRequest, res) => {
  const { code, discountType, discountValue, maxUses, expiresAt, description } = req.body;
  if (!code) {
    res.status(400).json({ error: "Bad Request", message: "code è obbligatorio" });
    return;
  }
  const normalizedCode = (code as string).toUpperCase().trim();
  const parsedType: string = discountType || "percentage";
  const parsedValue = discountValue ? parseFloat(discountValue) : 0;
  const parsedMaxUses: number | null = maxUses ? parseInt(maxUses) : null;
  const parsedExpiresAt: Date | null = expiresAt ? new Date(expiresAt) : null;

  console.log("[COUPON SEND] create campaign — code:", normalizedCode, "type:", parsedType, "value:", parsedValue);

  try {
    const [dc] = await db.insert(discountCodesTable).values({
      code: normalizedCode,
      discountType: parsedType,
      discountValue: parsedValue,
      maxUses: parsedMaxUses,
      expiresAt: parsedExpiresAt,
      isActive: true,
    }).returning();
    console.log("[COUPON SEND] campaign saved — dbId:", dc.id);
    res.status(201).json(dc);
  } catch (err: any) {
    req.log.error({ err }, "Admin create discount code error");
    if (err.code === "23505") {
      res.status(400).json({ error: "Conflict", message: "Codice già esistente" });
    } else {
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
});

router.put("/discount-codes/:id", async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { code, discountType, discountValue, maxUses, expiresAt, isActive } = req.body;
  try {
    const [dc] = await db.update(discountCodesTable).set({
      ...(code !== undefined && { code: code.toUpperCase().trim() }),
      ...(discountType !== undefined && { discountType }),
      ...(discountValue !== undefined && { discountValue: parseFloat(discountValue) }),
      ...(maxUses !== undefined && { maxUses: maxUses ? parseInt(maxUses) : null }),
      ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
      ...(isActive !== undefined && { isActive }),
      updatedAt: new Date(),
    }).where(eq(discountCodesTable.id, parseInt(id))).returning();
    if (!dc) { res.status(404).json({ error: "Not Found" }); return; }
    res.json(dc);
  } catch (err) {
    req.log.error({ err }, "Admin update discount code error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/discount-codes/:id", async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    await db.delete(discountCodesTable).where(eq(discountCodesTable.id, parseInt(id)));
    console.log("[COUPON SEND] campaign deleted — id:", id);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin delete discount code error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Stripe rimosso — questa operazione non è applicabile con SumUp
router.post("/discount-codes/enable-promo-on-all-links", async (_req: AuthRequest, res) => {
  res.json({ success: true, updated: 0, message: "Stripe rimosso — operazione non applicabile con SumUp." });
});

// POST /admin/discount-codes/:id/send — send coupon notification to users
router.post("/discount-codes/:id/send", async (req: AuthRequest, res) => {
  const codeId = parseInt(req.params.id);
  const { userIds, mode = "specific", customMessage } = req.body as {
    userIds?: number[];
    mode?: "specific" | "all";
    customMessage?: string;
  };

  console.log("[COUPON SEND] send requested — codeId:", codeId, "mode:", mode, "recipients:", userIds?.length ?? "all");

  try {
    const dc = await db.query.discountCodesTable.findFirst({ where: eq(discountCodesTable.id, codeId) });
    if (!dc) { res.status(404).json({ error: "Not Found", message: "Codice non trovato" }); return; }

    let targets: { id: number; name: string; email: string }[] = [];

    if (mode === "all") {
      targets = await db.query.studentsTable.findMany({
        columns: { id: true, name: true, email: true },
      }) as any;
      console.log("[COUPON SEND] recipients selected — mode:all total:", targets.length);
    } else if (userIds && userIds.length > 0) {
      const students = await db.query.studentsTable.findMany({
        columns: { id: true, name: true, email: true },
        where: (s, { inArray }) => inArray(s.id, userIds),
      });
      targets = students as any;
      console.log("[COUPON SEND] recipients selected — mode:specific ids:", userIds, "found:", targets.length);
    }

    if (targets.length === 0) {
      res.status(400).json({ error: "Bad Request", message: "Nessun destinatario selezionato" });
      return;
    }

    const discountLabel = dc.discountType === "percentage"
      ? `${dc.discountValue}% di sconto`
      : `€${dc.discountValue} di sconto`;

    const expiry = dc.expiresAt
      ? `Scade il ${new Date(dc.expiresAt).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })}`
      : "Senza scadenza";

    const notifMessage = [
      customMessage?.trim() || null,
      `Sconto: ${discountLabel}`,
      `Validità: ${expiry}`,
      `Come usarlo: vai al checkout Stripe e inserisci il codice nel campo "Codice promozionale".`,
    ].filter(Boolean).join("\n\n");

    let sent = 0;
    let pushSent = 0;
    for (const user of targets) {
      try {
        await dispatchNotificationToUser(user.id, {
          type:           "discount_code",
          title:          `🎁 Codice sconto per te: ${dc.code}`,
          message:        notifMessage,
          recipientEmail: user.email,
          accessCode:     dc.code,
          linkUrl:        "/academy",
        });
        sent++;
        pushSent++;
        console.log("[COUPON SEND] site notification sent — userId:", user.id, "code:", dc.code);
        console.log("[COUPON SEND] push sent — userId:", user.id);
      } catch (e: any) {
        console.error("[COUPON SEND] notification failed — userId:", user.id, "error:", e?.message);
        req.log.warn({ userId: user.id, err: e }, "[COUPON SEND] notification failed for user");
      }
    }

    console.log("[NOTIFICATIONS] unread count updated — sent:", sent, "/", targets.length, "coupon:", dc.code);
    console.log("[COUPON SEND] done — sent:", sent, "pushSent:", pushSent, "total:", targets.length);
    req.log.info({ codeId, code: dc.code, sent, total: targets.length }, "[COUPON SEND] coupon campaign dispatched");
    res.json({ success: true, sent, total: targets.length });
  } catch (err: any) {
    console.error("[COUPON SEND] fatal error:", err?.message);
    req.log.error({ err }, "Admin send discount code error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/purchases", async (req: AuthRequest, res) => {
  try {
    const purchases = await db.query.coursePurchasesTable.findMany({
      where: eq(coursePurchasesTable.status, "completed"),
      orderBy: (p, { desc: d }) => [d(p.createdAt)],
    });
    const result = await Promise.all(purchases.map(async (p) => {
      const course = await db.query.coursesTable.findFirst({ where: eq(coursesTable.id, p.courseId) });
      return { ...p, courseTitle: course?.title || "Corso sconosciuto" };
    }));
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Admin list purchases error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/purchases/:id/resend-code", async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    const purchase = await db.query.coursePurchasesTable.findFirst({
      where: eq(coursePurchasesTable.id, parseInt(id)),
    });
    if (!purchase) { res.status(404).json({ error: "Not Found" }); return; }
    if (!purchase.accessCode) { res.status(400).json({ error: "Nessun codice di accesso disponibile" }); return; }
    res.json({ accessCode: purchase.accessCode, email: purchase.customerEmail });
  } catch (err) {
    req.log.error({ err }, "Resend code error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/notifications", async (req: AuthRequest, res) => {
  try {
    const notifs = await db.query.notificationsTable.findMany({
      where: eq(notificationsTable.isAdminNotification, true),
      orderBy: (n, { desc: d }) => [d(n.createdAt)],
    });
    res.json(notifs);
  } catch (err) {
    req.log.error({ err }, "Admin notifications error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/notifications/:id/read", async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.id, parseInt(id)));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Mark notification read error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/notifications/:id", async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    await db.delete(notificationsTable).where(
      and(eq(notificationsTable.id, parseInt(id)), eq(notificationsTable.isAdminNotification, true))
    );
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Delete admin notification error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/notifications", async (req: AuthRequest, res) => {
  try {
    await db.delete(notificationsTable).where(eq(notificationsTable.isAdminNotification, true));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Delete all admin notifications error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ═══════════════════════════════════════════════════════════
// ACCOUNTS (registered users)
// ═══════════════════════════════════════════════════════════

router.get("/accounts", async (req: AuthRequest, res) => {
  const { search = "", filter = "all", page = "1", limit = "100" } = req.query as Record<string, string>;
  const pageNum   = Math.max(1, parseInt(page) || 1);
  const limitNum  = Math.min(200, Math.max(1, parseInt(limit) || 100));
  const offset    = (pageNum - 1) * limitNum;

  try {
    const searchTrim = search.trim().toLowerCase();
    const now        = new Date();
    const today      = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const last7days  = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);

    const allStudents = await db.query.studentsTable.findMany({
      orderBy: (s, { desc: d }) => [d(s.createdAt)],
    });

    // Search filter
    let filtered = allStudents.filter((s) => {
      if (searchTrim) {
        const haystack = `${s.name} ${s.email} ${s.firstName ?? ""} ${s.lastName ?? ""}`.toLowerCase();
        return haystack.includes(searchTrim);
      }
      return true;
    });

    // Date / type filter
    if (filter === "today") {
      filtered = filtered.filter((s) => s.createdAt >= today);
    } else if (filter === "last7days") {
      filtered = filtered.filter((s) => s.createdAt >= last7days);
    }

    const needsSecondaryFilter = ["with_courses", "without_courses", "with_codes", "without_codes"].includes(filter);

    // Enrich: if secondary filter needed, enrich all filtered rows so we can filter correctly
    // Otherwise only enrich the current page for efficiency
    const toEnrich = needsSecondaryFilter ? filtered : filtered.slice(offset, offset + limitNum);

    const enriched = await Promise.all(
      toEnrich.map(async (s) => {
        const [codesRes]     = await db.select({ c: count() }).from(accessCodesTable)
          .where(or(eq(accessCodesTable.assignedEmail, s.email), eq(accessCodesTable.boundUserId, s.id)));
        const [purchasesRes] = await db.select({ c: count() }).from(coursePurchasesTable)
          .where(or(eq(coursePurchasesTable.customerEmail, s.email), eq(coursePurchasesTable.userId, s.id)));
        const codesCount     = Number(codesRes?.c ?? 0);
        const purchasesCount = Number(purchasesRes?.c ?? 0);
        return { ...s, passwordHash: undefined, codesCount, purchasesCount };
      })
    );

    // Apply secondary filters that need enriched data
    let fullyFiltered = enriched;
    if (filter === "with_courses")    fullyFiltered = enriched.filter((s) => s.purchasesCount > 0);
    if (filter === "without_courses") fullyFiltered = enriched.filter((s) => s.purchasesCount === 0);
    if (filter === "with_codes")      fullyFiltered = enriched.filter((s) => s.codesCount > 0);
    if (filter === "without_codes")   fullyFiltered = enriched.filter((s) => s.codesCount === 0);

    // Paginate after secondary filter for accurate totals
    const result = needsSecondaryFilter ? fullyFiltered.slice(offset, offset + limitNum) : fullyFiltered;
    const total  = needsSecondaryFilter ? fullyFiltered.length : filtered.length;

    res.json({ accounts: result, total, page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error({ err }, "Admin list accounts error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/accounts/:studentId", async (req: AuthRequest, res) => {
  const id = parseInt(req.params.studentId);
  try {
    const student = await db.query.studentsTable.findFirst({ where: eq(studentsTable.id, id) });
    if (!student) { res.status(404).json({ error: "Not Found", message: "Account non trovato" }); return; }

    const codes = await db.query.accessCodesTable.findMany({
      where: or(eq(accessCodesTable.assignedEmail, student.email), eq(accessCodesTable.boundUserId, id)),
      orderBy: (c, { desc: d }) => [d(c.createdAt)],
    });
    const codesEnriched = await Promise.all(codes.map(async (c) => {
      const course = await db.query.coursesTable.findFirst({ where: eq(coursesTable.id, c.courseId) });
      return { ...c, courseTitle: course?.title ?? "Corso sconosciuto" };
    }));

    const purchases = await db.query.coursePurchasesTable.findMany({
      where: or(eq(coursePurchasesTable.customerEmail, student.email), eq(coursePurchasesTable.userId, id)),
      orderBy: (p, { desc: d }) => [d(p.createdAt)],
    });
    const purchasesEnriched = await Promise.all(purchases.map(async (p) => {
      const course = await db.query.coursesTable.findFirst({ where: eq(coursesTable.id, p.courseId) });
      return { ...p, courseTitle: course?.title ?? "Corso sconosciuto" };
    }));

    // ── Corsi attivi da codice (studentCourseAccessTable) ─────────────────────
    // Questa è la fonte di verità per tutti i corsi realmente sbloccati,
    // indipendentemente dal fatto che l'accesso sia avvenuto via Stripe o codice.
    const activeAccesses = await db.query.studentCourseAccessTable.findMany({
      where: and(
        eq(studentCourseAccessTable.studentId, id),
        eq(studentCourseAccessTable.status, "active"),
      ),
      orderBy: (a, { desc: d }) => [d(a.activatedAt)],
    });
    const activeCoursesEnriched = await Promise.all(activeAccesses.map(async (a) => {
      const course = await db.query.coursesTable.findFirst({ where: eq(coursesTable.id, a.courseId) });
      const code = await db.query.accessCodesTable.findFirst({ where: eq(accessCodesTable.id, a.accessCodeId) });
      // Determina la fonte: se esiste un acquisto Stripe collegato a questo codice → stripe, altrimenti → code
      const linkedPurchase = purchases.find((p) => p.accessCode === code?.code);
      const source: "stripe" | "code" = linkedPurchase ? "stripe" : "code";
      return {
        id:            a.id,
        courseId:      a.courseId,
        courseTitle:   course?.title ?? "Corso sconosciuto",
        accessCodeId:  a.accessCodeId,
        accessCode:    code?.code ?? null,
        source,
        activatedAt:   a.activatedAt,
        status:        a.status,
      };
    }));
    req.log.info(
      { studentId: id, email: student.email, count: activeCoursesEnriched.length },
      "[ADMIN COURSES] fetched customer active courses",
    );

    const notifications = await db.query.notificationsTable.findMany({
      where: and(eq(notificationsTable.userId, id), eq(notificationsTable.isAdminNotification, false)),
      orderBy: (n, { desc: d }) => [d(n.createdAt)],
    });

    res.json({
      ...student,
      passwordHash: undefined,
      codes:          codesEnriched,
      purchases:      purchasesEnriched,
      activeCourses:  activeCoursesEnriched,
      notifications,
    });
  } catch (err) {
    req.log.error({ err }, "Admin get account detail error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/accounts/:studentId/notes", async (req: AuthRequest, res) => {
  const id = parseInt(req.params.studentId);
  const { adminNotes } = req.body as { adminNotes: string };
  try {
    await db.update(studentsTable).set({ adminNotes: adminNotes ?? null, updatedAt: new Date() }).where(eq(studentsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin update notes error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/accounts/:studentId/message", async (req: AuthRequest, res) => {
  const id = parseInt(req.params.studentId);
  const { title, message } = req.body as { title: string; message: string };
  if (!title?.trim() || !message?.trim()) {
    res.status(400).json({ error: "Bad Request", message: "title e message sono obbligatori" });
    return;
  }
  try {
    const student = await db.query.studentsTable.findFirst({ where: eq(studentsTable.id, id) });
    if (!student) { res.status(404).json({ error: "Not Found", message: "Account non trovato" }); return; }

    req.log.info({ userId: id, title: title.trim() }, "[NOTIFY] Admin quick message dispatching (DB + push)");
    await dispatchNotificationToUser(id, {
      type:           "admin_notification",
      title:          title.trim(),
      message:        message.trim(),
      recipientEmail: student.email,
    });

    res.status(201).json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin send message error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/accounts/:studentId/assign-code", async (req: AuthRequest, res) => {
  const studentId = parseInt(req.params.studentId);
  const { courseId, codeId, sendNotification: doNotify = true } = req.body as { courseId: number; codeId?: number; sendNotification?: boolean };

  if (!courseId) {
    res.status(400).json({ error: "Bad Request", message: "courseId è obbligatorio" });
    return;
  }

  try {
    const student = await db.query.studentsTable.findFirst({ where: eq(studentsTable.id, studentId) });
    if (!student) { res.status(404).json({ error: "Not Found", message: "Account non trovato" }); return; }

    const course = await db.query.coursesTable.findFirst({ where: eq(coursesTable.id, Number(courseId)) });
    if (!course)  { res.status(404).json({ error: "Not Found", message: "Corso non trovato" }); return; }

    let accessCode;
    if (codeId) {
      // Use existing code
      const existing = await db.query.accessCodesTable.findFirst({ where: eq(accessCodesTable.id, codeId) });
      if (!existing || !existing.isActive) {
        res.status(400).json({ error: "Bad Request", message: "Codice non valido o non attivo" });
        return;
      }
      [accessCode] = await db.update(accessCodesTable)
        .set({ assignedEmail: student.email, assignedName: student.name, boundUserId: studentId, updatedAt: new Date() })
        .where(eq(accessCodesTable.id, codeId))
        .returning();
    } else {
      // Generate new code
      let code = generateAccessCode();
      for (let i = 0; i < 10; i++) {
        const existing = await db.query.accessCodesTable.findFirst({ where: eq(accessCodesTable.code, code) });
        if (!existing) break;
        code = generateAccessCode();
      }
      [accessCode] = await db.insert(accessCodesTable).values({
        code,
        courseId:      Number(courseId),
        assignedName:  student.name,
        assignedEmail: student.email,
        boundUserId:   studentId,
        maxDevices:    1,
        maxActivations: 1,
        isActive:      true,
      }).returning();
    }

    // Send notification to student (DB + push)
    if (doNotify) {
      req.log.info({ studentId, courseId: course.id }, "[NOTIFY] assign-code dispatching notification + push");
      await dispatchNotificationToUser(studentId, {
        type:           "course_code_assigned",
        title:          `Codice di accesso: ${course.title}`,
        message:        `Il tuo codice di accesso per il corso "${course.title}" è: ${accessCode.code}. Vai nella sezione "I miei corsi" per attivarlo e accedere ai contenuti.`,
        recipientEmail: student.email,
        courseId:       course.id,
        accessCode:     accessCode.code,
        linkUrl:        "/my-courses",
      });
    }

    res.status(201).json({ success: true, accessCode });
  } catch (err) {
    req.log.error({ err }, "Admin assign code error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/accounts/:studentId/resend-code", async (req: AuthRequest, res) => {
  const studentId = parseInt(req.params.studentId);
  const { codeId } = req.body as { codeId: number };
  if (!codeId) {
    res.status(400).json({ error: "Bad Request", message: "codeId è obbligatorio" });
    return;
  }
  try {
    const student    = await db.query.studentsTable.findFirst({ where: eq(studentsTable.id, studentId) });
    const accessCode = await db.query.accessCodesTable.findFirst({ where: eq(accessCodesTable.id, codeId) });
    if (!student || !accessCode) { res.status(404).json({ error: "Not Found" }); return; }
    const course = await db.query.coursesTable.findFirst({ where: eq(coursesTable.id, accessCode.courseId) });

    req.log.info({ studentId, codeId }, "[NOTIFY] resend-code dispatching notification + push");
    await dispatchNotificationToUser(studentId, {
      type:           "code_resent",
      title:          `Codice reinviato: ${course?.title ?? "Corso"}`,
      message:        `Il tuo codice di accesso per il corso "${course?.title ?? "Corso"}" è: ${accessCode.code}. Vai nella sezione "I miei corsi" per attivarlo e accedere ai contenuti.`,
      recipientEmail: student.email,
      courseId:       accessCode.courseId,
      accessCode:     accessCode.code,
      linkUrl:        "/my-courses",
    });

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin resend code error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── DELETE account purchase (remove corso from student) ──────────────────────
router.delete("/accounts/:studentId/purchases/:purchaseId", async (req: AuthRequest, res) => {
  const studentId  = parseInt(req.params.studentId);
  const purchaseId = parseInt(req.params.purchaseId);
  const { revokeCode = false } = req.body ?? {};
  try {
    const student  = await db.query.studentsTable.findFirst({ where: eq(studentsTable.id, studentId) });
    if (!student) { res.status(404).json({ error: "Not Found", message: "Account non trovato" }); return; }

    const purchase = await db.query.coursePurchasesTable.findFirst({ where: eq(coursePurchasesTable.id, purchaseId) });
    if (!purchase) { res.status(404).json({ error: "Not Found", message: "Acquisto non trovato" }); return; }

    // Revoke/delete associated access code if requested
    if (revokeCode && purchase.accessCodeId) {
      // Remove course access record first (FK dep)
      await db.delete(studentCourseAccessTable).where(eq(studentCourseAccessTable.accessCodeId, purchase.accessCodeId));
      await db.delete(accessCodesTable).where(eq(accessCodesTable.id, purchase.accessCodeId));
    }

    await db.delete(coursePurchasesTable).where(eq(coursePurchasesTable.id, purchaseId));

    req.log.info({ studentId, purchaseId, email: student.email, revokeCode }, "[ADMIN] purchase removed from account");
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin delete purchase error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── REMOVE active course from student ────────────────────────────────────────
// Revoca un corso attivo direttamente dalla tab "Corsi" del pannello admin.
// Rimuove l'accesso da studentCourseAccess + disattiva il codice associato.
router.delete("/accounts/:studentId/active-courses/:accessId", async (req: AuthRequest, res) => {
  const studentId = parseInt(req.params.studentId);
  const accessId  = parseInt(req.params.accessId);

  req.log.info({ studentId, accessId }, "[ADMIN COURSE REMOVE] requested");

  try {
    const student = await db.query.studentsTable.findFirst({ where: eq(studentsTable.id, studentId) });
    if (!student) {
      res.status(404).json({ error: "Not Found", message: "Account non trovato" });
      return;
    }

    const access = await db.query.studentCourseAccessTable.findFirst({
      where: and(
        eq(studentCourseAccessTable.id, accessId),
        eq(studentCourseAccessTable.studentId, studentId),
      ),
    });
    if (!access) {
      res.status(404).json({ error: "Not Found", message: "Accesso al corso non trovato" });
      return;
    }

    req.log.info(
      { studentId, accessId, courseId: access.courseId, accessCodeId: access.accessCodeId, email: student.email },
      "[ADMIN COURSE REMOVE] confirmed — revoking access",
    );

    // 1. Revoca il record di accesso (soft-delete mantiene lo storico)
    await db.update(studentCourseAccessTable)
      .set({ status: "revoked", updatedAt: new Date() })
      .where(eq(studentCourseAccessTable.id, accessId));

    req.log.info({ accessId, courseId: access.courseId }, "[ADMIN COURSE REMOVE] relation removed — studentCourseAccess status=revoked");

    // 2. Disattiva il codice associato (così non può essere riusato dallo stesso utente)
    await db.update(accessCodesTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(accessCodesTable.id, access.accessCodeId));

    req.log.info({ codeId: access.accessCodeId }, "[ADMIN COURSE REMOVE] access code deactivated");

    // 3. Se lo studente non ha più corsi attivi, retrocede a "customer"
    const remainingActive = await db.query.studentCourseAccessTable.findFirst({
      where: and(
        eq(studentCourseAccessTable.studentId, studentId),
        eq(studentCourseAccessTable.status, "active"),
      ),
    });
    if (!remainingActive) {
      await db.update(studentsTable)
        .set({ role: "customer", updatedAt: new Date() })
        .where(eq(studentsTable.id, studentId));
      req.log.info({ studentId, email: student.email }, "[ADMIN COURSE REMOVE] no active courses left — role downgraded to customer");
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err, studentId, accessId }, "[ADMIN COURSE REMOVE ERROR] failed to remove course");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── REVOKE / DELETE access code from student ─────────────────────────────────
router.delete("/accounts/:studentId/access-codes/:codeId", async (req: AuthRequest, res) => {
  const studentId = parseInt(req.params.studentId);
  const codeId    = parseInt(req.params.codeId);
  const { hardDelete = false } = req.body ?? {};
  try {
    const student = await db.query.studentsTable.findFirst({ where: eq(studentsTable.id, studentId) });
    if (!student) { res.status(404).json({ error: "Not Found", message: "Account non trovato" }); return; }

    const code = await db.query.accessCodesTable.findFirst({ where: eq(accessCodesTable.id, codeId) });
    if (!code) { res.status(404).json({ error: "Not Found", message: "Codice non trovato" }); return; }

    if (hardDelete) {
      req.log.info({ studentId, codeId, code: code.code, email: student.email }, "[CODE] deleted — account-level hard delete");
      await db.delete(studentCourseAccessTable).where(eq(studentCourseAccessTable.accessCodeId, codeId));
      await db.delete(accessCodesTable).where(eq(accessCodesTable.id, codeId));
      req.log.info({ studentId, codeId, email: student.email }, "[ADMIN CODES] hard delete executed from account view");
    } else {
      await db.update(accessCodesTable)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(accessCodesTable.id, codeId));

      req.log.info({ studentId, codeId, code: code.code, email: student.email }, "[CODE] revoked from account view");

      // Revoca anche l'accesso al corso collegato a questo codice
      const revoked = await db.update(studentCourseAccessTable)
        .set({ status: "revoked", updatedAt: new Date() })
        .where(eq(studentCourseAccessTable.accessCodeId, codeId))
        .returning();

      if (revoked.length > 0) {
        req.log.info({ codeId, email: student.email, studentsAffected: revoked.length }, "[CODE] course access revoked — removed from I miei corsi");
      }
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin revoke code error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── DELETE entire student account (cascading) ────────────────────────────────
router.delete("/accounts/:studentId", async (req: AuthRequest, res) => {
  const id = parseInt(req.params.studentId);
  try {
    const student = await db.query.studentsTable.findFirst({ where: eq(studentsTable.id, id) });
    if (!student) { res.status(404).json({ error: "Not Found", message: "Account non trovato" }); return; }

    req.log.info({ studentId: id, email: student.email }, "[ADMIN] account deletion started — cascade");

    // 1. studentCourseAccess (FK to student + accessCode)
    await db.delete(studentCourseAccessTable).where(eq(studentCourseAccessTable.studentId, id));

    // 2. Push subscriptions
    await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.userId, id));

    // 3. Chat conversations (messages cascade-delete via FK)
    const convs = await db.query.chatConversationsTable.findMany({ where: eq(chatConversationsTable.userId, id) });
    for (const conv of convs) {
      await db.delete(chatMessagesTable).where(eq(chatMessagesTable.conversationId, conv.id));
    }
    await db.delete(chatConversationsTable).where(eq(chatConversationsTable.userId, id));

    // 4. Notifications
    await db.delete(notificationsTable).where(eq(notificationsTable.userId, id));

    // 5. Device sessions
    await db.delete(deviceSessionsTable).where(eq(deviceSessionsTable.userId, id));

    // 6. Access codes (revoke, don't delete, to preserve history reference)
    await db.update(accessCodesTable).set({ isActive: false, updatedAt: new Date() })
      .where(or(eq(accessCodesTable.assignedEmail, student.email), eq(accessCodesTable.boundUserId, id)));

    // 7. Course purchases — mark as deleted by clearing userId (preserve history)
    await db.update(coursePurchasesTable).set({ userId: null, updatedAt: new Date() })
      .where(eq(coursePurchasesTable.userId, id));

    // 8. passwordResetTokens: cascade deletes automatically (onDelete: cascade)

    // 9. Delete student record
    await db.delete(studentsTable).where(eq(studentsTable.id, id));

    req.log.info({ studentId: id, email: student.email }, "[ADMIN] account deleted completely");
    res.json({ success: true, deletedEmail: student.email });
  } catch (err) {
    req.log.error({ err }, "Admin delete account error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ═══════════════════════════════════════════════════════════
// ADMIN CHAT
// ═══════════════════════════════════════════════════════════

// POST /admin/chat/start — create or reopen existing conversation for a user
router.post("/chat/start", async (req: AuthRequest, res) => {
  const { userId, firstMessage } = req.body as { userId: number; firstMessage?: string };
  if (!userId) { res.status(400).json({ error: "userId obbligatorio" }); return; }

  try {
    const user = await db.query.studentsTable.findFirst({ where: eq(studentsTable.id, userId) });
    if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }

    // Check if a conversation already exists
    let conv = await db.query.chatConversationsTable.findFirst({
      where: eq(chatConversationsTable.userId, userId),
      orderBy: [desc(chatConversationsTable.createdAt)],
    });
    const isExisting = !!conv;

    if (!conv) {
      // Create new conversation
      const [created] = await db.insert(chatConversationsTable).values({
        userId,
        status:           "open",
        unreadUserCount:  0,
        unreadAdminCount: 0,
      }).returning();
      conv = created;
    } else if (conv.status === "closed") {
      // Reopen closed conversation
      await db.update(chatConversationsTable).set({ status: "open", updatedAt: new Date() })
        .where(eq(chatConversationsTable.id, conv.id));
      conv = { ...conv, status: "open" };
    }

    // Send optional first message from admin
    if (firstMessage?.trim()) {
      await db.insert(chatMessagesTable).values({
        conversationId: conv.id,
        senderType:     "admin",
        senderId:       0,
        content:        firstMessage.trim(),
      });

      await db.update(chatConversationsTable).set({
        lastMessageAt:   new Date(),
        unreadUserCount: conv.unreadUserCount + 1,
        updatedAt:       new Date(),
      }).where(eq(chatConversationsTable.id, conv.id));

      // Notify the user via centralized dispatcher (DB + push)
      dispatchNotificationToUser(userId, {
        type:           "chat_message",
        title:          "Nuovo messaggio da IUSMK",
        message:        firstMessage.trim().slice(0, 200),
        recipientEmail: user.email,
        metadata:       JSON.stringify({ conversationId: conv.id }),
        linkUrl:        "/chat",
      }).catch((err) => {
        req.log.error({ err, userId }, "[NOTIFY] dispatchNotificationToUser failed (chat/start)");
      });
    }

    res.json({
      conversation: conv,
      isExisting,
      userName:  user.name,
      userEmail: user.email,
    });
  } catch (err) {
    req.log.error({ err }, "Admin create chat error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /admin/chat/unread-count — total unread from all conversations
router.get("/chat/unread-count", async (req: AuthRequest, res) => {
  try {
    const convs = await db.query.chatConversationsTable.findMany();
    const total = convs.reduce((sum, c) => sum + c.unreadAdminCount, 0);
    res.json({ unread: total });
  } catch (err) {
    res.json({ unread: 0 });
  }
});

// GET /admin/chat/conversations — list all conversations with user info
router.get("/chat/conversations", async (req: AuthRequest, res) => {
  try {
    const convs = await db.query.chatConversationsTable.findMany({
      orderBy: [desc(chatConversationsTable.lastMessageAt)],
    });

    const result = await Promise.all(convs.map(async (conv) => {
      const user = await db.query.studentsTable.findFirst({ where: eq(studentsTable.id, conv.userId) });
      const lastMsg = await db.query.chatMessagesTable.findFirst({
        where: eq(chatMessagesTable.conversationId, conv.id),
        orderBy: [desc(chatMessagesTable.createdAt)],
      });
      return {
        ...conv,
        userName:   user?.name ?? "Utente sconosciuto",
        userEmail:  user?.email ?? "",
        lastMessage: lastMsg?.content?.slice(0, 80) ?? null,
        lastMessageSenderType: lastMsg?.senderType ?? null,
      };
    }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Admin chat conversations error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /admin/chat/:convId/messages — get messages for a conversation
router.get("/chat/:convId/messages", async (req: AuthRequest, res) => {
  const convId = parseInt(req.params.convId);
  try {
    const conv = await db.query.chatConversationsTable.findFirst({ where: eq(chatConversationsTable.id, convId) });
    if (!conv) { res.status(404).json({ error: "Conversazione non trovata" }); return; }
    const msgs = await db.query.chatMessagesTable.findMany({
      where: eq(chatMessagesTable.conversationId, convId),
      orderBy: [asc(chatMessagesTable.createdAt)],
    });
    const user = await db.query.studentsTable.findFirst({ where: eq(studentsTable.id, conv.userId) });
    res.json({ conversation: { ...conv, userName: user?.name, userEmail: user?.email }, messages: msgs });
  } catch (err) {
    req.log.error({ err }, "Admin get chat messages error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /admin/chat/:convId/reply — send admin reply
router.post("/chat/:convId/reply", async (req: AuthRequest, res) => {
  const convId = parseInt(req.params.convId);
  const { content } = req.body as { content: string };
  if (!content?.trim()) { res.status(400).json({ error: "Messaggio vuoto" }); return; }

  try {
    const conv = await db.query.chatConversationsTable.findFirst({ where: eq(chatConversationsTable.id, convId) });
    if (!conv) { res.status(404).json({ error: "Conversazione non trovata" }); return; }
    if (conv.status === "closed") { res.status(400).json({ error: "Conversazione chiusa" }); return; }

    const [msg] = await db.insert(chatMessagesTable).values({
      conversationId: convId,
      senderType:     "admin",
      senderId:       0,
      content:        content.trim(),
    }).returning();

    await db.update(chatConversationsTable).set({
      lastMessageAt:   new Date(),
      unreadUserCount: conv.unreadUserCount + 1,
      unreadAdminCount: 0,
      updatedAt:       new Date(),
    }).where(eq(chatConversationsTable.id, convId));

    // Notify the user via centralized dispatcher (DB + push)
    const user = await db.query.studentsTable.findFirst({ where: eq(studentsTable.id, conv.userId) });
    if (user) {
      dispatchNotificationToUser(conv.userId, {
        type:           "chat_message",
        title:          "Nuovo messaggio da IUSMK",
        message:        content.trim().slice(0, 200),
        recipientEmail: user.email,
        metadata:       JSON.stringify({ conversationId: convId }),
        linkUrl:        "/chat",
      }).catch((err) => {
        req.log.error({ err, userId: conv.userId, convId }, "[NOTIFY] dispatchNotificationToUser failed (chat/reply)");
      });
    }

    res.status(201).json(msg);
  } catch (err) {
    req.log.error({ err }, "Admin send chat reply error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PUT /admin/chat/:convId/status — open or close conversation
router.put("/chat/:convId/status", async (req: AuthRequest, res) => {
  const convId = parseInt(req.params.convId);
  const { status } = req.body as { status: "open" | "closed" };
  if (status !== "open" && status !== "closed") {
    res.status(400).json({ error: "status deve essere 'open' o 'closed'" }); return;
  }
  try {
    await db.update(chatConversationsTable).set({ status, updatedAt: new Date() })
      .where(eq(chatConversationsTable.id, convId));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin update chat status error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PUT /admin/chat/:convId/read — reset unread admin count
router.put("/chat/:convId/read", async (req: AuthRequest, res) => {
  const convId = parseInt(req.params.convId);
  try {
    await db.update(chatConversationsTable).set({ unreadAdminCount: 0, updatedAt: new Date() })
      .where(eq(chatConversationsTable.id, convId));
    await db.update(chatMessagesTable).set({ readAt: new Date() }).where(
      and(eq(chatMessagesTable.conversationId, convId), eq(chatMessagesTable.senderType, "user"))
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// DELETE /admin/chat/:convId — hard-delete conversation + cascaded messages + linked notifications
router.delete("/chat/:convId", async (req: AuthRequest, res) => {
  const convId = parseInt(req.params.convId);
  if (isNaN(convId)) { res.status(400).json({ error: "ID non valido" }); return; }
  try {
    // Verify conversation exists before deleting
    const conv = await db.query.chatConversationsTable.findFirst({
      where: eq(chatConversationsTable.id, convId),
    });
    if (!conv) { res.status(404).json({ error: "Conversazione non trovata" }); return; }

    // Delete in-app notifications linked to this conversation (both admin + customer side).
    // Metadata is JSON stored as text, so we use a LIKE match on conversationId.
    await db.delete(notificationsTable).where(
      sql`metadata::text LIKE ${"%" + `"conversationId":${convId}` + "%"}`
    );

    // Delete conversation — chatMessages cascade automatically (onDelete: "cascade")
    await db.delete(chatConversationsTable).where(eq(chatConversationsTable.id, convId));

    req.log.info({ convId }, "Admin deleted chat conversation");
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin delete chat error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/push/vapid-public-key", (req, res) => {
  const key = getVapidPublicKey();
  req.log.info({ hasKey: !!key }, "[PUSH] Admin requested VAPID public key");
  res.json({ publicKey: key });
});

router.post("/push/subscribe", async (req: AuthRequest, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: "Bad Request", message: "Invalid subscription object" });
    return;
  }
  try {
    const userAgent = req.headers["user-agent"] ?? null;
    await saveSubscription({ endpoint, keys }, null, "admin", userAgent);
    req.log.info({ endpoint: endpoint.slice(0, 60) + "…" }, "[PUSH] Admin subscription saved");
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "[PUSH] Save admin push subscription error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/push/subscribe", async (req: AuthRequest, res) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    res.status(400).json({ error: "Bad Request", message: "endpoint required" });
    return;
  }
  try {
    await deleteSubscription(endpoint);
    req.log.info({ endpoint: endpoint.slice(0, 60) + "…" }, "[PUSH] Admin subscription removed");
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "[PUSH] Delete admin push subscription error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /admin/accounts/:userId/push-status — push subscription info for a customer
router.get("/accounts/:userId/push-status", async (req: AuthRequest, res) => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }
  try {
    const stats = await getUserPushStats(userId);
    res.json(stats);
  } catch (err) {
    req.log.error({ err, userId }, "[PUSH] Get user push stats error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ═══════════════════════════════════════════════════════════
// ADMIN BROADCAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════

router.post("/broadcast/send", async (req: AuthRequest, res) => {
  const {
    mode,
    courseId,
    userIds,
    excludeIds,
    title,
    message,
    url,
    imageUrl,
    videoUrl,
    type: notifType,
  } = req.body as {
    mode:        "all" | "with_courses" | "specific_course" | "manual";
    courseId?:   number;
    userIds?:    number[];
    excludeIds?: number[];
    title:       string;
    message:     string;
    url?:        string;
    imageUrl?:   string;
    videoUrl?:   string;
    type?:       string;
  };

  if (!title?.trim() || !message?.trim()) {
    res.status(400).json({ error: "Titolo e messaggio sono obbligatori" }); return;
  }
  if (!["all","with_courses","specific_course","manual"].includes(mode)) {
    res.status(400).json({ error: "Modalità non valida" }); return;
  }

  try {
    // 1. Resolve target user IDs
    const allUsers = await db.query.studentsTable.findMany({ columns: { id: true, name: true, email: true } });

    let targetIds: number[];
    if (mode === "all") {
      targetIds = allUsers.map(u => u.id);
    } else if (mode === "with_courses") {
      const purchases = await db.select({ userId: coursePurchasesTable.userId }).from(coursePurchasesTable)
        .where(eq(coursePurchasesTable.status, "completed"));
      const withCourses = new Set(purchases.map(p => p.userId).filter(Boolean) as number[]);
      targetIds = allUsers.map(u => u.id).filter(id => withCourses.has(id));
    } else if (mode === "specific_course") {
      if (!courseId) { res.status(400).json({ error: "courseId obbligatorio per questa modalità" }); return; }
      const purchases = await db.select({ userId: coursePurchasesTable.userId }).from(coursePurchasesTable)
        .where(and(eq(coursePurchasesTable.courseId, Number(courseId)), eq(coursePurchasesTable.status, "completed")));
      targetIds = (purchases.map(p => p.userId).filter(Boolean) as number[]);
    } else {
      targetIds = Array.isArray(userIds) ? userIds.map(Number) : [];
    }

    // 2. Apply exclusions
    const excluded = new Set(Array.isArray(excludeIds) ? excludeIds.map(Number) : []);
    const finalIds = [...new Set(targetIds)].filter(id => !excluded.has(id));

    if (finalIds.length === 0) {
      res.json({ success: true, matched: 0, excluded: excluded.size, sent: 0, pushFailed: 0 }); return;
    }

    req.log.info(
      { count: finalIds.length, type: notifType || "broadcast", hasImage: !!imageUrl, hasVideo: !!videoUrl },
      "[NOTIFY] Admin broadcast dispatching"
    );

    // 3. Dispatch via centralized service (DB + push)
    const { saved, sent, failed } = await dispatchBroadcast(finalIds, {
      type:     notifType || "broadcast",
      title:    title.trim(),
      message:  message.trim(),
      linkUrl:  url?.trim() || null,
      imageUrl: imageUrl?.trim() || null,
      videoUrl: videoUrl?.trim() || null,
      metadata: url ? JSON.stringify({ url }) : null,
    });

    res.json({
      success:    true,
      matched:    finalIds.length,
      excluded:   excluded.size,
      sent,
      pushFailed: failed,
    });
  } catch (err) {
    req.log.error({ err }, "Admin broadcast error");
    res.status(500).json({ error: "Errore durante l'invio" });
  }
});

// GET /admin/broadcast/courses — list courses for filter
router.get("/broadcast/courses", async (req: AuthRequest, res) => {
  try {
    const courses = await db.query.coursesTable.findMany({
      columns: { id: true, title: true },
      orderBy: [asc(coursesTable.title)],
    });
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── Payment Links CRUD ───────────────────────────────────────────────────────

router.get("/payment-links", async (req: AuthRequest, res) => {
  try {
    const links = await db.query.paymentLinksTable.findMany({
      orderBy: (t, { desc: d }) => [d(t.createdAt)],
    });
    res.json(links);
  } catch (err) {
    req.log.error({ err }, "Get payment links error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/payment-links", async (req: AuthRequest, res) => {
  const { name, paymentLinkUrl, paymentLinkId, amount, notes } = req.body;
  if (!name || !paymentLinkUrl || !paymentLinkId) {
    res.status(400).json({ error: "Bad Request", message: "name, paymentLinkUrl e paymentLinkId sono obbligatori" });
    return;
  }
  try {
    const [link] = await db.insert(paymentLinksTable).values({
      name: name.trim(),
      paymentLinkUrl: paymentLinkUrl.trim(),
      paymentLinkId: paymentLinkId.trim(),
      amount: amount ? parseFloat(amount) : null,
      notes: notes?.trim() || null,
    }).returning();
    // Enable promotion codes on this Stripe Payment Link (non-blocking)
    enablePromoCodesOnPaymentLink(paymentLinkId.trim()).catch(() => {});
    res.status(201).json(link);
  } catch (err) {
    req.log.error({ err }, "Create payment link error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/payment-links/:id", async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, paymentLinkUrl, paymentLinkId, amount, notes } = req.body;
  if (!name || !paymentLinkUrl || !paymentLinkId) {
    res.status(400).json({ error: "Bad Request", message: "name, paymentLinkUrl e paymentLinkId sono obbligatori" });
    return;
  }
  try {
    const [link] = await db.update(paymentLinksTable).set({
      name: name.trim(),
      paymentLinkUrl: paymentLinkUrl.trim(),
      paymentLinkId: paymentLinkId.trim(),
      amount: amount ? parseFloat(amount) : null,
      notes: notes?.trim() || null,
      updatedAt: new Date(),
    }).where(eq(paymentLinksTable.id, parseInt(id))).returning();
    if (!link) { res.status(404).json({ error: "Not Found" }); return; }
    // Enable promotion codes on this Stripe Payment Link (non-blocking)
    enablePromoCodesOnPaymentLink(paymentLinkId.trim()).catch(() => {});
    res.json(link);
  } catch (err) {
    req.log.error({ err }, "Update payment link error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/payment-links/:id", async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    await db.delete(paymentLinksTable).where(eq(paymentLinksTable.id, parseInt(id)));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Delete payment link error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /admin/broadcast/accounts — searchable user list for broadcast
router.get("/broadcast/accounts", async (req: AuthRequest, res) => {
  const q = String(req.query.search ?? "").trim();
  try {
    const users = await db.query.studentsTable.findMany({
      columns: { id: true, name: true, email: true },
      where: q ? or(ilike(studentsTable.name, `%${q}%`), ilike(studentsTable.email, `%${q}%`)) : undefined,
      limit: 50,
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
