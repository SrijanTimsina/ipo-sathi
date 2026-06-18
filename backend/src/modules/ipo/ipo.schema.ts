import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { users } from "../users/users.schema.js";

// ─── Table ───────────────────────────────────────────────────────────────────

import { boolean } from "drizzle-orm/pg-core";

export const ipos = pgTable("ipos", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyShareId: varchar("company_share_id", { length: 100 })
    .notNull()
    .unique(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  issueOpenDate: timestamp("issue_open_date"),
  issueCloseDate: timestamp("issue_close_date"),
  isResultPublished: boolean("is_result_published").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const ipoNotifications = pgTable("ipo_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  ipoId: varchar("ipo_id", { length: 100 }).notNull(),
  initialSent: boolean("initial_sent").notNull().default(false),
  allVerifiedSent: boolean("all_verified_sent").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Types ───────────────────────────────────────────────────────────────────

export type SelectIpoNotification = typeof ipoNotifications.$inferSelect;
export type InsertIpoNotification = typeof ipoNotifications.$inferInsert;

export type SelectIpo = typeof ipos.$inferSelect;
export type InsertIpo = typeof ipos.$inferInsert;
