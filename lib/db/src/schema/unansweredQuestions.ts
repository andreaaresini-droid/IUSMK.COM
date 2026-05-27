import { pgTable, serial, integer, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const unansweredQuestionsTable = pgTable("unanswered_questions", {
  id:                    serial("id").primaryKey(),
  question:              text("question").notNull(),
  normalizedQuestion:    text("normalized_question").notNull(),
  pageUrl:               varchar("page_url", { length: 500 }).default(""),
  customerSessionId:     varchar("customer_session_id", { length: 128 }).default(""),
  customerName:          varchar("customer_name", { length: 120 }).default(""),
  customerEmail:         varchar("customer_email", { length: 254 }).default(""),
  aiFallbackMessage:     text("ai_fallback_message").default(""),
  status:                varchar("status", { length: 20 }).notNull().default("new"),
  adminAnswer:           text("admin_answer").default(""),
  linkedKnowledgeItemId: integer("linked_knowledge_item_id"),
  occurrences:           integer("occurrences").notNull().default(1),
  lastAskedAt:           timestamp("last_asked_at").defaultNow().notNull(),
  handledBy:             varchar("handled_by", { length: 100 }).default(""),
  createdAt:             timestamp("created_at").defaultNow().notNull(),
  updatedAt:             timestamp("updated_at").defaultNow().notNull(),
});

export const insertUnansweredQuestionSchema = createInsertSchema(unansweredQuestionsTable);
export const selectUnansweredQuestionSchema = createSelectSchema(unansweredQuestionsTable);

export type UnansweredQuestion       = z.infer<typeof selectUnansweredQuestionSchema>;
export type InsertUnansweredQuestion = z.infer<typeof insertUnansweredQuestionSchema>;
