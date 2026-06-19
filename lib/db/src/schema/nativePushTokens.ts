import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const nativePushTokensTable = pgTable("native_push_tokens", {
  id:        serial("id").primaryKey(),
  token:     text("token").notNull().unique(),
  userId:    integer("user_id"),
  role:      text("role"),
  platform:  text("platform"),
  active:    boolean("active").notNull().default(true),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type NativePushToken = typeof nativePushTokensTable.$inferSelect;
export type InsertNativePushToken = typeof nativePushTokensTable.$inferInsert;
