import { eq, and, desc } from "drizzle-orm";
import { db } from "../../shared/db/index.js";
import {
  type SelectIpoApplication,
  type InsertIpoApplication,
  type SelectIpo,
  type InsertIpo,
} from "./ipo.schema.js";
import { ipoApplications, ipos } from "./ipo.schema.js";

export const ipoRepo = {
  async createApplication(
    input: InsertIpoApplication,
  ): Promise<SelectIpoApplication> {
    const result = await db.insert(ipoApplications).values(input).returning();
    const record = result[0];
    if (!record) throw new Error("Failed to create IPO application record");
    return record;
  },

  async upsertIpo(input: InsertIpo): Promise<SelectIpo> {
    const result = await db
      .insert(ipos)
      .values(input)
      .onConflictDoUpdate({
        target: ipos.companyShareId,
        set: {
          companyName: input.companyName,
          issueOpenDate: input.issueOpenDate,
          issueCloseDate: input.issueCloseDate,
          updatedAt: new Date(),
        },
      })
      .returning();
    const record = result[0];
    if (!record) throw new Error("Failed to upsert IPO record");
    return record;
  },

  async findUnpublishedIpos(): Promise<SelectIpo[]> {
    return db.select().from(ipos).where(eq(ipos.isResultPublished, false));
  },

  async findAllIpos(): Promise<SelectIpo[]> {
    return db.select().from(ipos);
  },

  async markResultPublished(companyShareId: string): Promise<void> {
    await db
      .update(ipos)
      .set({ isResultPublished: true, updatedAt: new Date() })
      .where(eq(ipos.companyShareId, companyShareId));
  },

  async updateStatus(
    id: string,
    status: SelectIpoApplication["status"],
    errorMessage?: string,
  ): Promise<void> {
    await db
      .update(ipoApplications)
      .set({
        status,
        errorMessage: errorMessage ?? null,
        updatedAt: new Date(),
      })
      .where(eq(ipoApplications.id, id));
  },

  async updateNotificationStatus(
    id: string,
    notificationStatus: SelectIpoApplication["notificationStatus"],
  ): Promise<void> {
    await db
      .update(ipoApplications)
      .set({
        notificationStatus,
        updatedAt: new Date(),
      })
      .where(eq(ipoApplications.id, id));
  },

  async findByUserId(
    userId: string,
    ipoId?: string,
  ): Promise<SelectIpoApplication[]> {
    const whereClause = ipoId
      ? and(
          eq(ipoApplications.userId, userId),
          eq(ipoApplications.ipoId, ipoId),
        )
      : eq(ipoApplications.userId, userId);

    return db
      .select()
      .from(ipoApplications)
      .where(whereClause)
      .orderBy(desc(ipoApplications.appliedAt));
  },

  async findAllotmentResults(userId: string): Promise<SelectIpoApplication[]> {
    return db
      .select()
      .from(ipoApplications)
      .where(
        and(
          eq(ipoApplications.userId, userId),
          eq(ipoApplications.status, "allotted"),
        ),
      )
      .orderBy(desc(ipoApplications.appliedAt));
  },

  async findByUserIdAdmin(userId: string): Promise<SelectIpoApplication[]> {
    return db
      .select()
      .from(ipoApplications)
      .where(eq(ipoApplications.userId, userId))
      .orderBy(desc(ipoApplications.appliedAt));
  },

  async findByAccountAndIpo(
    accountId: string,
    ipoId: string,
  ): Promise<SelectIpoApplication | undefined> {
    const result = await db
      .select()
      .from(ipoApplications)
      .where(
        and(
          eq(ipoApplications.brokerAccountId, accountId),
          eq(ipoApplications.ipoId, ipoId),
        ),
      )
      .limit(1);
    return result[0];
  },
};
