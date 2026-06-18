import "./config/index.js"; // validate env vars at startup
import app from "./app.js";
import { config } from "./config/index.js";
import cron from "node-cron";
import { runIpoAutomation } from "./modules/ipo/ipo.automation.js";
import { checkIpoResults } from "./modules/ipo/ipo.result.automation.js";

const PORT = config.server.port;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[Server] Running at http://0.0.0.0:${PORT}`);
  console.log(`[Server] Environment: ${config.server.nodeEnv}`);
  console.log(`[Server] API base: http://0.0.0.0:${PORT}/api/v1`);
});

// Set up daily cron jobs for IPO Automation
// Runs every day at 10:10 AM Nepal Time
cron.schedule(
  "10 10 * * *",
  () => {
    console.log("[Cron] Running morning IPO automation (10:10 AM NPT)...");
    void runIpoAutomation({ isMorningCron: true });
  },
  {
    timezone: "Asia/Kathmandu",
  },
);

// Runs every day at 4:10 PM Nepal Time
cron.schedule(
  "10 16 * * *",
  () => {
    console.log("[Cron] Running evening IPO automation (4:10 PM NPT)...");
    void runIpoAutomation({ isEveningCron: true });
  },
  {
    timezone: "Asia/Kathmandu",
  },
);

// Check IPO results every 10 minutes
cron.schedule("*/10 * * * *", () => {
  console.log("[Cron] Running IPO result check (every 10 minutes)...");
  void checkIpoResults();
});
