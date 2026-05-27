import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().default("generic_notification"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  recipientEmail: text("recipient_email"),
  userId: integer("user_id"),
  courseId: integer("course_id"),
  accessCode: text("access_code"),
  isAdminNotification: boolean("is_admin_notification").notNull().default(false),
  isRead: boolean("is_read").notNull().default(false),
  metadata: text("metadata"),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  linkUrl: text("link_url"),
  pushSent: boolean("push_sent").notNull().default(false),
  pushSentAt: timestamp("push_sent_at"),
  pushError: text("push_error"),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
