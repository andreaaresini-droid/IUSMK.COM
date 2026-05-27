import { pgTable, serial, text, real, timestamp } from "drizzle-orm/pg-core";

export const paymentLinksTable = pgTable("payment_links", {
  id:             serial("id").primaryKey(),
  name:           text("name").notNull(),
  paymentLinkUrl: text("payment_link_url").notNull(),
  paymentLinkId:  text("payment_link_id").notNull(),
  amount:         real("amount"),
  notes:          text("notes"),
  createdAt:      timestamp("created_at").notNull().defaultNow(),
  updatedAt:      timestamp("updated_at").notNull().defaultNow(),
});
