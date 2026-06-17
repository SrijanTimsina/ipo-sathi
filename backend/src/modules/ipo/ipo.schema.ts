import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";
import { users } from "../users/users.schema.js";
import { brokerAccounts } from "../accounts/accounts.schema.js";

// ─── Enums ──────────────────────────────────────────────────────────────────

export const ipoStatusEnum = pgEnum("ipo_status", [
  "applied",
  "pending",
  "allotted",
  "not_allotted",
  "error",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "none",
  "applied",
  "rejected",
  "verified",
]);

// ─── Table ───────────────────────────────────────────────────────────────────

import { boolean } from "drizzle-orm/pg-core";

export const ipos = pgTable("ipos", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyShareId: varchar("company_share_id", { length: 100 }).notNull().unique(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  issueOpenDate: timestamp("issue_open_date"),
  issueCloseDate: timestamp("issue_close_date"),
  isResultPublished: boolean("is_result_published").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const ipoApplications = pgTable("ipo_applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  brokerAccountId: uuid("broker_account_id")
    .notNull()
    .references(() => brokerAccounts.id),
  // External company share ID from the MeroShare portal
  ipoId: varchar("ipo_id", { length: 100 }).notNull(),
  ipoName: varchar("ipo_name", { length: 255 }).notNull(),
  status: ipoStatusEnum("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  notificationStatus: notificationStatusEnum("notification_status").notNull().default("none"),
  appliedAt: timestamp("applied_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Relations ───────────────────────────────────────────────────────────────

export const ipoApplicationsRelations = relations(ipoApplications, ({ one }) => ({
  user: one(users, {
    fields: [ipoApplications.userId],
    references: [users.id],
  }),
  brokerAccount: one(brokerAccounts, {
    fields: [ipoApplications.brokerAccountId],
    references: [brokerAccounts.id],
  }),
}));

// ─── Types ───────────────────────────────────────────────────────────────────

export type SelectIpoApplication = typeof ipoApplications.$inferSelect;
export type InsertIpoApplication = typeof ipoApplications.$inferInsert;

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

export const insertIpoApplicationSchema = createInsertSchema(ipoApplications);
export const selectIpoApplicationSchema = createSelectSchema(ipoApplications);

export type InsertIpoApplicationInput = z.infer<typeof insertIpoApplicationSchema>;
export type SelectIpoApplicationOutput = z.infer<typeof selectIpoApplicationSchema>;

export type SelectIpo = typeof ipos.$inferSelect;
export type InsertIpo = typeof ipos.$inferInsert;
