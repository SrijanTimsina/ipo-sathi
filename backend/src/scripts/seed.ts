/**
 * Admin user seed script.
 * Run with: bun run db:seed
 *
 * Creates the initial admin user if one doesn't already exist.
 * This is required since there is no self-registration endpoint.
 */

import "../config/index.js"; // validate env vars first
import bcrypt from "bcryptjs";
import { db } from "../shared/db/index.js";
import { users } from "../modules/users/users.schema.js";
import { eq } from "drizzle-orm";

const ADMIN_MOBILE = process.env["SEED_ADMIN_MOBILE"] ?? "9800000000";
const ADMIN_PASSWORD = process.env["SEED_ADMIN_PASSWORD"] ?? "Admin@123";
const ADMIN_NAME = process.env["SEED_ADMIN_NAME"] ?? "System Admin";

const BCRYPT_ROUNDS = 12;

async function seed(): Promise<void> {
  console.log("[Seed] Starting admin user seed...");

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.mobileNumber, ADMIN_MOBILE))
    .limit(1);

  if (existing.length > 0) {
    console.log(`[Seed] Admin user with mobile ${ADMIN_MOBILE} already exists. Skipping.`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);

  const [admin] = await db
    .insert(users)
    .values({
      name: ADMIN_NAME,
      mobileNumber: ADMIN_MOBILE,
      passwordHash,
      role: "admin",
      isActive: true,
    })
    .returning();

  console.log("[Seed] ✅ Admin user created successfully:");
  console.log(`  Name:   ${admin?.name}`);
  console.log(`  Mobile: ${admin?.mobileNumber}`);
  console.log(`  Role:   ${admin?.role}`);
  console.log("");
  console.log("[Seed] ⚠️  IMPORTANT: Change the default password after first login!");
  console.log("");
  console.log("[Seed] Default credentials:");
  console.log(`  Mobile:   ${ADMIN_MOBILE}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);

  process.exit(0);
}

seed().catch((err: unknown) => {
  console.error("[Seed] ❌ Seed failed:", err);
  process.exit(1);
});
