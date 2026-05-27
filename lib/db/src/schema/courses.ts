import { pgTable, serial, text, timestamp, boolean, real, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { academyCategoriesTable } from "./academyCategories";

export const coursesTable = pgTable("courses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  shortDescription: text("short_description"),
  level: text("level").notNull().default("beginner"),
  durationHours: real("duration_hours"),
  thumbnailUrl: text("thumbnail_url"),
  videoUrl: text("video_url"),
  price: real("price"),
  isPublished: boolean("is_published").notNull().default(false),
  isArchived:  boolean("is_archived").notNull().default(false),
  paymentLinkUrl: text("payment_link_url"),
  paymentLinkId: text("payment_link_id"),
  whatYouLearn: jsonb("what_you_learn").$type<string[]>().default([]),
  requirements: jsonb("requirements").$type<string[]>().default([]),

  // Categoria Academy di appartenenza (opzionale per retrocompatibilità)
  academyCategoryId: integer("academy_category_id").references(() => academyCategoriesTable.id, { onDelete: "set null" }),

  // ── Dettagli per la pagina di dettaglio corso ─────────────────────────────
  fullDescription:  text("full_description"),
  whatYouWillLearn: jsonb("what_you_will_learn").$type<string[]>().default([]),
  targetAudience:   jsonb("target_audience").$type<string[]>().default([]),
  includedContent:  jsonb("included_content").$type<string[]>().default([]),
  promoText:        text("promo_text"),
  galleryImages:    jsonb("gallery_images").$type<string[]>().default([]),
  trailerVideoUrl:      text("trailer_video_url"),
  trailerPosterUrl:     text("trailer_poster_url"),
  additionalInfo:       text("additional_info"),
  backgroundImageUrl:   text("background_image_url"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCourseSchema = createInsertSchema(coursesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type Course = typeof coursesTable.$inferSelect;
