import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { academyCategoriesTable, coursesTable } from "@workspace/db/schema";
import { eq, and, asc } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/academy-categories — lista categorie attive
router.get("/", async (req, res) => {
  try {
    const categories = await db.query.academyCategoriesTable.findMany({
      where: eq(academyCategoriesTable.isActive, true),
      orderBy: [asc(academyCategoriesTable.orderIndex), asc(academyCategoriesTable.id)],
    });
    res.json(categories);
  } catch (err) {
    req.log.error({ err }, "List academy categories error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/academy-categories/:id — dettaglio categoria + video corsi collegati
router.get("/:categoryId", async (req, res) => {
  const { categoryId } = req.params;
  try {
    const category = await db.query.academyCategoriesTable.findFirst({
      where: and(
        eq(academyCategoriesTable.id, parseInt(categoryId)),
        eq(academyCategoriesTable.isActive, true),
      ),
    });
    if (!category) {
      res.status(404).json({ error: "Not Found", message: "Categoria non trovata" });
      return;
    }

    // Corsi pubblici collegati a questa categoria
    const courses = await db.query.coursesTable.findMany({
      where: and(
        eq(coursesTable.academyCategoryId, category.id),
        eq(coursesTable.isPublished, true),
        eq(coursesTable.isArchived, false),
      ),
      orderBy: [asc(coursesTable.id)],
    });

    res.json({ ...category, courses });
  } catch (err) {
    req.log.error({ err }, "Get academy category error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;