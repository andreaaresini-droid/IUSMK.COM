import { pgTable, serial, text, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { coursesTable } from "./courses";
import { discountCodesTable } from "./discountCodes";
import { studentsTable } from "./students";
import { courseModulesTable } from "./courseModules";

export const coursePurchasesTable = pgTable("course_purchases", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull().references(() => coursesTable.id),
  moduleId: integer("module_id").references(() => courseModulesTable.id),
  userId: integer("user_id").references(() => studentsTable.id),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  amountPaid: real("amount_paid").notNull(),
  currency: text("currency").notNull().default("eur"),
  discountCodeId: integer("discount_code_id").references(() => discountCodesTable.id),
  discountAmount: real("discount_amount").notNull().default(0),
  stripeSessionId: text("stripe_session_id").unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  status: text("status").notNull().default("pending"),
  accessCodeId: integer("access_code_id"),
  accessCode: text("access_code"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCoursePurchaseSchema = createInsertSchema(coursePurchasesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCoursePurchase = z.infer<typeof insertCoursePurchaseSchema>;
export type CoursePurchase = typeof coursePurchasesTable.$inferSelect;
