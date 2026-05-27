import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { studentsTable } from "./students";
import { accessCodesTable } from "./accessCodes";

export const deviceSessionsTable = pgTable("device_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => studentsTable.id),
  accessCodeId: integer("access_code_id").references(() => accessCodesTable.id),
  sessionToken: text("session_token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  fingerprint: text("fingerprint"),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDeviceSessionSchema = createInsertSchema(deviceSessionsTable).omit({ id: true, createdAt: true });
export type InsertDeviceSession = z.infer<typeof insertDeviceSessionSchema>;
export type DeviceSession = typeof deviceSessionsTable.$inferSelect;
