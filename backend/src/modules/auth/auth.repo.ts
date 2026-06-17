import { eq } from "drizzle-orm";
import { db } from "../../shared/db/index.js";
import { users } from "./auth.schema.js";
import type { SelectUser } from "../users/users.schema.js";

export const authRepo = {
  /**
   * Find a user by their mobile number for login.
   */
  async findByMobileNumber(mobileNumber: string): Promise<SelectUser | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.mobileNumber, mobileNumber))
      .limit(1);
    return result[0];
  },
};
