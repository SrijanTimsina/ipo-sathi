import { config } from "./src/config/index.js";
import { accountsRepo } from "./src/modules/accounts/accounts.repo.js";
import { accountsService } from "./src/modules/accounts/accounts.service.js";
import { MeroShareClient } from "./src/modules/ipo/ipo.meroshare.client.js";
import { safeAuthenticate } from "./src/modules/ipo/ipo.auth.utils.js";

async function testAuth() {
  const testAccountId = process.env.TEST_ACCOUNT_ID;

  if (!testAccountId) {
    console.error("Error: Please provide TEST_ACCOUNT_ID in your .env file.");
    process.exit(1);
  }

  console.log(`\n======================================================`);
  console.log(`🚀 RUNNING AUTH TEST FOR TEST_ACCOUNT_ID:`);
  console.log(`   ${testAccountId}`);
  console.log(`======================================================\n`);

  try {
    const activeAccounts = await accountsRepo.findActiveByUserId(testAccountId);
    if (!activeAccounts || activeAccounts.length === 0) {
      console.error("No active accounts found for this user.");
      process.exit(1);
    }

    for (const account of activeAccounts) {
      const decryptedAccount = await accountsService.getOwnAccount(account.userId, account.id);
      
      console.log(`\nAttempting safeAuthenticate for: ${decryptedAccount.username} (${decryptedAccount.name || 'No Name'})...`);
      const client = new MeroShareClient();
      try {
        const token = await safeAuthenticate(client, decryptedAccount);
        console.log(`✅ Authentication Success! Token received.`);
        
        // Check if password changed in memory
        if (decryptedAccount.password !== account.passwordEncrypted) {
          console.log(`The password might have been updated. Current memory password: ${decryptedAccount.password}`);
        }
      } catch (authError: any) {
        console.error(`❌ Auth Test Failed for ${decryptedAccount.username}:`);
        console.error(authError.message);
      }
    }

  } catch (error: any) {
    console.error("\n❌ Fatal Error:");
    console.error(error.message);
  } finally {
    process.exit(0);
  }
}

testAuth();
