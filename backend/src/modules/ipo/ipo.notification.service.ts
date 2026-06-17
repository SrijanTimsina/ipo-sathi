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
  async evaluateAndNotify(userId: string, ipoId: string, ipoName: string, openDate?: string, closeDate?: string) {
    const user = await usersRepo.findById(userId);
    if (!user || !user.mobileNumber) return; // Cannot notify without a phone number

    const apps = await ipoRepo.findByUserId(userId, ipoId);
    if (apps.length === 0) return;

    // Fetch account details to get the usernames
    const accounts = await accountsRepo.findActiveByUserId(userId);
    const accountMap = new Map(accounts.map((a) => [a.id, a.name || a.username]));

    // Check Rule 1: Initial Application
    // If ANY app has "none", and it's the first time processing, we might send the "New IPO" message
    // Actually, we send the "New IPO" message if ALL accounts that we just processed are "none"
    const isFirstTime = apps.every(a => a.notificationStatus === "none");
    
    if (isFirstTime) {
      await this.notifyInitial(user.mobileNumber, ipoName, apps, accountMap, openDate, closeDate);
      return; // Exit after initial notification
    }

    // Check Rule 2: Rejections
    const rejectedApps = apps.filter(a => a.status === "error" && a.notificationStatus !== "rejected");
    if (rejectedApps.length > 0) {
      await this.notifyRejection(user.mobileNumber, ipoName, apps, rejectedApps, accountMap);
      return; // Exit after rejection notification (one at a time is fine, or aggregated)
    }

    // Check Rule 3: All Verified
    const allAccountsCount = accounts.length;
    const verifiedApps = apps.filter(a => a.status === "applied" || a.status === "allotted" || a.status === "not_allotted");
    
    // If all active accounts are verified, AND at least one hasn't been notified yet
    if (verifiedApps.length === allAccountsCount && allAccountsCount > 0) {
      const needsNotification = verifiedApps.some(a => a.notificationStatus !== "verified");
      if (needsNotification) {
        await this.notifyAllVerified(user.mobileNumber, ipoName, apps);
        return;
      }
    }
  },

  async notifyInitial(mobileNumber: string, ipoName: string, apps: any[], accountMap: Map<string, string>, openDate?: string, closeDate?: string) {
    const applied: string[] = [];
    const disabled: string[] = [];
    const errors: string[] = [];

    for (const app of apps) {
      const accountName = accountMap.get(app.brokerAccountId) || "Unknown";
      if (app.status === "applied" || app.status === "pending") {
        applied.push(accountName);
      } else if (app.status === "error") {
        if (app.errorMessage === "Account disabled") {
          disabled.push(accountName);
        } else {
          errors.push(`${accountName} (${app.errorMessage})`);
        }
      }
    }

    let message = `📊 *New IPO Alert*\n`;
    message += `*Company*: ${ipoName}\n`;
    if (openDate) message += `*Open Date*: ${openDate.split("T")[0]}\n`;
    if (closeDate) message += `*Close Date*: ${closeDate.split("T")[0]}\n`;
    message += `\n📋 *Application Status*:\n`;

    if (applied.length > 0) message += `✅ *Applied*: ${applied.join(", ")}\n`;
    if (disabled.length > 0) message += `⏸️ *Auto-apply Off*: ${disabled.join(", ")}\n`;
    if (errors.length > 0) message += `❌ *Failed*: ${errors.join(", ")}\n`;

    await whatsappService.sendMessage(this.formatNumber(mobileNumber), message.trim());

    // Update DB
    for (const app of apps) {
      await ipoRepo.updateNotificationStatus(app.id, "applied");
    }
  },

  async notifyRejection(mobileNumber: string, ipoName: string, allApps: any[], rejectedApps: any[], accountMap: Map<string, string>) {
    let message = `🚨 *IPO Rejection Alert*\n`;
    message += `*Company*: ${ipoName}\n\n`;
    message += `⚠️ *Rejected Accounts*:\n`;
    
    for (const app of rejectedApps) {
      const accountName = accountMap.get(app.brokerAccountId) || "Unknown";
      message += `- *${accountName}*`;
      if (app.errorMessage) {
        message += `: ${app.errorMessage}`;
      }
      message += `\n`;
    }

    const verified = allApps.filter(a => a.status === "applied").length;
    const unverified = allApps.filter(a => a.status === "pending").length;

    message += `\n📊 *Overall Status*:\n`;
    message += `✅ ${verified} Verified\n`;
    message += `⏳ ${unverified} Unverified`;

    await whatsappService.sendMessage(this.formatNumber(mobileNumber), message.trim());

    // Update DB
    for (const app of rejectedApps) {
      await ipoRepo.updateNotificationStatus(app.id, "rejected");
    }
  },

  async notifyAllVerified(mobileNumber: string, ipoName: string, apps: any[]) {
    const message = `✅ *IPO Verification Complete*\n*Company*: ${ipoName}\n\n🎉 All applications have been successfully verified!`;
    
    await whatsappService.sendMessage(this.formatNumber(mobileNumber), message);

    // Update DB
    for (const app of apps) {
      await ipoRepo.updateNotificationStatus(app.id, "verified");
    }
  },

  async notifyResult(mobileNumber: string, ipoName: string, apps: any[], accountMap: Map<string, string>) {
    let message = `🎉 *IPO Result Published*\n`;
    message += `*Company*: ${ipoName}\n\n`;
    message += `📋 *Your Results*:\n`;

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

    await whatsappService.sendMessage(this.formatNumber(mobileNumber), message.trim());
  },

  formatNumber(mobile: string): string {
    // Basic formatting: if user didn't enter country code (10 digits for Nepal), prepend 977
    if (mobile.length === 10 && mobile.startsWith("9")) {
      return `977${mobile}`;
    }
    return mobile;
  }
};
