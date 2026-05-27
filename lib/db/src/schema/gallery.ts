import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const galleryCategoriesTable = pgTable("gallery_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const galleryTable = pgTable("gallery", {
  id: serial("id").primaryKey(),
  imageUrl: text("image_url").notNull(),
  title: text("title"),
  category: text("category").notNull().default("freestyle"),
  mediaType: text("media_type").notNull().default("image"),
  thumbnailUrl: text("thumbnail_url"),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertGallerySchema = createInsertSchema(galleryTable).omit({ id: true, createdAt: true });
export type InsertGallery = z.infer<typeof insertGallerySchema>;
export type Gallery = typeof galleryTable.$inferSelect;

export const insertGalleryCategorySchema = createInsertSchema(galleryCategoriesTable).omit({ id: true, createdAt: true });
export type InsertGalleryCategory = z.infer<typeof insertGalleryCategorySchema>;
export type GalleryCategory = typeof galleryCategoriesTable.$inferSelect;
