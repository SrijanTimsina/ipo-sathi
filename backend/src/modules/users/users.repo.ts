import { eq, ilike, and, count, sql } from "drizzle-orm";
import { db } from "../../shared/db/index.js";
import { users } from "./users.schema.js";
import type { SelectUser, InsertUser } from "./users.schema.js";

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const usersRepo = {
  async findById(id: string): Promise<SelectUser | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  },

  async findByMobileNumber(mobileNumber: string): Promise<SelectUser | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.mobileNumber, mobileNumber))
      .limit(1);
    return result[0];
  },

  async findAll(
    { page, limit }: PaginationParams,
    search?: string
  ): Promise<PaginatedResult<SelectUser>> {
    const offset = (page - 1) * limit;

    const whereClause = search
      ? and(ilike(users.name, `%${search}%`))
      : undefined;

    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(users)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(users.createdAt),
      db
        .select({ count: count() })
        .from(users)
        .where(whereClause),
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

  async create(input: InsertUser): Promise<SelectUser> {
    const result = await db.insert(users).values(input).returning();
    const user = result[0];
    if (!user) throw new Error("Failed to create user");
    return user;
  },

  async update(
    id: string,
    input: Partial<Omit<InsertUser, "id" | "createdAt">>
  ): Promise<SelectUser | undefined> {
    const result = await db
      .update(users)
      .set({ ...input, updatedAt: sql`now()` })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  },

  async setActiveStatus(id: string, isActive: boolean): Promise<SelectUser | undefined> {
    const result = await db
      .update(users)
      .set({ isActive, updatedAt: sql`now()` })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  },

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  },
};
