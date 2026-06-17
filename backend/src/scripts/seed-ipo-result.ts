import { db } from "../shared/db/index.js";
import { ipos, ipoApplications } from "../modules/ipo/ipo.schema.js";
import { accountsRepo } from "../modules/accounts/accounts.repo.js";
import { eq, and } from "drizzle-orm";

async function run() {
  console.log("Seeding test IPO (companyShareId: 788) for result checking...");

  // Insert or update IPO
  await db
    .insert(ipos)
    .values({
      companyShareId: "788",
      companyName: "Sanigad Hydro Limited",
      issueOpenDate: new Date("2026-06-01T00:00:00Z"),
      issueCloseDate: new Date("2026-06-04T11:15:00Z"),
      isResultPublished: false,
    })
    .onConflictDoUpdate({
      target: ipos.companyShareId,
      set: { isResultPublished: false },
    });

  console.log("Inserted IPO into 'ipos' table.");

  // Fetch all active accounts
  const activeAccounts = await accountsRepo.findAllActive();

  if (activeAccounts.length === 0) {
    console.log(
      "No active accounts found in the DB. Skipping application seeds.",
    );
  } else {
    for (const account of activeAccounts) {
      const existingRecords = await db
        .select()
        .from(ipoApplications)
        .where(
          and(
            eq(ipoApplications.brokerAccountId, account.id),
            eq(ipoApplications.ipoId, "788"),
          ),
        )
        .limit(1);
      const existing = existingRecords[0];

      if (!existing) {
        await db.insert(ipoApplications).values({
          userId: account.userId,
          brokerAccountId: account.id,
          ipoId: "788",
          ipoName: "Test Seeded IPO",
          status: "applied",
        });
        console.log(
          `Inserted mock application for account ${account.username}`,
        );
      } else {
        // Reset status
        await db
          .update(ipoApplications)
          .set({ status: "applied" })
          .where(
            and(
              eq(ipoApplications.brokerAccountId, account.id),
              eq(ipoApplications.ipoId, "788"),
            ),
          );
        console.log(`Reset mock application for account ${account.username}`);
      }
    }
  }

  console.log("Seed complete! The result checker should now process this IPO.");
  process.exit(0);
}

run().catch(console.error);
