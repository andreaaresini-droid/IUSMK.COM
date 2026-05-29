import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { galleryTable, galleryCategoriesTable } from "@workspace/db/schema";
import { eq, and, asc, sql } from "drizzle-orm";

const router: IRouter = Router();

const PAGE_SIZE = 12;

router.get("/categories", async (_req, res) => {
  try {
    const cats = await db.query.galleryCategoriesTable.findMany({
      orderBy: [asc(galleryCategoriesTable.orderIndex)],
    });
    res.json(cats);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch categories" });
  }
});

// GET /api/gallery?category=slug&limit=12&offset=0
// Returns { items: [...], total: N, hasMore: boolean }
router.get("/", async (req, res) => {
  const { category } = req.query as { category?: string };
  const limit  = Math.min(parseInt((req.query.limit  as string) || String(PAGE_SIZE), 10), 48);
  const offset = Math.max(parseInt((req.query.offset as string) || "0",               10), 0);

  try {
    const whereClause = category ? eq(galleryTable.category, category) : undefined;

    const [items, countResult] = await Promise.all([
      db.query.galleryTable.findMany({
        where: whereClause,
        orderBy: (g, { asc }) => [asc(g.orderIndex)],
        limit,
        offset,
      }),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(galleryTable)
        .where(whereClause ?? sql`1=1`),
    ]);

    const total   = countResult[0]?.count ?? 0;
    const hasMore = offset + items.length < total;

    res.json({ items, total, hasMore, limit, offset });
  } catch (err) {
    req.log.error({ err }, "List gallery error");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch gallery" });
  }
});

export default router;