import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";
import { users } from "../users/users.schema.js";

// ─── Table ───────────────────────────────────────────────────────────────────

export const brokerAccounts = pgTable("broker_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // clientId = broker/capital ID from MeroShare (e.g. 129 for a specific broker)
  clientId: varchar("client_id", { length: 100 }).notNull(),
  username: varchar("username", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  demat: varchar("demat", { length: 255 }),
  clientCode: varchar("client_code", { length: 100 }),
  // AES-256-GCM encrypted — must be decryptable for IPO portal requests
  passwordEncrypted: varchar("password_encrypted", { length: 512 }).notNull(),
  crn: varchar("crn", { length: 100 }).notNull(),
  // Pin is also encrypted since it's used as a transaction PIN
  pinEncrypted: varchar("pin_encrypted", { length: 512 }).notNull(),
  bankId: integer("bank_id"), // Optional for existing, required for new
  isActive: boolean("is_active").notNull().default(true),
  autoApply: boolean("auto_apply").notNull().default(true),
  autoReApply: boolean("auto_reapply").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Relations ───────────────────────────────────────────────────────────────

export const brokerAccountsRelations = relations(brokerAccounts, ({ one }) => ({
  user: one(users, {
    fields: [brokerAccounts.userId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  brokerAccounts: many(brokerAccounts),
}));

// ─── Types ───────────────────────────────────────────────────────────────────

export type SelectBrokerAccount = typeof brokerAccounts.$inferSelect;
export type InsertBrokerAccount = typeof brokerAccounts.$inferInsert;

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

export const insertBrokerAccountSchema = createInsertSchema(brokerAccounts);
export const selectBrokerAccountSchema = createSelectSchema(brokerAccounts);

export type InsertBrokerAccountInput = z.infer<typeof insertBrokerAccountSchema>;
export type SelectBrokerAccountOutput = z.infer<typeof selectBrokerAccountSchema>;
