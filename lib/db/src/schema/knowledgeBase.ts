import { pgTable, serial, text, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const knowledgeBaseTable = pgTable("knowledge_base", {
  id:            serial("id").primaryKey(),
  title:         varchar("title", { length: 255 }).notNull(),
  content:       text("content").notNull(),
  category:      varchar("category", { length: 100 }).notNull().default("generale"),
  keywords:      text("keywords").default(""),
  sourceType:    varchar("source_type", { length: 50 }).notNull().default("manual_entry"),
  sourcePath:    varchar("source_path", { length: 500 }).default(""),
  isPublished:   boolean("is_published").notNull().default(true),
  isActive:      boolean("is_active").notNull().default(true),
  createdBy:     varchar("created_by", { length: 100 }).default("admin"),
  lastUpdatedBy: varchar("last_updated_by", { length: 100 }).default("admin"),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
  updatedAt:     timestamp("updated_at").defaultNow().notNull(),
});

export const insertKnowledgeBaseSchema = createInsertSchema(knowledgeBaseTable, {
  title:    (s) => s.min(2).max(255),
  content:  (s) => s.min(5),
  category: (s) => s.min(1).max(100),
});
export const selectKnowledgeBaseSchema = createSelectSchema(knowledgeBaseTable);

export type KnowledgeBase       = z.infer<typeof selectKnowledgeBaseSchema>;
export type InsertKnowledgeBase = z.infer<typeof insertKnowledgeBaseSchema>;
