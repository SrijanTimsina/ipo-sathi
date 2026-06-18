import { runIpoAutomation } from "./src/modules/ipo/ipo.automation";
import { config } from "./src/config";

async function testAutomation() {
  const testAccountId = process.env.TEST_ACCOUNT_ID;

  if (!testAccountId) {
    console.error("Error: Please provide TEST_ACCOUNT_ID in your .env file.");
    process.exit(1);
  }

  console.log(`\n======================================================`);
  console.log(`🚀 RUNNING REAL AUTOMATION FOR TEST_ACCOUNT_ID:`);
  console.log(`   ${testAccountId}`);
  console.log(`======================================================\n`);

  try {
    const result = await runIpoAutomation();
    console.log(`\n✅ Automation Test Complete! Result:`);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("\n❌ Automation Test Failed:", error);
  } finally {
    process.exit(0);
  }
}

testAutomation();
