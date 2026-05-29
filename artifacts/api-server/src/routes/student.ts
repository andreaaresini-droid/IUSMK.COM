import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  studentsTable,
  accessCodesTable,
  courseModulesTable,
  videoProgressTable,
  studentCourseAccessTable,
  coursesTable,
  videoDisclaimerAcksTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/authMiddleware.js";
import { generateVideoToken } from "../lib/auth.js";

const router: IRouter = Router();
router.use(requireAuth as any);

router.get("/courses", async (req: AuthRequest, res) => {
  try {
    const student = await db.query.studentsTable.findFirst({
      where: eq(studentsTable.id, req.userId!),
    });
    if (!student) { res.json([]); return; }

    const accessEntries = await db.query.studentCourseAccessTable.findMany({
      where: and(
        eq(studentCourseAccessTable.studentId, student.id),
        eq(studentCourseAccessTable.status, "active"),
      ),
    });

    if (accessEntries.length === 0) { res.json([]); return; }

    const progressRecords = await db.query.videoProgressTable.findMany({
      where: eq(videoProgressTable.studentId, student.id),
    });
    const progressMap = new Map(progressRecords.map((p) => [p.moduleId, p]));

    const courses = await Promise.all(
      accessEntries.map(async (entry) => {
        const course = await db.query.coursesTable.findFirst({
          where: eq(coursesTable.id, entry.courseId),
        });
        if (!course) return null;

        const accessCode = await db.query.accessCodesTable.findFirst({
          where: eq(accessCodesTable.id, entry.accessCodeId),
        });

        let modules = await db.query.courseModulesTable.findMany({
          where: eq(courseModulesTable.courseId, course.id),
          orderBy: [asc(courseModulesTable.orderIndex)],
        });

        if (modules.length === 0 && course.videoUrl) {
          const [created] = await db.insert(courseModulesTable).values({
            courseId: course.id,
            title: course.title,
            description: course.description || null,
            orderIndex: 0,
            videoUrl: course.videoUrl,
            durationMinutes: course.durationHours ? course.durationHours * 60 : null,
            isPreview: false,
          }).returning();
          modules = [created];
        }

        const completedCount = modules.filter((m) => progressMap.get(m.id)?.completed).length;
        const progress = modules.length > 0 ? (completedCount / modules.length) * 100 : 0;

        const studentModules = modules.map((m) => {
          const prog = progressMap.get(m.id);
          return { ...m, completed: prog?.completed || false, progressSeconds: prog?.progressSeconds || 0 };
        });

        return {
          ...course,
          modules: studentModules,
          expiresAt: accessCode?.expiresAt || null,
          progress,
          accessCodeId: entry.accessCodeId,
        };
      })
    );

    res.json(courses.filter(Boolean));
  } catch (err) {
    req.log.error({ err }, "Get student courses error");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch courses" });
  }
});

