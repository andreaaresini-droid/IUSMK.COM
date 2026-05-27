import { pgTable, serial, text, timestamp, boolean, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { coursesTable } from "./courses";

export const courseModulesTable = pgTable("course_modules", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull().references(() => coursesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  orderIndex: integer("order_index").notNull().default(0),
  durationMinutes: integer("duration_minutes"),
  videoUrl: text("video_url"),
  videoAssetId: text("video_asset_id"),
  isPreview: boolean("is_preview").notNull().default(false),

  // ── Campi per lezioni acquistabili singolarmente ───────────────────────────
  price:          real("price"),
  thumbnailUrl:   text("thumbnail_url"),
  paymentLinkUrl: text("payment_link_url"),
  paymentLinkId:  text("payment_link_id"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCourseModuleSchema = createInsertSchema(courseModulesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCourseModule = z.infer<typeof insertCourseModuleSchema>;
export type CourseModule = typeof courseModulesTable.$inferSelect;
