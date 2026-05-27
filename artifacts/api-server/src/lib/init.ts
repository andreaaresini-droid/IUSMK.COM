import { db } from "@workspace/db";
import { adminsTable, coursesTable, courseModulesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { simpleHash } from "./auth";
import { logger } from "./logger";

export async function initializeDatabase(): Promise<void> {
  try {
    const existingAdmin = await db.query.adminsTable.findFirst();
    if (!existingAdmin) {
      await db.insert(adminsTable).values({
        username: "iusmk",
        passwordHash: simpleHash("iusmk123!"),
        name: "IUSMK",
        email: "iusmkbarber@gmail.com",
        isActive: true,
      });
      logger.info("Admin account created");
    } else if (existingAdmin.username !== "iusmk") {
      await db
        .update(adminsTable)
        .set({
          username: "iusmk",
          passwordHash: simpleHash("iusmk123!"),
          isActive: true,
        })
        .where(eq(adminsTable.id, existingAdmin.id));
      logger.info("Admin account updated");
    }

    const existingCourse = await db.query.coursesTable.findFirst();
    if (!existingCourse) {
      const [course] = await db
        .insert(coursesTable)
        .values({
          title: "taglio",
          slug: "taglio",
          description:
            "Il corso professionale sul taglio maschile firmato IUSMK. Tecniche, stili e segreti del barbiere artista.",
          shortDescription: "Taglio maschile professionale — tecniche e stile IUSMK.",
          level: "intermediate",
          durationHours: 4,
          thumbnailUrl: "/api/uploads/98bc3cd2ad2245deb3e8ffad1f019599.jpeg",
          price: 300,
          isPublished: true,
          whatYouLearn: [
            "Tecniche di taglio maschile professionali",
            "Sfumatura e degradé",
            "Stili e tendenze attuali",
            "Gestione del cliente",
          ],
          requirements: ["Forbici e macchinette base", "Voglia di imparare"],
        })
        .returning();

      await db.insert(courseModulesTable).values({
        courseId: course.id,
        title: "taglio",
        description: "Modulo principale del corso taglio",
        orderIndex: 0,
        durationMinutes: 240,
        isPreview: false,
      });

      logger.info("Initial course created");
    }
  } catch (err) {
    logger.error({ err }, "Database initialization error");
  }
}
