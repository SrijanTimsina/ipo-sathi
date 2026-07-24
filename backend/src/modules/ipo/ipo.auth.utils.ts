import { MeroShareClient, MeroShareAuthError } from "./ipo.meroshare.client.js";
import { accountsService, generateNextPassword } from "../accounts/accounts.service.js";
import { usersRepo } from "../users/users.repo.js";
import { ipoNotificationService } from "./ipo.notification.service.js";
import type { DecryptedAccount } from "../accounts/accounts.service.js";

export async function safeAuthenticate(
  client: MeroShareClient,
  account: DecryptedAccount,
): Promise<string> {
  try {
    return await client.authenticate(account);
  } catch (error: any) {
    if (error instanceof MeroShareAuthError) {
      if (
        account.autoUpdatePassword &&
        (error.authResponse.passwordExpired || error.authResponse.changePassword)
      ) {
      console.info(
        `[Auth Utils] Password expired for ${account.username}. Auto-updating...`,
      );
      
      const user = await usersRepo.findById(account.userId);
      if (!user) {
        throw new Error("User not found during password auto-update");
      }

      const newPassword = generateNextPassword(user.name, account.password);
      
      if (!error.token) {
         throw new Error("Missing temporary token for password reset");
      }

      await client.changePassword(
        error.token,
        account.password,
        newPassword,
        newPassword,
      );

      // Update in database
      await accountsService.updateAccount(account.userId, account.id, {
        password: newPassword,
      });

      // Notify the user
      await ipoNotificationService.notifyPasswordUpdate(
        user,
        account,
        newPassword,
      );

      // Update account in memory and re-authenticate
      account.password = newPassword;
      return await client.authenticate(account, true);
    } else {
      if (error.authResponse.accountExpired) {
        error.message = "Meroshare Expired";
      } else if (error.authResponse.dematExpired) {
        error.message = "Demat Expired";
      } else if (error.authResponse.passwordExpired || error.authResponse.changePassword) {
        error.message = "Password Expired";
      }
    }
    }
    
    throw error;
  }
}