router.get("/courses/:courseId/modules/:moduleId/video", async (req: AuthRequest, res) => {
  try {
    const { courseId, moduleId } = req.params;

    const student = await db.query.studentsTable.findFirst({
      where: eq(studentsTable.id, req.userId!),
    });
    if (!student) {
      res.status(403).json({ error: "Forbidden", message: "Studente non trovato" });
      return;
    }

    const courseAccess = await db.query.studentCourseAccessTable.findFirst({
      where: and(
        eq(studentCourseAccessTable.studentId, student.id),
        eq(studentCourseAccessTable.courseId, parseInt(courseId)),
        eq(studentCourseAccessTable.status, "active"),
      ),
    });

    if (!courseAccess) {
      res.status(403).json({ error: "Forbidden", message: "Nessun accesso a questo corso" });
      return;
    }

    const accessCode = await db.query.accessCodesTable.findFirst({
      where: eq(accessCodesTable.id, courseAccess.accessCodeId),
    });

    if (!accessCode || !accessCode.isActive) {
      res.status(403).json({ error: "Forbidden", message: "Accesso revocato" });
      return;
    }

    if (accessCode.expiresAt && accessCode.expiresAt < new Date()) {
      res.status(403).json({ error: "Forbidden", message: "Accesso scaduto" });
      return;
    }

    const module = await db.query.courseModulesTable.findFirst({
      where: eq(courseModulesTable.id, parseInt(moduleId)),
    });

    if (!module) {
      res.status(404).json({ error: "Not Found", message: "Modulo non trovato" });
      return;
    }

    const course = await db.query.coursesTable.findFirst({
      where: eq(coursesTable.id, parseInt(courseId)),
    });

    const resolvedVideoUrl = module.videoUrl || course?.videoUrl || null;

    if (!resolvedVideoUrl) {
      res.json({ streamUrl: null, watermarkName: student.name, watermarkEmail: student.email });
      return;
    }

    let videoPath: string;
    if (resolvedVideoUrl.startsWith("/api/gallery/video/")) {
      // Videos uploaded via signed-URL flow — stored as GCS object "uploads/{uuid}"
      videoPath = resolvedVideoUrl.replace(/^\/api\/gallery\/video\//, "");
    } else if (resolvedVideoUrl.startsWith("/api/storage/objects/")) {
      videoPath = resolvedVideoUrl.replace(/^\/api\/storage\/objects\//, "");
    } else {
      videoPath = resolvedVideoUrl.replace(/^\/api\/uploads\//, "");
    }

    const streamToken = generateVideoToken({
      studentId: student.id,
      courseId: parseInt(courseId),
      moduleId: parseInt(moduleId),
      videoPath,
    });

    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

    res.json({
      streamUrl: `/api/video/stream?token=${streamToken}`,
      watermarkName: student.name,
      watermarkEmail: student.email,
      expiresAt,
    });
  } catch (err) {
    req.log.error({ err }, "Get video token error");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to get video access" });
  }
});

router.get("/disclaimer/:courseId", async (req: AuthRequest, res) => {
  try {
    const courseId = parseInt(req.params.courseId);
    if (isNaN(courseId)) { res.status(400).json({ error: "Bad Request" }); return; }

    const ack = await db.query.videoDisclaimerAcksTable.findFirst({
      where: and(
        eq(videoDisclaimerAcksTable.studentId, req.userId!),
        eq(videoDisclaimerAcksTable.courseId, courseId),
      ),
    });

    const acknowledged = !!ack;
    console.log(`[DISCLAIMER] GET courseId=${courseId} studentId=${req.userId} acknowledged=${acknowledged}`);
    res.json({ acknowledged });
  } catch (err) {
    req.log.error({ err }, "Get disclaimer ack error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/disclaimer/:courseId", async (req: AuthRequest, res) => {
  try {
    const courseId = parseInt(req.params.courseId);
    if (isNaN(courseId)) { res.status(400).json({ error: "Bad Request" }); return; }

    const existing = await db.query.videoDisclaimerAcksTable.findFirst({
      where: and(
        eq(videoDisclaimerAcksTable.studentId, req.userId!),
        eq(videoDisclaimerAcksTable.courseId, courseId),
      ),
    });

    if (!existing) {
      await db.insert(videoDisclaimerAcksTable).values({
        studentId: req.userId!,
        courseId,
      });
      console.log(`[DISCLAIMER] SAVED — studentId=${req.userId} courseId=${courseId} — popup confermato e stato salvato correttamente`);
    } else {
      console.log(`[DISCLAIMER] già confermato — studentId=${req.userId} courseId=${courseId} (nessuna duplicazione)`);
    }

    res.json({ acknowledged: true });
  } catch (err) {
    req.log.error({ err }, "Save disclaimer ack error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/progress", async (req: AuthRequest, res) => {
  const { moduleId, progressSeconds, completed } = req.body;
  if (!moduleId || progressSeconds == null) {
    res.status(400).json({ error: "Bad Request", message: "moduleId e progressSeconds sono obbligatori" });
    return;
  }

  try {
    const existing = await db.query.videoProgressTable.findFirst({
      where: and(
        eq(videoProgressTable.studentId, req.userId!),
        eq(videoProgressTable.moduleId, parseInt(moduleId)),
      ),
    });

    if (existing) {
      await db.update(videoProgressTable).set({
        progressSeconds,
        completed: completed || false,
        updatedAt: new Date(),
      }).where(eq(videoProgressTable.id, existing.id));
    } else {
      await db.insert(videoProgressTable).values({
        studentId: req.userId!,
        moduleId: parseInt(moduleId),
        progressSeconds,
        completed: completed || false,
      });
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Update progress error");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to update progress" });
  }
});

export default router;