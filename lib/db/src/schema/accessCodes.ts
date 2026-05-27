import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { coursesTable } from "./courses";
import { studentsTable } from "./students";

export const accessCodesTable = pgTable("access_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  courseId: integer("course_id").notNull().references(() => coursesTable.id),
  assignedName: text("assigned_name"),
  assignedEmail: text("assigned_email"),
  isActive: boolean("is_active").notNull().default(true),
  maxDevices: integer("max_devices").notNull().default(1),
  maxActivations: integer("max_activations").notNull().default(1),
  expiresAt: timestamp("expires_at"),
  boundUserId: integer("bound_user_id").references(() => studentsTable.id),
  activatedAt: timestamp("activated_at"),
  notes: text("notes"),
  notificationSentAt: timestamp("notification_sent_at"),
  notificationSentCount: integer("notification_sent_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAccessCodeSchema = createInsertSchema(accessCodesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAccessCode = z.infer<typeof insertAccessCodeSchema>;
export type AccessCode = typeof accessCodesTable.$inferSelect;
