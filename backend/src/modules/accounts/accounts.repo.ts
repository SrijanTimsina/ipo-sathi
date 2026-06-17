import { eq, and, count, sql } from "drizzle-orm";
import { db } from "../../shared/db/index.js";
import { brokerAccounts } from "./accounts.schema.js";
import type {
  SelectBrokerAccount,
  InsertBrokerAccount,
} from "./accounts.schema.js";
import type { PaginationParams, PaginatedResult } from "../users/users.repo.js";

export const accountsRepo = {
  async findById(id: string): Promise<SelectBrokerAccount | undefined> {
    const result = await db
      .select()
      .from(brokerAccounts)
      .where(eq(brokerAccounts.id, id))
      .limit(1);
    return result[0];
  },

  async findByUsername(username: string): Promise<SelectBrokerAccount | undefined> {
    const result = await db
      .select()
      .from(brokerAccounts)
      .where(eq(brokerAccounts.username, username))
      .limit(1);
    return result[0];
  },

  async findAllByUserId(
    userId: string,
    { page, limit }: PaginationParams
  ): Promise<PaginatedResult<SelectBrokerAccount>> {
    const offset = (page - 1) * limit;
    const whereClause = eq(brokerAccounts.userId, userId);

    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(brokerAccounts)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(brokerAccounts.createdAt),
      db.select({ count: count() }).from(brokerAccounts).where(whereClause),
    ]);

    const total = Number(totalResult[0]?.count ?? 0);

    return {
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  async findActiveByUserId(userId: string): Promise<SelectBrokerAccount[]> {
    return db
      .select()
      .from(brokerAccounts)
      .where(and(eq(brokerAccounts.userId, userId), eq(brokerAccounts.isActive, true)));
  },

  async findAllActive(): Promise<SelectBrokerAccount[]> {
    return db
      .select()
      .from(brokerAccounts)
      .where(eq(brokerAccounts.isActive, true));
  },

  async create(input: InsertBrokerAccount): Promise<SelectBrokerAccount> {
    const result = await db.insert(brokerAccounts).values(input).returning();
    const account = result[0];
    if (!account) throw new Error("Failed to create broker account");
    return account;
  },

  async update(
    id: string,
    input: Partial<Omit<InsertBrokerAccount, "id" | "userId" | "createdAt">>
  ): Promise<SelectBrokerAccount | undefined> {
    const result = await db
      .update(brokerAccounts)
      .set({ ...input, updatedAt: sql`now()` })
      .where(eq(brokerAccounts.id, id))
      .returning();
    return result[0];
  },

  async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(brokerAccounts)
      .where(eq(brokerAccounts.id, id))
      .returning({ id: brokerAccounts.id });
    return result.length > 0;
  },
};
