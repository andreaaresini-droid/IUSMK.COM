import { pgTable, serial, text, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const academyCategoriesTable = pgTable("academy_categories", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  thumbnailUrl: text("thumbnail_url"),
  shortDescription: text("short_description"),
  fullDescription: text("full_description"),
  trailerVideoUrl: text("trailer_video_url"),
  trailerPosterUrl: text("trailer_poster_url"),
  galleryImages: jsonb("gallery_images").$type<string[]>().default([]),
  whatYouWillLearn: jsonb("what_you_will_learn").$type<string[]>().default([]),
  orderIndex: integer("order_index").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAcademyCategorySchema = createInsertSchema(academyCategoriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAcademyCategory = z.infer<typeof insertAcademyCategorySchema>;
export type AcademyCategory = typeof academyCategoriesTable.$inferSelect;
