import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { coursesTable, courseModulesTable, academyCategoriesTable } from "@workspace/db/schema";
import { eq, and, asc } from "drizzle-orm";

const router: IRouter = Router();

// ── Corsi pubblici ────────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  try {
    const courses = await db.query.coursesTable.findMany({
      where: (c, { and, eq }) => and(eq(c.isPublished, true), eq(c.isArchived, false)),
      orderBy: (c, { asc }) => [asc(c.id)],
    });
    res.json(courses);
  } catch (err) {
    req.log.error({ err }, "List courses error");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch courses" });
  }
});

router.get("/:courseId", async (req, res) => {
  const { courseId } = req.params;
  try {
    const course = await db.query.coursesTable.findFirst({
      where: eq(coursesTable.id, parseInt(courseId)),
    });
    if (!course || !course.isPublished) {
      res.status(404).json({ error: "Not Found", message: "Course not found" });
      return;
    }

    const modules = await db.query.courseModulesTable.findMany({
      where: eq(courseModulesTable.courseId, course.id),
      orderBy: (m, { asc }) => [asc(m.orderIndex)],
    });

    const publicModules = modules.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      orderIndex: m.orderIndex,
      durationMinutes: m.durationMinutes,
      isPreview: m.isPreview,
      price: m.price,
      thumbnailUrl: m.thumbnailUrl,
      paymentLinkUrl: m.paymentLinkUrl,
    }));

    res.json({ ...course, modules: publicModules });
  } catch (err) {
    req.log.error({ err }, "Get course error");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch course" });
  }
});

export default router;
