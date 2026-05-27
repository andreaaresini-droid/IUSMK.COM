import { pgTable, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { studentsTable } from "./students";
import { courseModulesTable } from "./courseModules";

export const videoProgressTable = pgTable("video_progress", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id),
  moduleId: integer("module_id").notNull().references(() => courseModulesTable.id, { onDelete: "cascade" }),
  progressSeconds: integer("progress_seconds").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertVideoProgressSchema = createInsertSchema(videoProgressTable).omit({ id: true, updatedAt: true });
export type InsertVideoProgress = z.infer<typeof insertVideoProgressSchema>;
export type VideoProgress = typeof videoProgressTable.$inferSelect;
