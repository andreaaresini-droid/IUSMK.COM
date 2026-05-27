import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { studentsTable } from "./students";

export const chatConversationsTable = pgTable("chat_conversations", {
  id:                    serial("id").primaryKey(),
  userId:                integer("user_id").notNull().references(() => studentsTable.id),
  status:                text("status").notNull().default("open"),
  lastMessageAt:         timestamp("last_message_at").defaultNow(),
  unreadUserCount:       integer("unread_user_count").notNull().default(0),
  unreadAdminCount:      integer("unread_admin_count").notNull().default(0),
  lastReopenRequestAt:   timestamp("last_reopen_request_at"),
  createdAt:             timestamp("created_at").notNull().defaultNow(),
  updatedAt:             timestamp("updated_at").notNull().defaultNow(),
});

export const insertChatConversationSchema = createInsertSchema(chatConversationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertChatConversation = z.infer<typeof insertChatConversationSchema>;
export type ChatConversation = typeof chatConversationsTable.$inferSelect;
