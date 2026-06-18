import { eq, and, desc } from "drizzle-orm";
import { db } from "../../shared/db/index.js";
import {
  type SelectIpoNotification,
  type InsertIpoNotification,
  type SelectIpo,
  type InsertIpo,
} from "./ipo.schema.js";
import { ipoNotifications, ipos } from "./ipo.schema.js";

export const ipoRepo = {
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

  async getNotificationState(
    userId: string,
    ipoId: string,
  ): Promise<SelectIpoNotification> {
    let result = await db
      .select()
      .from(ipoNotifications)
      .where(
        and(
          eq(ipoNotifications.userId, userId),
          eq(ipoNotifications.ipoId, ipoId),
        ),
      )
      .limit(1);

    if (result.length === 0) {
      result = await db
        .insert(ipoNotifications)
        .values({ userId, ipoId })
        .returning();
    }
    
    return result[0]!;
  },

  async markInitialSent(userId: string, ipoId: string): Promise<void> {
    await db
      .update(ipoNotifications)
      .set({ initialSent: true, updatedAt: new Date() })
      .where(
        and(
          eq(ipoNotifications.userId, userId),
          eq(ipoNotifications.ipoId, ipoId),
        ),
      );
  },

  async markAllVerifiedSent(userId: string, ipoId: string): Promise<void> {
    await db
      .update(ipoNotifications)
      .set({ allVerifiedSent: true, updatedAt: new Date() })
      .where(
        and(
          eq(ipoNotifications.userId, userId),
          eq(ipoNotifications.ipoId, ipoId),
        ),
      );
  },
};
