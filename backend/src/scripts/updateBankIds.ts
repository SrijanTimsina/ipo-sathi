import { db } from "../shared/db/index.js";
import { brokerAccounts } from "../modules/accounts/accounts.schema.js";
import { accountsService } from "../modules/accounts/accounts.service.js";
import { MeroShareClient } from "../modules/ipo/ipo.meroshare.client.js";

async function main() {
  console.log("Starting script to update bankIds for all active accounts...");

  // Fetch all accounts
  const allAccounts = await accountsService.getAllActiveDecryptedAccounts();
  console.log(`Found ${allAccounts.length} active accounts.`);

  for (const account of allAccounts) {
    if (account.bankId) {
      console.log(`Account ${account.username} already has bankId ${account.bankId}. Skipping.`);
      continue;
    }

    console.log(`Processing account: ${account.username}...`);
    try {
      const client = new MeroShareClient();
      console.log(`  Authenticating...`);
      const token = await client.authenticate(account);

      console.log(`  Fetching own details...`);
      const ownDetail = await client.getOwnDetail(token);

      console.log(`  Fetching BOID details...`);
      const boidDetail = await client.getClientBoidDetail(token, ownDetail.demat);

      let bankId: number;

      console.log(`  Fetching bank details by bank code (${boidDetail.bankCode})...`);
      const bankByCode = await client.getBankDetailByCode(token, boidDetail.bankCode);

      if (!bankByCode) {
        console.log(`  Could not find bank by code. Falling back to bank list...`);
        const bankList = await client.getBankList(token);
        if (bankList.length === 0) {
          throw new Error("No banks found for account");
        }
        const firstBank = bankList[0]!;
        bankId = firstBank.id;
      } else {
        const bankInfo = bankByCode.bank;
        bankId = Array.isArray(bankInfo) ? bankInfo[0]!.id : bankInfo.id;
      }

      console.log(`  Found bankId: ${bankId}. Updating database...`);

      // We cannot use accountsService.updateAccount directly without passing userId,
      // and it also does extra checks. Let's just update the DB directly.
      await db
        .update(brokerAccounts)
        .set({ bankId })
        .where(require('drizzle-orm').eq(brokerAccounts.id, account.id));

      console.log(`  Successfully updated bankId for ${account.username}.\n`);
    } catch (error: any) {
      console.error(`  Failed to process account ${account.username}:`, error.message, "\n");
    }
  }

  console.log("Finished updating bankIds.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
