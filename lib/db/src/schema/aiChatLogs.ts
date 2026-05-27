import { pgTable, serial, text, real, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const aiChatLogsTable = pgTable("ai_chat_logs", {
  id:                   serial("id").primaryKey(),
  sessionId:            varchar("session_id", { length: 128 }).notNull().default(""),
  userMessage:          text("user_message").notNull(),
  aiReply:              text("ai_reply").notNull().default(""),
  sourceKnowledgeIds:   text("source_knowledge_ids").notNull().default(""),  // JSON array as text
  confidenceScore:      real("confidence_score").notNull().default(0),
  usedFallback:         boolean("used_fallback").notNull().default(false),
  escalatedToAdmin:     boolean("escalated_to_admin").notNull().default(false),
  pageUrl:              varchar("page_url", { length: 500 }).default(""),
  ipAddress:            varchar("ip_address", { length: 64 }).default(""),
  createdAt:            timestamp("created_at").defaultNow().notNull(),
});

export const insertAiChatLogSchema = createInsertSchema(aiChatLogsTable);
export const selectAiChatLogSchema = createSelectSchema(aiChatLogsTable);

export type AiChatLog       = z.infer<typeof selectAiChatLogSchema>;
export type InsertAiChatLog = z.infer<typeof insertAiChatLogSchema>;
