import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { testimonialsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const testimonials = await db.query.testimonialsTable.findMany({
      where: eq(testimonialsTable.isPublished, true),
      orderBy: (t: any, { desc }: any) => [desc(t.createdAt)],
    });
    res.json(testimonials);
  } catch (err) {
    req.log.error({ err }, "List testimonials error");
    res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch testimonials" });
  }
});

export default router;
