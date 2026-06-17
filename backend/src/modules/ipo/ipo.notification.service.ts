import { whatsappService } from "../../shared/services/whatsapp.service.js";
import { ipoRepo } from "./ipo.repo.js";
import { accountsRepo } from "../accounts/accounts.repo.js";
import { usersRepo } from "../users/users.repo.js";

/**
 * Service to evaluate IPO statuses for a user and dispatch aggregated WhatsApp messages.
 */
export const ipoNotificationService = {
  /**
   * Evaluates the current status of all accounts for a user and an IPO,
   * sends a WhatsApp message if necessary, and updates the `notificationStatus`.
   */
  async evaluateAndNotify(
    userId: string,
    ipoId: string,
    ipoName: string,
    openDate?: string,
    closeDate?: string,
  ) {
    const user = await usersRepo.findById(userId);
    if (!user || !user.mobileNumber) return; // Cannot notify without a phone number

    const apps = await ipoRepo.findByUserId(userId, ipoId);
    if (apps.length === 0) return;

    // Fetch account details to get the usernames
    const accounts = await accountsRepo.findActiveByUserId(userId);
    const accountMap = new Map(
      accounts.map((a) => [a.id, a.name || a.username]),
    );

    // Check Rule 1: Initial Application
    // If ANY app has "none", and it's the first time processing, we might send the "New IPO" message
    // Actually, we send the "New IPO" message if ALL accounts that we just processed are "none"
    const hasNewApps = apps.some((a) => a.notificationStatus === "none");

    if (hasNewApps) {
      await this.notifyInitial(
        user.mobileNumber,
        ipoName,
        apps,
        accountMap,
        openDate,
        closeDate,
      );
      return; // Exit after initial notification
    }

    // Check Rule 2: Rejections
    const rejectedApps = apps.filter(
      (a) => a.status === "error" && a.notificationStatus !== "rejected",
    );
    if (rejectedApps.length > 0) {
      await this.notifyRejection(
        user.mobileNumber,
        ipoName,
        apps,
        rejectedApps,
        accountMap,
      );
      return; // Exit after rejection notification (one at a time is fine, or aggregated)
    }

    // Check Rule 3: All Verified
    const allAccountsCount = accounts.length;
    const verifiedApps = apps.filter(
      (a) =>
        a.status === "applied" ||
        a.status === "allotted" ||
        a.status === "not_allotted",
    );

    // If all active accounts are verified, AND at least one hasn't been notified yet
    if (verifiedApps.length === allAccountsCount && allAccountsCount > 0) {
      const needsNotification = verifiedApps.some(
        (a) => a.notificationStatus !== "verified",
      );
      if (needsNotification) {
        await this.notifyAllVerified(
          user.mobileNumber,
          ipoName,
          apps,
          accountMap,
        );
        return;
      }
    }
  },

  async notifyInitial(
    mobileNumber: string,
    ipoName: string,
    apps: any[],
    accountMap: Map<string, string>,
    openDate?: string,
    closeDate?: string,
  ) {
    const applied: string[] = [];
    const skipped: string[] = [];
    const failed: string[] = [];

    for (const app of apps) {
      const accountName = accountMap.get(app.brokerAccountId) || "Unknown";
      if (app.status === "applied" || app.status === "pending") {
        applied.push(`${accountName}: Applied ✅`);
      } else if (app.status === "error") {
        if (
          app.errorMessage === "Auto-apply disabled" ||
          app.errorMessage === "Did not apply via system"
        ) {
          skipped.push(`${accountName}: Skipped ⏸️`);
        } else {
          failed.push(`${accountName}: (${app.errorMessage}) ❌`);
        }
      }
    }

    let message = `📊 *New IPO Alert*\n`;
    message += `*${ipoName}*\n`;
    if (openDate || closeDate) {
      const start = openDate ? openDate.split("T")[0] : "TBD";
      const end = closeDate ? closeDate.split("T")[0] : "TBD";
      message += `📅 ${start} - ${end}\n`;
    }

    message += `\n📋 *Application Status*:\n`;

    if (failed.length > 0) {
      message += `\n**Failed** ❌\n`;
      failed.forEach((f) => (message += `${f}\n`));
    }
    if (skipped.length > 0) {
      message += `\n**Skipped** ⏸️\n`;
      skipped.forEach((s) => (message += `${s}\n`));
    }
    if (applied.length > 0) {
      message += `\n**Applied** ✅\n`;
      applied.forEach((a) => (message += `${a}\n`));
    }

    await whatsappService.sendMessage(
      this.formatNumber(mobileNumber),
      message.trim(),
    );

    // Update DB
    for (const app of apps) {
      await ipoRepo.updateNotificationStatus(app.id, "applied");
    }
  },

  async notifyReapplied(
    mobileNumber: string,
    ipoName: string,
    accountName: string,
    reason: string,
  ) {
    let message = `🔄 *Re-applied*\n`;
    message += `*${ipoName}*\n\n`;
    message += `${accountName}: Rejected (${reason}) - Auto Re-applied`;

    await whatsappService.sendMessage(this.formatNumber(mobileNumber), message);
  },

  async notifyReapplyFailed(
    mobileNumber: string,
    ipoName: string,
    accountName: string,
    rejectionReason: string,
    reapplyError: string,
  ) {
    let message = `🚨 *Re-apply Failed*\n`;
    message += `*${ipoName}*\n\n`;
    message += `*${accountName}*\n`;
    message += `Rejection: ${rejectionReason}\n`;
    message += `Re-apply Error: ${reapplyError}`;

    await whatsappService.sendMessage(this.formatNumber(mobileNumber), message);
  },

  async notifyRejection(
    mobileNumber: string,
    ipoName: string,
    allApps: any[],
    rejectedApps: any[],
    accountMap: Map<string, string>,
  ) {
    let message = `🚨 *IPO Rejected*\n`;
    message += `*${ipoName}*\n\n`;
    message += `*Action Required (Auto Re-apply OFF)*:\n`;

    for (const app of rejectedApps) {
      const accountName = accountMap.get(app.brokerAccountId) || "Unknown";
      message += `- *${accountName}*`;
      if (app.errorMessage) {
        message += ` (${app.errorMessage})`;
      }
      message += `\n`;
    }

    await whatsappService.sendMessage(
      this.formatNumber(mobileNumber),
      message.trim(),
    );

    // Update DB
    for (const app of rejectedApps) {
      await ipoRepo.updateNotificationStatus(app.id, "rejected");
    }
  },

  async notifyAllVerified(
    mobileNumber: string,
    ipoName: string,
    apps: any[],
    accountMap: Map<string, string>,
  ) {
    let message = `✅ *All Applications Verified*\n*${ipoName}*\n\n`;

    for (const app of apps) {
      if (
        app.status === "applied" ||
        app.status === "allotted" ||
        app.status === "not_allotted"
      ) {
        const accountName = accountMap.get(app.brokerAccountId) || "Unknown";
        message += `${accountName}: Verified ✅\n`;
      }
    }

    await whatsappService.sendMessage(
      this.formatNumber(mobileNumber),
      message.trim(),
    );

    // Update DB
    for (const app of apps) {
      await ipoRepo.updateNotificationStatus(app.id, "verified");
    }
  },

  async notifyResultForUser(
    userId: string,
    ipoId: string,
    ipoName: string,
    apps: any[],
    accountMap: Map<string, string>,
  ) {
    const user = await usersRepo.findById(userId);
    if (!user || !user.mobileNumber) return;

    await this.notifyResult(user.mobileNumber, ipoName, apps, accountMap);
  },

  async notifyResult(
    mobileNumber: string,
    ipoName: string,
    apps: any[],
    accountMap: Map<string, string>,
  ) {
    let message = `🎉 *IPO Result*\n`;
    message += `*${ipoName}*\n\n`;

    for (const app of apps) {
      const accountName = accountMap.get(app.brokerAccountId) || "Unknown";
      if (app.status === "allotted") {
        message += `✅ *${accountName}*: Allotted\n`;
      } else if (app.status === "not_allotted") {
        message += `❌ *${accountName}*: Not Allotted\n`;
      } else {
        message += `⚠️ *${accountName}*: ${app.status} ${app.errorMessage ? `(${app.errorMessage})` : ""}\n`;
      }
    }

    await whatsappService.sendMessage(
      this.formatNumber(mobileNumber),
      message.trim(),
    );
  },

  formatNumber(mobile: string): string {
    // Basic formatting: if user didn't enter country code (10 digits for Nepal), prepend 977
    if (mobile.length === 10 && mobile.startsWith("9")) {
      return `977${mobile}`;
    }
    return mobile;
  },
};
